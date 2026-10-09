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
| Actions  | `Button`, `DropdownMenu` (+ Item/Radio/Checkbox/Separator), `ToggleGroup`                                                                |
| Feedback | `Alert`, `AlertDialog`, `Skeleton`, `Badge`, `Tooltip`                                                                                   |
| Data     | `Table` (+ Header/Body/Row/Head/Cell/Caption/Footer), `Calendar`, `Popover`                                                              |
| Custom   | `DataPagination`, `StatCard` (see below)                                                                                                 |

Project-level building blocks:

- `src/components/layout/` — `PageHeader`, `SectionHeader`, `AppSidebar`,
  `SidebarNav`, `SidebarNavItem`, `AppTopbar`, `ThemeToggle`, `AccentToggle`
- `src/components/data/` — `StatCard`, `DataPagination`
- `src/components/rbac/` — `ResourceFormDialog`: the single create/edit dialog
  all five RBAC pages share, with its fields driven by the resource metadata
  in `src/lib/rbac.ts`

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
| A date                            | `DatePickerField`                  | `<input type="date">` (unstyleable, inconsistent per browser) |
| A destructive confirmation        | `AlertDialog`                      | `Dialog` (an alert dialog cannot be dismissed by accident)    |
| A long form                       | `Dialog` with `sm:max-w-lg`        | A full-width dialog                                           |

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
