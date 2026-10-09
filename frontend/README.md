# frontend

> **本目录的角色**：`ts-fullstack-ts-grm` 全栈模板项目的**前端子项目**，
> 源码由 `vue-admin-template` 的已提交版本导出，来源记录见
> [`docs/template-origin.md`](./docs/template-origin.md)。
> 品牌与业务定制尚未开始，步骤见 [`docs/template-usage.md`](./docs/template-usage.md)。
> 依赖由仓库根的 bun workspace 统一管理，请在**仓库根**执行 `bun install`。

A Vue 3 admin scaffold that ships the parts which are tedious to get right
and easy to get wrong: a real design system, a two-level spacing rhythm, a
collapsible shell, a full table + dialog CRUD screen, and guards that fail
the build when a screen drifts off the system.

It exists because "I used shadcn and it came out ugly" is almost never a
component problem. The components were fine. What was missing was
**consistency** — one radius, one shadow, one card label, one page padding,
and something that notices when a new screen breaks the pattern.

Stack: Vue 3 · TypeScript · Vite · Tailwind CSS v4 · Pinia · Vue Router ·
shadcn-vue (Reka UI) · ECharts (vue-echarts) · Vitest · @vue/test-utils.

---

## Use as a project template

模板仓库：[私有 Gitea](https://gitea.guico.top/guico/vue-admin-template.git)。
新业务项目推荐从指定 commit / tag 导出源码并初始化独立 Git 仓库。
完整步骤、品牌定制清单及后续更新策略见
[模板引用与初始化](./docs/template-usage.md)。

## Quick start

```bash
bun install
bun dev            # http://localhost:5173

bun run check      # the whole gate, in one command
```

`bun run check` is typecheck → format → lint → unit tests → build → browser
tests. Run it before calling anything done: a change to layout, spacing or a
form is not verified until the browser tests have run.

The first browser run needs a Chromium binary once:

```bash
bunx playwright install chromium
```

Individual pieces, when you want them on their own:

```bash
bun run test          # unit: guards, rules, interactions
bun run test:browser  # browser: overflow, affordance, navigation, flows
bun run typecheck
bun run lint          # prettier --check && eslint .
bun run format        # prettier --write
bun run build
```

---

## Where to look first

**[`AGENTS.md`](./AGENTS.md) is the entry point for an agent.** It carries the
rules that are enforced by tests and the ones that are not. The long form
lives in [`docs/`](./docs/README.md).

| File                                         | Why                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/assets/main.css`                        | The whole visual system: OKLCH tokens, the three-number brand accent, both themes, the single radius and shadow. |
| `src/components/data/ResourceListView.vue`   | The list page every resource shares: table, form dialog, paginator, delete confirmation, relation candidates.    |
| `src/components/data/DataPagination.vue`     | The paginator every table uses: range readout, page window, page size.                                           |
| `src/lib/pagination.ts`                      | Paging rules, including the clamp that stops a stale page from emptying a table.                                 |
| `src/components/rbac/ResourceFormDialog.vue` | One dialog for create and edit across all five resources, with validation and `aria-invalid`.                    |
| `src/lib/rbac.ts`                            | RBAC resource metadata, as plain data — the layer that has edge cases and needs no rendering.                    |
| `src/lib/resource.ts`                        | The vocabulary those specs are written in: `ResourceSpec`, the row readers, the validators.                      |
| `src/lib/design-system.test.ts`              | How the visual rules are kept from decaying.                                                                     |
| `tests/browser/overflow.spec.ts`             | The overflow check: every page at every breakpoint, in a real browser.                                           |

---

## The layout rules

These are the ones that actually change how the app reads.

**1. Two spacing levels, never one.**
A field's label, control, help text and error sit `gap-3` apart inside a
`Field`. Separate fields sit `gap-7` apart inside a `FieldGroup`. Giving
every element the same gap is the single most common reason a form built
from these same components still looks unfinished — the eye has no way to
tell which hint belongs to which input.

**2. Page padding is one of two values.**
`p-4 space-y-4` for ordinary pages, `p-4 md:p-6 space-y-6` for a
dashboard-style first screen.

**3. One `<h1>` per page, owned by `PageHeader`.**
20px / weight 650 / `-0.01em` tracking, with a 14px muted subtitle.
Sections use `SectionHeader` (16px uppercase + hairline); they never get
their own big heading. A guard asserts both.

**The type floor: nothing below 14px, key text from 16px up.** Key text is
the page title, card and section labels, the brand, nav items and table
headers. `text-xs` is overridden to 14px in `main.css`, so the floor holds
for a component written tomorrow as well as for today's; a guard rejects any
literal below it.

**4. Data-card titles use one exact class list.**
`text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase`.
The stock shadcn `CardTitle` carries no size of its own; the uppercase
tracking is what makes the title read as a data card rather than as prose,
and a guard fails the check if you forget.

**5. A placeholder is an example, never a label.**

**6. Error state comes from `aria-invalid`, not a hand-written class.**
The Input, Select and Textarea primitives already carry
`aria-invalid:border-destructive` and `aria-invalid:ring-[3px]` in both
themes. Set the attribute. Hand-painting the border is how one form ends
up with four slightly different reds.

**7. Numbers get `tabular-nums`.** Otherwise a live figure reflows on every
update and the whole row twitches.

**8. Technical values get `font-mono`.** IPs, references, emails, amounts.

**9. Depth in dark mode comes from hairlines, not shadows.**
`--shadow-card` is switched off under `.dark` on purpose. A shadow on a dark
surface is nearly invisible and only fogs the area.

**10. Conditional fields are revealed, not disabled.** A greyed-out field
the user cannot act on adds length without adding information.

**11. Icon-only buttons carry both `aria-label` and a tooltip.** The icon
names nothing on its own.

**12. An empty table and an empty result are different screens.** They need
different exits: "add something" versus "loosen the filters".

**13. A table is paginated. Always.** No exceptions for short tables and
none for "it fits on one screen". A paginated table tells the user where
they are in the whole set; an unpaginated one silently claims the set is
small, and that claim stops being true at the first busy week. A guard
fails the check if a view renders `<Table>` without the paginator.

**14. Layout does not overflow, at any width.** `bun run test:browser`
runs every page at every breakpoint in a real browser and fails on the first
element that crosses the viewport edge. Overflow is the defect least
likely to be caught in review and invisible to every other kind of test —
a component test with happy-dom has no layout engine, so every element
measures 0x0 and every assertion passes.

It found three real bugs that passed typecheck and all 97 unit tests:

- A component whose root renders no element dropped a `class` passed to
  it, so a date trigger kept its built-in `w-full` and pushed the whole
  filter row past the card edge.
- A validator called `.trim()` on a value that arrives from
  `<input type="number">` as a number. The submit handler threw and the
  only symptom was a button that did nothing.
- `AlertDialogAction` closed the dialog before the click handler ran,
  clearing the target and making delete silently do nothing.

**15. Every interactive control shows a hand, and reacts to hover.**
`bun run test:browser` checks every control's computed cursor on every
page, then samples hover on buttons, links, toggles, selects, switches and
row actions.

Tailwind v4 removed preflight's `cursor: pointer` on `<button>`, so every
button in the app showed a default arrow until `main.css` restored it —
**38 controls across five pages**. The restoration is one rule in the base
layer, not a class per component: a primitive added later cannot forget it,
and a utility can still override it. Disabled controls are excluded — they
are not clickable, and a hand that does nothing is worse than an arrow.

**16. A Menu expands; a View navigates. Never both.** A parent that does
both makes the sidebar unpredictable — the user cannot tell whether a
click will move them or reveal something. Menus default to expanded (so a
new section is discoverable), the _closed_ set is what gets persisted, and
landing inside a closed Menu opens it. `tests/browser/navigation.spec.ts`
asserts the negative case: clicking a Menu must leave the URL unchanged.

---

## Pagination

Every table gets the same paginator, and the rules behind it are plain
functions in `src/lib/pagination.ts`:

- **The clamp is the important part.** A page number can outlive the data
  it pointed at — delete the last row of page 3, or apply a filter that
  leaves six rows, and an unclamped slice renders a blank table with rows
  still sitting behind it. `paginate()` always returns a page inside
  `[1, pageCount]`.
- **The readout is not decoration.** "Showing 1–10 of 24" is what
  distinguishes a filtered table from a truncated one. Without it the user
  cannot tell whether they are seeing everything.
- **A hole of exactly one page renders the number, not an ellipsis.**
  A lone "…" standing in for a single value is strictly worse than the
  value, and it is what every naive window implementation ships.
- **The first and last page are always in the window**, so the control does
  not reshape itself as the user walks it.
- **Changing a filter returns to page 1.** Page 4 of a two-row result is not
  a page anyone asked to be on.

`PageSize` is a union (`10 | 25 | 50 | 100`), not a number, so a page size
that the size selector cannot offer fails to compile.

---

## Choosing the filter control

A filter is only as good as the control it is built from. The orders screen
uses all three, each for a reason:

- **Text input** — for values nobody remembers exactly (reference, customer,
  email). Searches across several fields at once, because a user does not
  know which column holds what they typed.
- **Select** — for a closed set. A status is one of five values, so a text
  box would only be a chance to type it wrong. `"all"` is an explicit
  option rather than an empty state.
- **Date range** — two single-date fields rather than one range calendar:
  each bound is independently clearable, and which one you are editing
  needs no legend.

Ranges are **inclusive** at both ends, and dates are compared as ISO strings.
A `Date` object would shift an order placed on the 1st to the 30th for a
user far enough east; a `YYYY-MM-DD` string cannot.

The Clear button counts **filter groups, not fields** — a date range is one
filter, not two.

---

## The shell

The sidebar has two lives:

- **Desktop**: a rail that collapses to icons. The state is persisted, so it
  survives a reload.
- **Mobile**: a drawer. A permanent 240px rail on a 390px screen is a layout
  the page can never win against.

Both render the same `SidebarNav`, so they cannot drift apart. In the
collapsed rail each item keeps an `aria-label` and gains a tooltip — the one
state where a label cannot explain itself. The collapse control uses a
single `Tooltip` with `:disabled`, not two branches, so the `RouterLink`
is not remounted (and does not lose focus) when the rail toggles.

`h-dvh`, not `h-screen`: `vh` is the _largest_ viewport on mobile Safari, so
the shell would sit under the browser bar. `min-h-0` on the scroll container
is what actually lets it scroll instead of growing.

---

## Theming

The accent is decomposed into three raw numbers:

```css
:root {
  --brand-l: 0.52;
  --brand-c: 0.115;
  --brand-h: 178;
}
:root {
  --primary: oklch(var(--brand-l) var(--brand-c) var(--brand-h));
}
[data-accent="green"] {
  --brand-h: 155;
  --brand-c: 0.13;
  --brand-l: 0.5;
}
```

Switching the accent rewrites three numbers; every surface, ring and glow
recomposes from them. Duplicating a palette per accent is how theming drifts.

Adding a fourth accent is three edits: `ACCENTS` in `src/lib/accent.ts`, a
CSS block pair in `src/assets/main.css`, and two lines in `index.html`. A
guard fails if you miss the CSS blocks or the inline script.

Chart colours (`--chart-1` … `--chart-5`) are categorical and deliberately
separate from the brand accent. Assign them in order and never cycle;
`--chart-3` is under 3:1 on a white card, so any multi-series chart must keep
a legend or a table view — colour is never the only channel.

---

## How the guards work

Three layers, in increasing order of what they can see.

**1. Source scanning** (`src/lib/design-system.test.ts`, node, no DOM) —
read `.vue` files and assert with regex. Framework agnostic, and enough for
"does every view import PageHeader".

**2. SFC AST** — `@vue/compiler-sfc`'s `parse()` gives a real template AST.
This is where regex breaks down: a `<h2>` inside a comment or an
interpolation is not a heading, and a regex cannot tell.

**3. Server rendering** — `@vue/server-renderer`'s `renderToString` turns a
component into HTML you can assert on. This catches accessibility
regressions like an `aria-labelledby` that no longer points at the heading
it claims to.

Alongside those, two ordinary test layers:

- **Pure rules** (`src/lib/*.test.ts`) — filtering, sorting, validation and
  date parsing. Edge cases (`2026-02-31`, a non-leap `2026-02-29`, an amount
  of `0`) live here, where they cost nothing to express.
- **Interactions** (`src/components/**/*.test.ts`) — happy-dom, opted into
  per file. These assert what happens when a user types: that the table
  actually narrows, that an empty result offers _Clear_ rather than _New
  order_, that a dialog's content reaches the document.

Things worth knowing if you extend them:

- `renderToString` is **async**, unlike React's `renderToStaticMarkup`.
- Slot content is wrapped in SSR comment markers, so match
  `/<h2[^>]*>[\s\S]*?Overview[\s\S]*?<\/h2>/`.
- A component that injects a context (a `Tooltip`, a `Select`) needs its
  provider in the test's tree too — otherwise the mount fails with
  `Injection ... not found`.
- Dialog content teleports to `document.body`, so assert it there.

Every one of these was found by running the tests against real output, not
by writing them from memory.

---

## What is deliberately not here

Data fetching, auth, i18n, a mock API, and server-side sorting. Each is a
decision that depends on your backend, and a scaffold that guesses is
harder to delete than to add. The orders store is in-memory: swap the bodies
of `save` / `remove` for API calls and the shape stays the same.
