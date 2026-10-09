# Tables and filters

Reference implementation: `src/views/OrganizationsView.vue` — CRUD plus
pagination where the server owns the page.

**Every table is paginated.** This is principle 13 and a guard enforces it:
a view that renders `<Table>` without `DataPagination` fails the check.

---

## The shape

```vue
<Card>
  <CardHeader>
    <CardTitle class="text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase">
      Results
    </CardTitle>
    <CardDescription>{{ matched.length }} of {{ orders.total }} orders</CardDescription>
  </CardHeader>

  <CardContent class="px-0">          <!-- px-0: the table supplies its own -->
    <Table>
      <TableHeader>…</TableHeader>
      <TableBody>
        <TableRow v-for="row in pageInfo.rows" :key="row.id">…</TableRow>
      </TableBody>
    </Table>

    <div v-if="matched.length === 0">…</div>   <!-- empty state -->
    <DataPagination v-else … />
  </CardContent>
</Card>
```

Two details that matter:

- **The count says what it counts.** "24 of 24 orders" after filtering is
  "6 of 24 orders". A bare number next to a filtered table reads as missing
  data.
- **`px-0` on `CardContent`**, so the header row can sit flush while the
  paginator adds its own padding.

---

## Column conventions

```vue
<TableHead>Reference</TableHead>
<!-- plain -->
<TableHead class="text-right">Amount</TableHead>
<!-- numeric: right -->
<TableHead class="hidden md:table-cell">Email</TableHead>
<!-- collapse first -->
<TableHead class="w-20"><span class="sr-only">Actions</span></TableHead>
```

- **Numbers right-aligned with `tabular-nums`.** That is what makes a column
  align on the decimal and stop twitching when a row is edited.
- **Technical values in `font-mono`** (rule 8).
- **Low-value columns collapse first** (`hidden md:table-cell`), rather than
  everything shrinking.
- **The actions column gets an `sr-only` heading**, because a visual header
  would say "Actions" on every row.
- **Row actions are icon buttons with `aria-label` + `Tooltip`** (rule 11).

---

## Pagination

State is one number. Everything else is derived.

```ts
const page = ref(1)
const pageSize = ref<PageSize>(DEFAULT_PAGE_SIZE)
const pageInfo = computed(() => paginate(matched.value, page.value, pageSize.value))

watch(filters, () => {
  page.value = 1
})
watch(pageSize, () => {
  page.value = 1
})

// Deleting the last row of the last page must not leave a blank table.
watch(
  () => pageInfo.value.page,
  (safe) => {
    if (safe !== page.value) page.value = safe
  },
)
```

```vue
<DataPagination
  :page="pageInfo.page"
  :page-size="pageInfo.pageSize"
  :page-count="pageInfo.pageCount"
  :total="pageInfo.total"
  :from="pageInfo.from"
  :to="pageInfo.to"
  @update:page="page = $event"
  @update:page-size="pageSize = $event"
/>
```

**Never slice rows yourself.** A hand-rolled `rows.slice((page-1)*size, …)`
is a table whose page number can outlive its data. `paginate()` clamps
`page` into `[1, pageCount]`, which is what keeps a table from going blank
with rows still behind it. A guard rejects `.slice((page …` in a view.

The rules live in `src/lib/pagination.ts` and are tested in
`pagination.test.ts` — 23 cases, including the clamp, the empty set, a
`NaN` page, and "never emits two adjacent ellipses".

`PageSize` is `10 | 25 | 50 | 100`. **A page size the selector cannot offer
does not compile**, which is better than discovering it in production.

---

## Filters: pick the control from the data

| The data is…                       | Control                                    | Why                                                                |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Something nobody remembers exactly | `Input`, searching several columns at once | The user does not know which column holds what they typed          |
| A closed set                       | `Select` with an explicit `"all"` option   | A text box is only a chance to type it wrong                       |
| A time bound                       | Two `DatePickerField`s                     | Each bound clears independently; one range calendar needs a legend |

Ranges are **inclusive at both ends**, and dates are compared as ISO
strings.

**The Clear button counts filter groups, not fields.** A date range is one
filter, not two — "Clear 4 filters" for a range and a status is arithmetic
the user has to redo.

```ts
export function countActiveFilters(filters: OrderFilters): number {
  let count = 0
  if (filters.search.trim() !== "") count += 1
  if (filters.status !== "all") count += 1
  if (filters.from || filters.to) count += 1 // one group
  return count
}
```

**No debounce until the filter drives a request.** Filtering an array
already in memory does not need one; adding a debounce "just in case" adds
a delay the user can feel for no benefit.

Keep the whole filter set in one object, so Clear is one assignment and the
active count is computed once. The filter component emits a **whole object,
not a patch** — no stale field can survive an update.

---

## Empty states

Two of them, always distinguished (principle 12):

```vue
<p>{{ orders.total === 0 ? "No orders yet." : "No orders match these filters." }}</p>
<Button v-if="orders.total === 0" @click="openCreate">New order</Button>
<Button v-else variant="outline" @click="clearFilters">Clear filters</Button>
```

An empty table needs "add something". An empty **result** needs "loosen the
filters" — telling that user to create a record they already created is a
dead end.

---

## Delete

`AlertDialog`, not `Dialog`: an alert dialog cannot be dismissed by a stray
click outside it.

```vue
<Button variant="destructive" :disabled="deleting" @click="confirmDelete">
  Delete order
</Button>
```

`confirmDelete` snapshots the target, awaits the write and closes the dialog
only on success. Do not use `AlertDialogAction` for this async flow: it closes
the dialog before the click handler can read state. See
[forms.md](./forms.md#a-dialog-around-an-async-write).

The destructive action is **spelled out, not an icon**, and sits second —
the safe choice keeps the position the hand already knows.

---

## Where the logic goes

Filtering, sorting, validation and paging are **pure functions in
`src/lib/`**, tested without a DOM:

```
src/lib/orders.ts        filterOrders · sortOrders · validateOrder · isIsoDate
src/lib/orders.test.ts   27 tests
src/lib/pagination.ts    paginate · clampPage · pageWindow
src/lib/pagination.test.ts  23 tests
```

The view holds state and renders. If you find yourself writing a loop with
a condition inside a `.vue` file, it belongs in `lib/`.
