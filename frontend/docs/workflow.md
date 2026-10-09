# Workflow

## Commands

```bash
bun dev                 # dev server on :5173
bun run check           # everything below, in order — use this by default
bun run typecheck       # vue-tsc, no emit
bun run lint            # prettier --check && eslint .
bun run test            # guards + rules + interactions
bun run test:watch
bun run test:browser    # overflow, affordance, navigation, flows
bun run test:browser:run # browser tests against an already-built dist/
bun run build           # typecheck + production build
bun run preview         # serve dist/
```

`check` is the gate: `typecheck && lint && test && vite build && test:browser:run`.
It typechecks and builds once. The standalone `build` command also typechecks;
`test:browser` uses it to verify a fresh production bundle.

The first browser run needs a binary once:

```bash
bunx playwright install chromium
```

Adding a shadcn-vue primitive:

```bash
bunx shadcn-vue@latest add <name> --yes --overwrite
```

**Run the gate before calling anything done:** `bun run check`.

`test` is fast and covers logic; `test:browser` builds and drives a real
Chromium, so it is slower but it is the only layer that can see layout. A
change to spacing, widths or a form is not verified until the browser tests
have run.

For test-only edits, build once and then use
`bun run test:browser:run tests/browser/navigation.spec.ts` to iterate without
rebuilding. If application code changes, run `bun run test:browser` again;
`test:browser:run` serves the existing `dist/`, which may be stale.

---

## Adding a page

1. **Create `src/views/<Name>View.vue`.** Start from this skeleton:

   ```vue
   <script setup lang="ts">
   import PageHeader from "@/components/layout/PageHeader.vue"
   </script>

   <template>
     <div class="p-4 space-y-4">
       <PageHeader title="Name" subtitle="One line about what this page is for." />
     </div>
   </template>
   ```

2. **Add the route** in `src/router/index.ts` (lazy import) with
   `meta: { title: "Name" }`.
3. **Add the nav entry** in `src/lib/nav.ts`, or the page exists but is
   unreachable.
4. **Run `bun run test`.** The guard requires `PageHeader` — if you wrote
   your own heading, it fails now rather than in review.

**The `PageHeader` is the page's only `<h1>`.** No `<h1>` anywhere else in
the view, ever. A guard checks this with the template AST.

---

## Adding a table

Follow [tables.md](./tables.md). The short version:

1. `matched` = your filtered rows (a `computed`).
2. `pageInfo = computed(() => paginate(matched.value, page.value, pageSize.value))`.
3. `watch(filters, () => { page.value = 1 })` and the clamp watcher.
4. `v-for` over `pageInfo.rows`, not over `matched`.
5. `<DataPagination>` below the table, or the guard fails.
6. Two empty states: no data vs no match.

---

## Adding a form

Follow [forms.md](./forms.md). The short version:

1. `FieldGroup` → `Field` → `FieldLabel` + control + `FieldDescription` /
   `FieldError`.
2. Write the validation as a pure function in `src/lib/` and test it there.
3. Validate on submit, live after the first attempt.
4. `aria-invalid` paints the error. Never a colour class.

---

## Adding a guard

Follow [guards.md](./guards.md#adding-a-guard). Then **prove it can fail** —
add a violating file, watch the guard name it, delete the file.

---

## Version changes

仅补充或修正文档不修改 `package.json` 的版本号，也不单独发布版本 tag。
存在 `fix`、`feat` 等代码变更时再更新版本号。文档提交独立记录，不能
因为新增说明而触发版本升级。

## Before you commit

Review [constraints.md](./constraints.md) for the complete project rules and
which ones still depend on manual review.

- [ ] `bun run check` green (typecheck, lint, unit tests, build, browser tests)
- [ ] New page has a route **and** a nav entry
- [ ] New pure logic has a test next to it
- [ ] No hard-coded colours, no `!important`, no `outline: none`
- [ ] Every new icon-only button has `aria-label` and `Tooltip`
- [ ] Any new interactive element is reachable and usable by keyboard
- [ ] If you added a rule, you also added the guard

---

## Traps

Project-specific, all of them hit at least once.

**`erasableSyntaxOnly` and `noUnusedLocals` are on.** A stray unused import
fails the build. So does an enum or a parameter property.

**TypeScript 6 removed `baseUrl`.** `paths` works without it, resolved
relative to the tsconfig file. Do not add it back.

**The shadcn-vue CLI reads `tsconfig.json` (the root one)** to resolve the
`@` alias. Keep `paths` mirrored there, not only in `tsconfig.app.json`.

**`vue-tsc -b` is incremental.** A stale `.tsbuildinfo` can hide an error
that a clean run would show; `rm -rf node_modules/.tmp` if something looks
wrong.

**Tailwind v4 has no `tailwind.config.js`.** Theme values live in
`src/assets/main.css` inside `@theme inline`. Adding a config file does
nothing.

**Tailwind v4 removed `cursor: pointer` from buttons.** Preflight used to
set it; v4 follows the browser default, which for `<button>` is `default`.
Every button in the app shows an arrow until something puts it back —
`main.css` does, in `@layer base`. Do not "fix" this per component.

**Unlayered CSS beats layered utilities.** That is why the 16px
touch-input rule in `main.css` works without `!important` — and why a
random unlayered rule you add could silently override a utility.

**`h-dvh`, not `h-screen`.** `vh` is the _largest_ viewport on mobile
Safari, so a `h-screen` shell sits under the browser bar.

**`min-h-0` on the scroll container.** Without it, a flex child refuses to
shrink and the page scrolls as a whole instead of the main area.

**`@internationalized/date`'s `parseDate` throws** on `2026-02-31` and on a
non-leap `2026-02-29`. The `try/catch` in `isIsoDate` is load-bearing.

**Minified bundles are one line.** `grep -c` counts lines; use
`grep -o … | wc -l` when inspecting `dist/`.

**`v-model` on `<input type="number">` gives you a number, not a string.**
Vue applies `.number` implicitly. Declaring the field as `string`
type-checks and then throws `amount.trim is not a function` inside the
submit handler — where the only visible symptom is a button that does
nothing. Type such fields as `string | number` and normalise before use.

**`AlertDialogAction` closes the dialog itself.** Its click fires
`update:open` before your `@click` handler runs, so any state the handler
was going to read has already been cleared by your own close handler. If
you need the target on click, use a plain `Button` and close the dialog
yourself. See `OrdersView.vue`.

**A canvas inherits nothing from the CSS.** ECharts draws to a canvas, so a
`text-sm` class on a chart container changes nothing about the type inside
it, and `var(--chart-1)` cannot be resolved at all. Both are handled once:
sizes in `lib/chart-theme.ts`, colours in `components/charts/palette.ts`.
An option written by hand elsewhere will silently render ECharts' 12px
default and a hard-coded colour that ignores the theme.

**ECharts is a big lazy chunk.** ~770kB minified on the chart route alone
(`echarts` split into its own chunk in `vite.config.ts`). It never reaches
the first load, and the size warning limit is raised rather than suppressed
per build — do not add ECharts imports to anything the shell imports.

**A component whose root renders no element drops your `class`.**
`DatePickerField` wraps `<Popover>`, which renders nothing, so
`class="w-36"` was silently lost and the trigger kept its built-in
`w-full`. Declare an explicit `class` prop and merge it with `cn()`, or use
`inheritAttrs: false` and bind `$attrs` where they belong.

**A flex item does not shrink below its content without `min-w-0`.** The
default `min-width: auto` is what turns a wide-looking row into a page that
scrolls sideways.

**No Git remote work.** This is a learning template. Local commits are
fine; do not push.
