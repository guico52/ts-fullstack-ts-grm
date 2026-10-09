# Design principles

Twenty-one rules. They are here because each one is a mistake that was made,
seen in a screenshot, and then made impossible to repeat.

Source guards cover rules 3, 4 and 13; browser tests cover layout,
affordance and navigation (14–16). Other rules have partial coverage or
require review. See [constraints.md](./constraints.md) for the full project
constraints and their enforcement boundaries.

---

## 1. Two spacing levels, never one

A field's label, control, help text and error sit `gap-3` apart inside a
`Field`. Separate fields sit `gap-7` apart inside a `FieldGroup`.

**Why.** Giving every element the same gap is the single most common reason
a form built from these same components still looks unfinished. The eye has
no way to tell which hint belongs to which input, so it reads the whole
thing as an undifferentiated list.

**The one exception:** `gap-5` inside a dialog, because a dialog is a
tighter column. The _ratio_ is what carries the meaning and it still holds.
What is not sanctioned is a third value — if a group needs some other gap,
the layout is wrong, not the number. See
[forms.md](./forms.md#spacing-inside-a-dialog).

```vue
<!-- Yes -->
<FieldGroup>
  <Field>…</Field>   <!-- 28px between fields -->
  <Field>…</Field>
</FieldGroup>

<!-- No -->
<div class="space-y-3">
  <Label>…</Label>
  <Input />
  <p>Hint</p>
  <Label>…</Label>   <!-- same gap: the hint now looks like a third field -->
</div>
```

---

## 2. Page padding is one of two values

`p-4 space-y-4` for ordinary pages. `p-4 md:p-6 space-y-6` for a
dashboard-style first screen. Nothing else.

**Why.** A page that invents a third value is how an app stops looking like
one app. Two values cover every case, so there is never a reason to add a
third.

---

## 3. One `<h1>` per page, owned by `PageHeader`

20px / weight 650 / `-0.01em` tracking, with a 14px muted subtitle.
Sections use `SectionHeader` (16px uppercase + hairline); they never get
their own big heading.

**Why.** Two competing headings make a page read as two pages. The negative
tracking is not decoration — it is what keeps a heading at this size from
looking loose next to 14px body text.

**The type floor.** Nothing in the app renders below 14px, and key text
starts at 16px. `text-xs` resolves to 14px because `main.css` overrides the
scale, not because every call site remembered to; a guard rejects any
literal below the floor.

**Enforced.** A guard fails the check if a view renders its own `<h1>` or
fails to import `PageHeader`.

---

## 4. Data-card titles use one exact class list

```
text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase
```

The stock shadcn `CardTitle` ships `leading-none font-semibold` and no size,
so it inherits the body size; the uppercase tracking is what makes it read
as a data card rather than as prose.

**Why.** Sixteen cards with sixteen slightly different titles is the
difference between a product and a prototype.

**Enforced.** A guard fails the check on any other title class list.

---

## 5. A placeholder is an example, never a label

```vue
<FieldLabel for="email">Work email</FieldLabel>
<Input id="email" placeholder="ada@example.com" />
```

**Why.** A placeholder disappears the moment typing starts, so it can never
be the thing the user checks against. It is also grey — it reads as
"not filled in yet" even when it is a label.

---

## 6. Error state comes from `aria-invalid`, not a hand-written class

The `Input`, `Select`, `Textarea` and `Checkbox` primitives already carry
`aria-invalid:border-destructive` and `aria-invalid:ring-[3px]` in both
themes.

```vue
<!-- Yes -->
<Input :aria-invalid="hasError ? true : undefined" />

<!-- No: four forms, four slightly different reds, and dark mode breaks -->
<Input :class="hasError ? 'border-red-500' : ''" />
```

**Why.** Hand-painting the border is how one form ends up with four
slightly different reds, none of which match `--destructive` in dark mode.

---

## 7. Numbers get `tabular-nums`

**Why.** Without it a live figure reflows on every update and the whole row
twitches. Cheap to add, immediately visible in any table or metric card.

---

## 8. Technical values get `font-mono`

IPs, references, emails, IDs, config keys, amounts.

**Why.** Monospace makes the difference between two similar values visible
instead of something the user has to read character by character.

---

## 9. Depth in dark mode comes from hairlines, not shadows

`--shadow-card` is switched off under `.dark` on purpose. Dark surfaces use
`ring-1 ring-border` (an 8% white line) instead.

**Why.** A shadow on a dark surface is nearly invisible and only fogs the
area it is meant to lift. This is why `--shadow-card` has two definitions in
`main.css`, one of which is `0 0 #0000`.

---

## 10. Conditional fields are revealed, not disabled

**Why.** A greyed-out field the user cannot act on adds length and visual
noise without adding information. If a field is not applicable, it should
not be on screen.

---

## 11. Icon-only buttons carry both `aria-label` and a tooltip

```vue
<Tooltip>
  <TooltipTrigger as-child>
    <Button size="icon-sm" :aria-label="`Edit ${order.reference}`">
      <Pencil class="size-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Edit</TooltipContent>
</Tooltip>
```

**Why.** The icon names nothing on its own. `aria-label` serves assistive
tech; the tooltip serves everyone else. A row of icon buttons with neither
is a guessing game.

---

## 12. An empty table and an empty result are different screens

They need different exits: "add something" versus "loosen the filters".

```vue
<p>{{ orders.total === 0 ? "No orders yet." : "No orders match these filters." }}</p>
<Button v-if="orders.total === 0" @click="openCreate">New order</Button>
<Button v-else variant="outline" @click="clearFilters">Clear filters</Button>
```

**Why.** One message for both is a dead end — it tells a user staring at a
filtered-to-nothing table to create a record they already created.

---

## 13. A table is paginated. Always.

No exceptions for short tables, and none for "it fits on one screen".

**Why.** A paginated table tells the user where they are in the whole set.
An unpaginated one silently claims the set is small, and that claim stops
being true at the first busy week — by which time the table is shipped.

**Enforced.** A guard fails the check if a view renders `<Table>` without
`DataPagination`.

See [tables.md](./tables.md) for the paging rules (the clamp, the window,
the reset-on-filter).

---

## 14. Layout does not overflow, at any width

Every page is checked at every breakpoint in a real browser. A page that
scrolls sideways fails the check.

**Why.** Overflow is the most common layout defect and the least likely to
be caught in review — it happens at a width the author never tried. It is
also invisible to every other kind of test: a component test with happy-dom
has no layout engine, so every element measures 0x0 and every assertion
passes.

```bash
bun run test:browser
```

The check ignores content inside a horizontally scrollable box (a wide
table is _meant_ to scroll), but still measures the box itself.

**Three real bugs this found, all of which passed typecheck and every unit
test:**

1. A component whose root renders no element dropped the `class` passed to
   it, so a date trigger kept its built-in `w-full` and pushed the whole
   filter row past the card edge.
2. A validator called `.trim()` on a value that arrives from
   `<input type="number">` as a number. The submit handler threw, and the
   only symptom was a button that did nothing.
3. `AlertDialogAction` closed the dialog before the click handler ran,
   clearing the target and making delete silently do nothing.

See [guards.md](./guards.md#layer-4-the-browser) for the mechanics.

---

## 15. Every interactive control shows a hand, and reacts to hover

Two signals, and both are required:

- **The cursor.** A control that shows an arrow is a control the user has
  to guess about.
- **A visible change on hover.** The cursor says "clickable"; the change
  says "this one, right now, is what you are about to hit".

**Why this needs a rule rather than good intentions.** Tailwind v4 removed
preflight's `cursor: pointer` on `<button>`, on the grounds that the
browser default for a button is `default`. That is accurate, and it means
every button in the app showed an arrow until `main.css` put it back.
shadcn-vue's components do not add it. Measured before the fix: **38
controls across five pages**, plus a select trigger with no hover response
outside dark mode and a switch with none at all.

The fix is one rule in the base layer, not a class in each component: a
primitive added later cannot forget it, and a utility can still override it
where a pointer is genuinely wrong.

**Disabled controls are excluded.** They are not clickable, and a hand that
does nothing is worse than an arrow.

```bash
bun run test:browser
```

Checks every interactive control on every page, then samples hover on
buttons, links, toggles, selects, switches and row actions — comparing the
computed background, text, border, shadow, transform, opacity and
decoration before and after. Icon buttons are sampled again on the glyph
itself (see below).

### The icon button trap

A glyph drawn in `text-muted-foreground` reads as **disabled** before the
user ever hovers it. That is the actual complaint — not "the hover is
missing", but "it is grey".

The mistake is putting any colour on the icon. A class on the glyph is
fixed; it cannot follow the state of the control around it:

```vue
<!-- No: muted as a resting colour, so it reads as disabled -->
<Button variant="ghost" size="icon-sm">
  <Pencil class="size-4 text-muted-foreground" />
</Button>

<!-- Also no: the muted resting colour is still there -->
<Button variant="ghost" size="icon-sm" class="text-muted-foreground hover:text-foreground">
  <Pencil class="size-4" />
</Button>

<!-- Yes: no colour at all on the glyph; it inherits the button's own -->
<Button variant="ghost" size="icon-sm">
  <Pencil class="size-4" />
</Button>
```

Lucide icons stroke with `currentColor`, so simply leaving the class off is
what makes it inherit. `variant="ghost"` already supplies the hover
response (`hover:bg-accent hover:text-accent-foreground`), so the third
form gets the rest for free.

For a destructive action the warning belongs on **hover**, not at rest — a
row of permanently red trash icons is noise, while a quiet icon that turns
red under the cursor is a warning at the moment it matters:

```vue
<Button variant="ghost" size="icon-sm" class="hover:bg-destructive/10 hover:text-destructive">
  <Trash2 class="size-4" />
</Button>
```

**The guard samples the resting colour**, not the hovered one, and compares
it against the live `--muted-foreground` token read off the page. Checking
only the hover state — which is what this scaffold did first — lets a
permanently grey icon pass.

The one legitimate use of muted on a glyph is when the **control itself**
is in its placeholder state, like an empty date trigger. There the whole
control is muted, the icon inherits, and both become full-strength together
once a value is set.

---

## 16. A Menu expands; a View navigates. Never both

Two entry kinds in the sidebar, and the difference is behavioural:

- **View** — a leaf. Clicking navigates.
- **Menu** — a parent. Clicking expands or collapses. **It never
  navigates.**

**Why.** A parent that does both is the single easiest way to make a
sidebar feel unpredictable: the user cannot tell whether a click will move
them or reveal something, so every click becomes a small gamble. Keeping
the two behaviours on separate components removes the guesswork.

The rule has three consequences worth stating outright, because each fixes
a specific failure:

- Menus **default to expanded**, so a section added later is discoverable.
- What is persisted is the **closed** set — storing the open set would make
  every future Menu start shut, the same discoverability problem in a
  different costume.
- **Landing inside a closed Menu opens it.** Otherwise the sidebar shows
  nothing about where the user is, which is the one thing it is for.

**Enforced.** `tests/browser/navigation.spec.ts` asserts the negative case
directly: clicking a Menu must leave the URL unchanged.

See [navigation.md](./navigation.md).

---

## 17. A page is its data, not its markup

Every resource page is a spec in `src/lib/` plus three API calls. The table,
the form dialog, the paginator and the relation pickers are one component
(`src/components/data/ResourceListView.vue`), so adding a resource is a spec,
a thin page, a route and a nav entry.

**Why.** Eight pages had become eight copies of the same 250 lines —
identical down to the tooltips. They had not _drifted_; they would have, at
the first change to the paginator. Copy-paste is not a style problem, it is
a change-amplification problem: the cost is paid at the second edit, not the
first.

**A page using `ResourceListView` does not import `PageHeader` itself** — the
component renders one. That is rule 18's business.

---

## 18. A guard may move; it may not weaken

When the tables moved out of `views/` into `ResourceListView`, two guards lost
their subject at once: "every view goes through `PageHeader`", and "the tables
rule is actually watching something". The second one **failed**, which is
exactly what it is for — a guard that matches no file passes for the wrong
reason and then protects nothing.

**The fix is to move the guard, never to drop it.** The table guard now reads
`components/data/` as well; the `PageHeader` guard accepts `ResourceListView`
as a stand-in, and a **new** guard requires that stand-in to actually import
`PageHeader`. An exemption without a test is a hole.

---

## 19. Nothing that blocks a submit may do it silently

A `<input type="number">` defaults to `step="1"`. A price of 88.50 is then
invalid — and **a form that fails HTML5 validation never fires `submit`**. No
request, no message, nothing but a 保存 button that looks dead.

**Why this is a rule and not a bug report.** The failure was invisible to
typecheck, to the unit tests, to the source guards and to 145 browser tests.
It was found by typing a decimal into a real form. Any constraint the browser
can enforce behind your back needs an explicit answer in the spec: a money
column declares `step: 0.01`, and `src/lib/books.test.ts` pins it.

The general form: when a control can reject input without telling anyone, the
rejection has to be either impossible or visible.

---

## 20. The control follows the shape of the data

Three pickers, and which one to use is not a matter of taste:

- **one id, searchable** — `Combobox`
- **several ids** — `MultiSelect`
- **several ids whose depth means something** — `TreeSelect`

**Why three components rather than one with a `multiple` flag.** The two
multi-selects differ from the single one in exactly two behaviours — the value
is a list, and picking one does not close the popover — but the flag would
turn every prop and every emit site into a union type for no gain.

**And why the tree keeps its hierarchy while searching.** A flat result list
answers "which rows match"; the question was "which page, under which menu".
A hit is shown together with its ancestors, never as an orphan. Only branches
get an expander, and the arrow sits inside the row: clicking it collapses,
clicking the row selects.

---

## 21. The screen explains nothing

A label says what a field is. Nothing else on the screen says why the field
exists, what it means, or how the system stores it.

**Why.** Every explanatory line is read once — by the person who wrote it.
After that it is furniture: it takes a row of height, it competes with the
error message that lands in the same slot, and it goes stale the moment the
rule changes. The worst of them are addressed to the wrong reader:

- `列是 NOT NULL，所以必填。` — a note about the database, on a page whose
  reader is filling in a form.
- `保存时整体替换。` — how the write works, not what the user is choosing.
- `共 12 条，按 菜单 → 页面 → 按钮 三层展开。` — the indentation already
  says that, and says it without being read.

**A rule that needs explaining is usually a rule the interface should be
enforcing.** Move it into a control:

| Instead of saying…         | Do this                              |
| -------------------------- | ------------------------------------ |
| 按钮必须挂在页面下         | the parent picker offers only pages  |
| 同层级内由小到大           | the next number is already filled in |
| 选中后组件名与路由一并填好 | they are already filled in           |
| 单位为元，最多两位小数     | the input's `step` is `0.01`         |

If a rule cannot be expressed as a control, it belongs in the **error
message** — the one place a user is genuinely reading.

**What is allowed.** These are not explanations and they stay: a
placeholder is an example (`例如：新华书店`), an empty state is a state
(`还没有图书。`), a validation error says what is wrong, a tooltip names an
icon-only button, and a page's subtitle may say what the page is _for_.

**A picker option's `hint` carries data, not prose.** A route, a code, a
file name — something the user is choosing _between_. `用于分组` is prose,
and it does not belong there.

**Enforced by review, and by absence.** `ResourceField.hint` no longer
exists, so the scaffold cannot grow one back out of habit.

---

## The principle behind the principles

> Ugly comes from inconsistency, not from a lack of decoration.

This codebase has an absurdly small number of design decisions: one radius,
one shadow, one glass recipe, two page paddings, one card-title style, one
paginator. Everything else is reuse. When you are tempted to add a value,
first check whether one of the existing ones already covers the case.
