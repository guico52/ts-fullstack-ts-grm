# Components

Every primitive lives in `src/components/ui/` and comes from the shadcn-vue
registry. **Do not hand-write a replacement for one of these.** If a
primitive is missing, add it with the CLI:

```bash
bunx shadcn-vue@latest add <name> --yes --overwrite
```

---

## What is available

| Group    | Components                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Layout   | `Card` (+ Header/Title/Description/Content/Footer/Action), `Separator`, `Sheet`, `Dialog`                                                |
| Forms    | `Field` (+ Group/Label/Description/Error/Separator/Legend), `Input`, `Textarea`, `Label`, `Select`, `Switch`, `Checkbox`, `NativeSelect` |
| Pickers  | `Combobox` (one id, searchable), `MultiSelect` (many ids), `TreeSelect` (many ids, shown as a tree)                                      |
| Actions  | `Button`, `DropdownMenu` (+ Item/Radio/Checkbox/Separator), `ToggleGroup`                                                                |
| Feedback | `Alert`, `AlertDialog`, `Skeleton`, `Badge`, `Tooltip`                                                                                   |
| Data     | `Table` (+ Header/Body/Row/Head/Cell/Caption/Footer), `Calendar`, `Popover`                                                              |
| Custom   | `DataPagination`, `StatCard` (see below)                                                                                                 |

Project-level building blocks:

- `src/components/layout/` — `PageHeader`, `SectionHeader`, `AppSidebar`,
  `SidebarNav`, `SidebarNavItem`, `AppTopbar`, `ThemeToggle`, `AccentToggle`
