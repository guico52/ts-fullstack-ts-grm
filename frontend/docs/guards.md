# Guards

Conventions that live only in a README decay. Every rule in
[principles.md](./principles.md) that could be checked mechanically _is_
checked mechanically, and the build fails when it is broken.

```bash
bun run test        # all guards + rules + interactions
```

A failing guard names the offending file:

```
AssertionError: expected [ 'views/BadView.vue' ] to deeply equal []
```

---

## Where they are

| File                            | Layer                                                                  |
| ------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/design-system.test.ts` | Source scanning, SFC AST, SSR rendering                                |
| `src/lib/*.test.ts`             | Pure rules                                                             |
| `src/components/**/*.test.ts`   | Interactions (happy-dom, per-file)                                     |
| `eslint.config.js`              | Template mistakes: `v-for` without a key, `v-html`, `flat/recommended` |

The design-system guards run in **node with no DOM** — deliberately. They
read files and server-render; neither needs a browser, and a fast guard is
one that actually runs.

---

## Three techniques

### 1. Source scanning

Read `.vue` files and assert with regex. Framework agnostic, and enough for
"does every view import PageHeader".

```ts
const offenders = vueSources("views")
  .filter((v) => !/from ["']@\/components\/layout\/PageHeader\.vue["']/.test(v.text))
  .map((v) => v.path)
expect(offenders).toEqual([])
```

**Always assert the offender list is empty, not that the count is small.**
The failure message then names the file, which is the entire value.

### 2. SFC AST

`@vue/compiler-sfc`'s `parse()` gives a real template AST. This is where
regex breaks down:

```vue
<template>
  <!-- <h2>commented out</h2> -->
  <p>{{ "<h2>inside a string</h2>" }}</p>
  <CardTitle>Real component</CardTitle>
</template>
```

A regex reports three `<h2>`-ish hits. The AST reports
`["section", "p", "CardTitle"]` and can tell a component from a DOM tag.

### 3. Server rendering

`@vue/server-renderer`'s `renderToString` turns a component into HTML you
can assert on. This catches what source scanning cannot — an
`aria-labelledby` that no longer points at the heading it claims to.

```ts
const html = await renderToString(h(StatCard, { label: "Total", value: "12" }))
expect(html).toContain("tabular-nums")
```

---

## Putting it together: the type floor

The type floor (nothing below 14px, key text from 16px) uses all three at
once. The pixel value of every scale step is **read out of `main.css`**,
every source file is scanned for a literal that resolves below the floor,
and the key components are pinned so they cannot quietly drop a rank.

```ts
for (const match of read("assets/main.css").matchAll(/--text-(\w+):\s*([\d.]+)rem/g)) {
  scale[match[1]!] = parseFloat(match[2]!) * 16
}
```

That is what makes the rule a mechanism instead of a comment: setting
`--text-xs` back to 12px fails the check, so the floor lives in one place
and the guard watches that place.

The same floor applies inside a canvas. ECharts inherits nothing from the CSS
type scale — its own default is 12px — so `lib/chart-theme.test.ts` walks every
chart option and asserts that no `fontSize` in it is below 14px.

---

## Adding a guard

Copy the shape:

```ts
// ---------------------------------------------------------------------------
describe("<the rule, in plain words>", () => {
  it("the rule is actually watching something", () => {
    // A guard that matches no file passes for the wrong reason and then
    // quietly stops protecting anything. This assertion is not optional.
    expect(vueSources("views").length).toBeGreaterThan(0)
  })

  it("<what must be true>", () => {
    const offenders = vueSources("views")
      .filter((v) => /* the violation */)
      .map((v) => v.path)
    expect(offenders).toEqual([])
  })
})
```

Then **verify it can fail.** Add a file that breaks the rule, run the tests,
confirm the guard names it, delete the file. A guard you have never seen
fail is a comment with extra steps.

```bash
cat > src/views/TempBad.vue <<'EOF'
<template><Table><TableBody /></Table></template>
EOF
bunx vitest run src/lib/design-system.test.ts   # must fail
rm src/views/TempBad.vue
```

---

## Known traps

All of these were found by running the tests, not by thinking about them.

**`renderToString` is async.** Every render assertion needs `await`. React's
`renderToStaticMarkup` is synchronous; this is not.

**Slot content is wrapped in comment markers.** Assert:

```ts
expect(html).toMatch(/<h2[^>]*>[\s\S]*?Overview[\s\S]*?<\/h2>/)
```

not `toContain("<h2>Overview</h2>")`.

**A component that injects a context needs its provider in the test tree.**
Mounting `OrdersView` alone fails with
`Injection Symbol(TooltipProviderContext) not found`, because the row actions
are wrapped in `Tooltip`. Wrap it:

```ts
mount({ render: () => h(TooltipProvider, null, { default: () => h(OrdersView) }) })
```

**Dialogs teleport.** Assert their content on `document.body`, where it
actually lands, not inside the wrapper.

**Use one pinia instance** for both the test's store handle and the mounted
tree. Two instances pass by accident on identical seed data.

**`grep -c` counts lines, and a minified bundle is one line.** Use
`grep -o … | wc -l` when counting occurrences in `dist/`.

---

## Layer 4: the browser

`tests/browser/` runs in a real browser via Playwright. This is the only
layer that can see layout, and it is where the overflow rule (principle 14)
lives.

```bash
bun run test:browser        # builds, serves, and drives Chromium
bun run test:browser:run    # uses an existing dist/; useful for test-only edits
```

Browser cases run independently with four workers locally and two on CI.
The preview server serves static assets; stores and localStorage are isolated
in each test's browser context. See [Playwright isolation](https://playwright.dev/docs/browser-contexts).

Use `gotoPage` from `tests/browser/helpers.ts` before inspecting the DOM or
measuring layout. It waits for the route heading, fonts and a rendering frame.
Do not use `networkidle`: it adds a 500ms quiet period to every navigation and
does not express whether the UI is ready. See
[Playwright load states](https://playwright.dev/docs/api/class-page#page-wait-for-load-state).
Hover checks await finite animations with `settleTransitions`, then compare
their final styles; fixed sleeps can measure mid-transition or waste time.

Component tests unmount their wrappers after each case. The pagination test
that removes rows uses fake timers to advance the demo store's 400ms latency,
while still awaiting each write. Browser lifecycle tests retain real latency
to verify controls during an in-flight request.

The overflow check walks every element on the page and reports anything
whose right edge crosses the viewport:

- `position: fixed` and portal content (tooltips, popovers, toasts,
  dialogs) are skipped — they are allowed to sit anywhere.
- Content inside a horizontally scrollable ancestor is skipped: a wide
  table is _meant_ to be wider than its box. The box itself is still
  measured, so a scroll container that escapes the viewport is caught.
- 1px helpers (`sr-only`) and hidden elements are skipped.

End-to-end flows live here too (`tests/browser/orders.spec.ts`): create,
edit and delete through the real UI. They exist because a component test can
prove a dialog opens and a validator returns an error map, and still miss a
submit handler that throws before it adds anything.

`tests/browser/interaction.spec.ts` covers affordance: every interactive
control's computed cursor, and whether it visibly changes on hover. Neither
signal exists in a component test — happy-dom computes no styles, cascades
nothing and has no cursor.

The CSS rule that satisfies it lives in `main.css` under `@layer base`, not
in the components. That is deliberate: a primitive pulled from the registry
later cannot forget it, and the base layer still loses to a utility, so
`cursor-default` wins on the rare element where a hand is wrong.

**Calibrate the detector against a real failure.** Disable a fix, watch the
test go red, put it back. A layout or affordance assertion you have never
seen fail might be measuring nothing. Reverting the cursor rule fails all
five pages with counts per page, which is how you know it is looking.

---

## What is _not_ guarded

Being honest about the gaps is part of the design:

- **Arbitrary colour values.** A guard rejects `text-white` / `text-black`,
  but nothing stops `bg-red-500` or every other literal in a component.
  A general stylelint pass is not present.
- **Where a size is used, not just which ones exist.** The floor is
  guarded — no scale step below 14px, no literal below it, key files must
  offer a 16px step — but nothing stops `text-xl` appearing where `text-lg`
  was meant.
- **Visual regressions.** No screenshot diffing. Overflow and hover
  affordance are checked; a colour that shifted by two degrees is not.
- **Component behaviour** beyond what the interaction tests in
  `src/components/**` and the flows in `tests/browser/**` happen to cover.
- **Vertical overflow** — a page may scroll down as far as it likes. Only
  the horizontal axis is constrained.

If you add one of these, document it here so the list stays true.
