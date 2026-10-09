# Forms

The `Field` family is what makes a form read as designed rather than
assembled. Use it. Do not build a form out of `Label` + `Input` + a `<div>`
with your own margins.

Reference implementation: `src/components/rbac/ResourceFormDialog.vue` — one
dialog for create and edit, with its fields driven by the resource metadata in
`src/lib/rbac.ts`.

---

## The structure

```vue
<FieldGroup>                                  <!-- gap-7 between fields -->
  <Field>                                     <!-- gap-3 inside a field -->
    <FieldLabel for="email">Work email</FieldLabel>
    <Input id="email" v-model="email" />
    <FieldDescription>We only use it for invites.</FieldDescription>
    <FieldError v-if="errors.email">{{ errors.email }}</FieldError>
  </Field>
</FieldGroup>
```

Four parts, one job each:

| Part               | Job                                           |
| ------------------ | --------------------------------------------- |
| `FieldGroup`       | Spaces **fields** apart (28px)                |
| `Field`            | Spaces a **label from its control** (12px)    |
| `FieldLabel`       | The label. Takes `for`, like a real `<label>` |
| `FieldDescription` | Persistently visible help                     |
| `FieldError`       | The error, in place of the description        |

**The whole point is the ratio.** Field-internal gap < field gap. If you set
one gap for everything, the hint under an input reads as the label of the
next input. See [principles.md](./principles.md#1-two-spacing-levels-never-one).

---

## Orientation

```vue
<Field>                                     <!-- vertical (default) -->
<Field orientation="horizontal">            <!-- label beside the control -->
<Field orientation="responsive">            <!-- vertical on mobile, horizontal from @md -->
```

Use `horizontal` for short labels next to a `Switch` or a compact `Select`.
Use `vertical` when the control is full-width or the label is long.

---

## Errors

Three things, all required:

```vue
<Field :data-invalid="!!errors.email || undefined">
  <FieldLabel for="email">Work email</FieldLabel>
  <Input
    id="email"
    v-model="email"
    :aria-invalid="errors.email ? true : undefined"
    :aria-describedby="errors.email ? 'email-error' : 'email-hint'"
  />
  <FieldDescription v-if="!errors.email" id="email-hint">…</FieldDescription>
  <FieldError v-else id="email-error">{{ errors.email }}</FieldError>
</Field>
```

1. **`aria-invalid`** paints the control. The primitive already carries
   `aria-invalid:border-destructive` and `aria-invalid:ring-[3px]` in both
   themes. Do not write a red border yourself.
2. **`aria-describedby`** points at whichever message is showing. This is
   what makes a screen reader announce the error with the field.
3. **`data-invalid` on the `Field`** turns the label and description
   `--destructive` as a group.

Note the `|| undefined` and `? true : undefined` — passing `false` would
render `aria-invalid="false"`, which is _not_ the same as absent.

---

## Validation timing

**Validate on submit, then live after the first attempt.**

```ts
const submitted = ref(false)

const errors = computed(() => {
  if (!submitted.value) return {} // silent until the first submit
  return validate(draft.value)
})

function submit() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  // …
}
```

Validating on every keystroke marks a field red while the user is still
typing the first character of a valid value. That trains people to ignore
the error styling entirely — which is worse than no validation at all.

**Also validate more than once.** Client validation is a courtesy; the
server validates again. Never let the client be the only gate.

---

## Form-level errors

An error that is not about one field goes next to the button the user just
pressed, not at the top of the page:

```vue
<div class="mt-6 flex flex-col gap-3">
  <p v-if="failure" role="alert" class="text-sm text-destructive">{{ failure }}</p>
  <div class="flex items-center gap-2">
    <Button type="submit" :disabled="saving">…</Button>
    <Button type="button" variant="ghost">Cancel</Button>
  </div>
</div>
```

`role="alert"` so it is announced. Submit button first, cancel second — the
primary action keeps the position the hand already knows.

---

## Dialog forms

```vue
<Dialog :open="open" @update:open="(v) => emit('update:open', !!v)">
  <DialogContent class="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>New order</DialogTitle>
      <DialogDescription>Add an order to the table.</DialogDescription>
    </DialogHeader>
    <form novalidate @submit.prevent="submit">
      <FieldGroup class="gap-5">…</FieldGroup>
      <DialogFooter>…</DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

- **`sm:max-w-lg` for a form**, `sm:max-w-sm` for a single question. A
  full-width dialog stretches inputs to 1200px, which is unreadable.
- **`FieldGroup class="gap-5"`** — a dialog is a tighter column than a page.
- **The footer is inside the `<form>`** so the primary button is a real
  `type="submit"` and Enter works.
- **Re-seed on open, not on mount.** Watch `open` and reset the draft; a
  component that is kept alive will otherwise show the previous record's
  values the second time it opens.
- **One dialog for create and edit.** Two components duplicate every field
  and drift the first time a field is added. `null` means create.

---

## A dialog around an async write

A save takes time, and the user can do things during it. Three rules, and
each one closes a specific hole:

**1. Disable every way out while saving.** Escape, outside clicks, Cancel
and the corner close. Blocking three of the four leaves the door open:
a Cancel button that still works is the one the user will find.

**2. Snapshot before the first `await`.**

```ts
const editingId = props.order?.id ?? null
const payload: OrderDraft = { ...draft.value }
await orders.save(editingId, payload)
```

Reading `props.order` or `draft.value` after the await uses whatever the
user has done since — including reopening on a different row. The snapshot
fixes _what_ gets written.

**3. Guard the response with a session token.**

```ts
let submitSession = 0

watch(
  () => props.open,
  (open) => {
    submitSession += 1 // any transition invalidates a save in flight
    if (!open) return
    // …re-seed the form
  },
)

const session = submitSession
await orders.save(editingId, payload)
if (session !== submitSession) return // superseded: leave the UI alone
emit("update:open", false)
```

The snapshot fixes what is written; the token fixes _whose interface_
reacts. Without it a save that finishes late dismisses whatever dialog is
on screen now, which is not the record it was started for.

> The token is a guard against a state the disabled buttons already
> prevent. Keep both: the buttons are the interface, the token is the
> invariant, and only one of them survives someone later deciding that
> "Cancel should work while saving".

---

## Date fields

```vue
<DatePickerField v-model="draft.placedAt" label="Placed on" />
```

The model is an **ISO date string** (`"2026-09-14"`), never a `Date`.

**Why.** A `Date` carries a time and a zone. An order placed on the 1st
drifts to the 30th for a user far enough east. A `YYYY-MM-DD` string cannot
drift, and it sorts correctly lexicographically.

`isEmail` and `isBlank` in `src/lib/validation.ts` are the gates the shared
validators build on; `validateResource` composes them per field.

---

## The rules, condensed

1. `FieldGroup` outside, `Field` inside. Never one gap for both.
2. `FieldLabel` with `for`, `Input` with matching `id`. Always.
3. Placeholder is an example. If you are putting a label there, stop.
4. `aria-invalid` paints the error; never a colour class.
5. Validate on submit, live after.
6. Form-level failure next to the submit button, with `role="alert"`.
7. `novalidate` on the form so your validation is the only one talking.
8. Keep every rule in `src/lib/` as a pure function and test it there.
   `validateResource` in `src/lib/rbac.ts` is the pattern — it takes the
   draft and the mode, and returns an error map. No Vue, no store, and its
   own unit tests.

---

## Spacing inside a dialog

`FieldGroup` defaults to `gap-7` (28px). **A dialog uses `gap-5` (20px)**
— the one sanctioned exception:

```vue
<FieldGroup class="gap-5">
```

**Why.** A dialog is a tighter column than a page, and the default costs a
screenful of scrolling for six fields. The _ratio_ still holds: the gap
between fields is larger than the gap inside one, which is the part that
carries the meaning. Only the scale changes.

What is **not** sanctioned: a third value. If a field group needs some
other gap, the layout is wrong, not the number.

---

## A live-validating form uses `computed`, not `watch`

```ts
const errors = computed<MemberErrors>(() =>
  submitted.value ? validateMember(draft.value, members.members) : {},
)
```

**Why.** The errors are a pure function of the draft, so storing them is
storing something derivable — and a `watch` that assigns into an `errors`
ref has to be kept in step with every field. A shallow watch quietly misses
nested writes (`v-model="draft.email"` is one), which is a bug that looks
like "the error message will not go away".

`OrderFormDialog` uses a `watch` with `deep: true` because its errors are
also re-checked against a snapshot taken at submit time. Both are correct;
`computed` is the one to reach for first.