- `src/components/data/` — `StatCard`, `DataPagination`, and
  `ResourceListView`. The last one is the list page every resource shares:
  table, form dialog, paginator, delete confirmation and relation candidates.
  A page is its spec plus three API calls — see
  [principles.md](./principles.md#17-a-page-is-its-data-not-its-markup).
- `src/components/rbac/` — the RBAC page kit: `ResourceFormDialog` (one
  create/edit dialog all five resources share, fields driven by
  `src/lib/rbac.ts`), `ViewTreeTable` (the view hierarchy, collapsible), and
  `IconPicker`, which trades a free-text icon field for a grid of the
  catalogue.

  The view tree is a table, not a list: a page belongs to a menu and a button
  to a page, and a flat table cannot show that. `ViewTreeTable` renders the
  depth as indentation and gives an expander only to rows that have children —
  a leaf with a toggle that does nothing is worse than no toggle. Because a
  tree has no page number to jump to, the page fetches the whole tree and
  renders **no** `DataPagination`; every other resource is a flat list and
  keeps one.

  The hierarchy itself is enforced by the backend (`422 INVALID_HIERARCHY`);
  the form only narrows the parent picker so the invalid pairing cannot be
  expressed in the first place.

  Each row also carries the ⊕ its level allows — 添加页面 on a menu, 添加按钮
  on a page, nothing on a button — and clicking one opens the create form with
  the parent, the kind and the next order **already filled**. Those three were
  answered by which row the button sat on; asking again would be asking the
  user to repeat themselves. The two levels get different glyphs on purpose:
  two identical ⊕ in one column would be a guess.

  **Colour says which level you are looking at.** The row's icon carries it —
  主色 for a menu, `chart-1` for a page, muted for a button — and so does the
  kind badge, so a glance down the column is enough to read the structure.
  Only the icon and the label are coloured: hovering a row paints its
  background and **nothing else**, because an icon that brightens on hover
  reads as a control, and these icons are not clickable.

  The tones live in `src/lib/rbac.ts` as token-built class lists
  (`bg-chart-1/10 text-chart-1`), never a literal colour — the tokens already
  carry a light and a dark value. Only `chart-1`, `chart-4` and `chart-5` are
  used for text: the other two are series fills and fall under 3:1 on a light
  card.

  **Row actions carry their own colour too**: 添加 is `chart-4`, 编辑 is
  `chart-1`, 删除 is `destructive`. The colour is on the icon at rest, not
  painted by hover — hovering only adds a tinted background. A destructive
  action that is grey until you point at it hides its one important property
  until after the moment you needed it.

  The two dropdown fields of the view form are written more than they are
  chosen, and they write more than their own column:

  | Field           | Control                          | What it writes                                              |
  | --------------- | -------------------------------- | ----------------------------------------------------------- |
  | `icon`          | `IconPicker` (grid)              | just `icon`                                                 |
  | `componentPath` | `Combobox` of the file catalogue | also `componentName` and `path`, derived from the file name |

  The derivation is declared on the field (`derive`) and applied by the
  dialog, so adding a "pick a thing, fill three columns" field needs no
  component changes.

- `src/components/ui/combobox/` — the dropdown for enumerated and reference
  fields: a trigger that looks like a control, plus a searchable popover whose
  options can carry an icon and a secondary line. Preferred over
  `native-select` (which is only still here because `Calendar` uses it).

- `src/lib/dialog-sizes.ts` — named dialog widths, so a width is chosen at
  the call site instead of by scattering `sm:max-w-*` overrides.

- `src/config/icons.ts` — the icon catalogue. A **curated** list, not
  `import * as icons`: a namespace import defeats tree-shaking and ships the
  whole library for a picker that shows a few dozen. Adding an icon is one
  import and one entry; swapping icon libraries means rewriting this file
  only, because nothing else names the package.

- `src/lib/views-catalog.ts` — every view on disk, via `import.meta.glob`.
  Generated at build time, so the list cannot drift from the files. Doubles
  as the source of `componentName` (the file name) and the route (its
  kebab-case form).

- `src/lib/view-tree.ts` — flat rows ↔ displayable tree: group by parent,
  order siblings, and flatten to the rows currently visible with the depth to
  indent them. Pure functions, so the awkward cases (a parent missing from a
  filtered page, a cycle) are tested without a browser.

---

## Choosing a control

The most common design mistake is not the wrong colour — it is the wrong
control for the data.

| The data is…                      | Use                                | Not                                                           |
| --------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| A closed set of 2–5 values        | `Select`                           | Radio buttons (waste vertical space)                          |
| A binary toggle in a form         | `Switch`                           | A checkbox (implies a form submission)                        |
| A binary toggle applied instantly | `Switch` with an optimistic update | `Switch` plus a Save button                                   |
| 2–3 mutually exclusive modes      | `ToggleGroup`                      | `Select` (a menu for two options is a click tax)              |
| Free text, value unknown          | `Input`                            | `Select` with an "other" option                               |
| A foreign key you can search      | `Combobox`                         | `Select` (a menu that cannot be searched stops scaling)       |
| Several foreign keys at once      | `MultiSelect`                      | A stack of checkboxes (its height grows with the table)       |
| Ids whose depth carries meaning   | `TreeSelect`                       | `MultiSelect` (a flattened tree reads as peers)               |
| A date                            | `DatePickerField`                  | `<input type="date">` (unstyleable, inconsistent per browser) |
| A destructive confirmation        | `AlertDialog`                      | `Dialog` (an alert dialog cannot be dismissed by accident)    |
| A long form                       | `Dialog` with `sm:max-w-lg`        | A full-width dialog                                           |

---

## The three pickers

The three pickers share a trigger, a search box and an option row on purpose:
they are one control answering three kinds of question, and learning one should
be learning all three. They live in `src/components/ui/combobox/`,
`src/components/ui/multi-select/` and `src/components/ui/tree-select/`.

**`MultiSelect` is not a `multiple` flag on `Combobox`.** Those two differ in
exactly two behaviours — the value is a list, and picking one does not close the
popover — but a flag would turn every prop and every emit site into a union type
(`string | string[]`) for no gain, and the branches inside would have to be
re-read every time either mood changed. Two components of thirty lines each are
cheaper than one of sixty with a fork in the middle.

**`TreeSelect` differs from `MultiSelect` in what it shows, not what it emits** —
both are `string[]`. Its options carry `parentId` and `sort`, and it renders
depth as indentation, so a page under its menu does not read as a sibling. Two
details matter more than they look:

- **Searching keeps the hierarchy.** A hit is shown together with its ancestors
  rather than as an orphan row, because the path down to a match is exactly what
  a flat result list throws away.
- **Only branches get an expander.** A leaf with a toggle that does nothing is
  worse than no toggle. The arrow sits inside the row: clicking it collapses the
  branch, clicking the row selects.

Both multi-selects show the chosen items as chips rather than a count — the
question the field answers is _which_ ones, and a number cannot answer it.

---

## Button

```vue
<Button>Save</Button>
<!-- default: h-9 -->
<Button variant="outline">Cancel</Button>
<Button variant="ghost" size="sm">Clear</Button>
<Button variant="destructive">Delete</Button>
<Button size="icon-sm" aria-label="Edit"><Pencil class="size-4" /></Button>
```

Variants: `default` `destructive` `outline` `secondary` `ghost` `link`
Sizes: `xs`(h-6) `sm`(h-8) `default`(h-9) `lg`(h-10) `icon*`(size-6/8/9/10)

**Heights are not arbitrary.** `Input`, `SelectTrigger` and `Button` all
default to `h-9`, so a row of controls lines up without per-case classes.
Mixing `h-8` and `h-10` in one row is the fastest way to make a form look
amateur.

**Icon sizing:** use `class="size-4"` on the icon. Do not add `mr-2` —
button padding is already tuned for icon+label.

**Icon colour goes on the button, never on the glyph.** A class on the icon
is fixed; it cannot follow the control's hover, disabled or filled state. A
glyph drawn in `text-muted-foreground` reads as disabled.

```vue
<!-- Row action: inherits the button's foreground, ghost supplies the hover -->
<Button variant="ghost" size="icon-sm">
  <Pencil class="size-4" />
</Button>

<!-- Destructive row action: quiet at rest, warns under the cursor -->
<Button variant="ghost" size="icon-sm" class="hover:bg-destructive/10 hover:text-destructive">
  <Trash2 class="size-4" />
</Button>
```

Lucide icons stroke with `currentColor`, so leaving the class off is all
that is needed for the glyph to inherit. A guard compares the glyph's
resting colour against the live `--muted-foreground` token and fails if
they match.

---

## Loading states

```vue
<Button type="submit" :disabled="saving">
  <Loader2 v-if="saving" class="size-4 animate-spin" />
  {{ saving ? "Saving" : "Save changes" }}
</Button>
```

The label changes too, not just the icon. A spinner alone leaves the user
unsure whether the first click registered.

---

## Never

- **Never write a raw colour.** `bg-red-500` breaks dark mode. Use
  `text-destructive`, `bg-muted`, `border-border`.
- **Never override a primitive's focus ring.** Focus styling is consistent
  across every control; a local `focus:ring-0` makes one control unreachable
  by keyboard in a way nobody notices until an audit.
- **Never re-implement a primitive.** A "simple" custom select is 200 lines
  of keyboard handling you will not write.
- **Never put a store or the router in `components/data/`.** The guard fails
  the build. These are presentation primitives; they take props.
- **Never nest a clickable element inside a `Button`.** For a secondary
  action inside a control, put it in the popover content (see
  `DatePickerField`'s Clear button).
- **Never add a component with its own spacing scale.** Spacing comes from
  `Field` / `FieldGroup` / the page container.

---

## Composition patterns worth copying

**The company topbar** — `AppTopbar`. The company name is a prominent,
centred brand banner on every page, configured once in `src/config/brand.ts`.
Keep its large type, token-based framing and full name visible; never add an
English subtitle beneath it. On narrow screens the name wraps and controls
move to a separate row. Browser tests verify long names in both themes.

**A metric card** — `StatCard`. Note the shared label class and
`tabular-nums` on the value.

**A row of icon actions** — `Tooltip` + `aria-label` on each, never a bare
icon button (principle 11). See `OrdersView.vue`.

**A dialog with a form** — `Dialog` → `DialogHeader` → `form` →
`FieldGroup` → `DialogFooter`. The footer lives inside the `<form>` so the
submit button is a real submit. See `OrderFormDialog.vue`.

**A filter bar** — `Card` + `CardContent` + a flex-wrap row of labelled
controls, with the Clear button carrying the active count. See
`OrderFilters.vue`.

## Company and project identity

Edit `src/config/brand.ts`: `companyName` is the topbar company title,
`defaultLogoImage` is the URL of the default sidebar image, and
`projectName` is the name beside the logo. `projectFont` controls its font
family, size and weight; keep the size at least 16px. There is no tagline.
The default image asset lives in `public/images/default-company-logo.svg`;
replace the asset or point `defaultLogoImage` to another public image. The config
contains only the image URL, not the logo artwork. The supplied monochrome
placeholder adapts to dark mode; remove its `dark:invert` treatment when replacing
it with a full-colour company logo.
The browser document title also reads this configuration during Vite rendering.
