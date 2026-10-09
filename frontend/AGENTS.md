# AGENTS.md

Context for an agent working in this repository. Read this first; the
detail is in [`docs/`](./docs/README.md).

## What this is

A Vue 3 admin scaffold: TypeScript, Vite, Tailwind v4, Pinia, Vue Router,
shadcn-vue (Reka UI), ECharts (vue-echarts), Vitest. It exists to keep an
admin app consistent — the components were never the problem, the drift was.

## Commands

```bash
bun run check       # the gate: typecheck, format, lint, unit tests, build, browser tests
bun run test        # unit: design guards, pure rules, interactions
bun run test:browser  # browser: overflow, affordance, navigation, forms, flows
bun run typecheck   # vue-tsc --noEmit
bun run lint        # prettier --check && eslint .
bun run format      # prettier --write
bun run build
bun dev
```

**Run `bun run check` before reporting anything as done.** It is the whole
gate in one command. Anything touching layout, widths or a form is not
verified until the browser tests have run — that is the only layer with a
layout engine.

The first browser run needs a binary once: `bunx playwright install chromium`.

## The rules that are enforced by tests

These fail the build. Do not work around them; follow them.

1. **Every view imports `PageHeader` and renders no other `<h1>`.**
2. **Every data-card title uses exactly:**
   `text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase`
3. **Every view with a `<Table>` also renders `DataPagination`**, and does
   not slice rows itself.
4. **`src/components/data/` imports no store and no router.**
5. **Every accent has a light and a dark CSS block**, and the anti-flash
   script in `index.html` knows it.

## The rules that are enforced by review

6. Two spacing levels: `gap-3` inside a `Field`, `gap-7` between fields in
   a `FieldGroup`. Inside a dialog it is `gap-5` — the one sanctioned
   exception, because a dialog is a tighter column. Never one gap for
   everything.
7. Page padding is `p-4 space-y-4`, or `p-4 md:p-6 space-y-6` for a
   dashboard. Nothing else.
8. Placeholder is an example, never a label.
9. Errors come from `aria-invalid`, never a colour class.
10. Numbers get `tabular-nums`; technical values get `font-mono`.
11. Icon-only buttons get both `aria-label` and a `Tooltip`.
12. Empty table and empty result are different states with different exits.
13. A table is paginated.
14. **Layout does not overflow at any width.** `bun run test:browser`
    checks every page at seven widths in a real browser.
15. **Every interactive control shows a `cursor: pointer` and reacts to
    hover.** Also checked by `bun run test:browser`. Tailwind v4 removed
    preflight's pointer cursor on buttons, so this is restored once in
    `main.css`, not per component.
16. **A Menu expands; a View navigates. Never both.** Enforced by
    `tests/browser/navigation.spec.ts`, which asserts that clicking a Menu
    leaves the URL unchanged.

Full text with reasoning and examples: [`docs/principles.md`](./docs/principles.md).

## Hard constraints

- **Company topbar.** Every page keeps `AppTopbar` with a prominent, centred
  company-name banner. Read the name from `src/config/brand.ts`; use semantic
  tokens for its framing and colour. No English subtitle. Long names wrap
  on mobile and never overlap controls or overflow.

- **No hard-coded colours.** Every colour resolves through a semantic token
  in `src/assets/main.css`. `bg-red-500` breaks dark mode.
- **Type floor.** Nothing renders below 14px; key text — page title, card
  and section labels, the brand, nav items, table headers — starts at 16px.
  `text-xs` is overridden to 14px in `main.css` and a guard rejects any
  literal below the floor.
- **Do not hand-write a primitive** that shadcn-vue provides. Add it with
  the CLI. `components/ui/` is registry-managed.
- **Pure logic goes in `src/lib/`**, with a test next to it. If you are
  writing a loop with a condition inside a `.vue` file, it belongs in `lib/`.
- **Async writes are awaited.** The stores return promises on purpose; an
  un-awaited call is a race, not a shortcut.
- **No `window`/`document` at module scope or in setup.** Guards
  server-render components.
- **Do not push.** Local commits only.

## Where to look

| Need                                 | File                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| A page with a table and CRUD         | `src/components/data/ResourceListView.vue`                        |
| A resource page (spec + API calls)   | `src/views/library/BooksView.vue`                                 |
| A form                               | `src/components/rbac/ResourceFormDialog.vue`                      |
| A table + pagination                 | `src/components/data/DataPagination.vue`                          |
| A sidebar entry or collapsible group | `src/lib/nav.ts`, `src/components/layout/SidebarMenuGroup.vue`    |
| Pure rules + tests                   | `src/lib/resource.ts`, `src/lib/rbac.ts`, `src/lib/pagination.ts` |
| The visual system                    | `src/assets/main.css`                                             |
| How the rules are enforced           | `src/lib/design-system.test.ts`                                   |

## Adding a page, in four steps

1. `src/views/<Name>View.vue`. A **resource page** is its spec plus three
   API calls, and renders `ResourceListView` — see
   `src/views/library/BooksView.vue`. Anything else starts from the skeleton
   in [`docs/workflow.md`](./docs/workflow.md#adding-a-page): `PageHeader`
   first, `p-4 space-y-4` container.
2. Route in `src/router/index.ts`, lazy, with `meta.title`.
3. Nav entry in `src/lib/nav.ts` — a **View** if the page navigates, a
   **Menu** if it groups pages. See
   [`docs/navigation.md`](./docs/navigation.md).
4. `bun run test` — the guards tell you what you missed.

## Known traps

`parseDate` throws on impossible dates. `renderToString` is async. Dialog
content teleports to `document.body` (assert it there). A component using
`Tooltip` needs `TooltipProvider` in the test tree. Tailwind v4 has no
config file. `h-dvh`, not `h-screen`.

Three that cost real debugging time:

- **`v-model` on `<input type="number">` returns a number.** Type the field
  `string | number` and normalise before calling string methods on it.
- **`AlertDialogAction` closes the dialog before your `@click` runs**, so
  state your handler reads may already be cleared. Use a plain `Button` and
  close the dialog yourself.
- **Every `<form>` needs `novalidate`.** The browser's own validation
  (`type="email"`, `type="number"` with an unreachable `step`) blocks the
  submit **without firing `submit`**, so your handler never runs and the
  button looks dead. Nothing surfaces it: no request, no message, no console
  output. Our own checks (`validateResource`, or the page's `computed`) say
  what is wrong; the browser's do not.
- **A `<input type="number">` rejects any value its `step` cannot reach, and
  a form that fails HTML5 validation never fires `submit`.** A `numeric`
  column holding decimals needs `step: 0.01` in its spec, or the only symptom
  is a 保存 button that does nothing at all.
- **`min-w-0` on every flex item** whose content can be wide; without it a
  row does not shrink and the page scrolls sideways.

And one about Tailwind v4: it removed preflight's `cursor: pointer` on
buttons. The restoration lives in `main.css` — do not add `cursor-pointer`
to individual components.

Full list in [`docs/workflow.md#traps`](./docs/workflow.md#traps).
