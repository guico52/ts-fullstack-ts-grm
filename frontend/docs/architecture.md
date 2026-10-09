# Architecture

## Layout

```
src/
├── assets/main.css        Tokens, both themes, base layer, glass utility
├── config/brand.ts        Company title, default image URL, project name/font
├── components/
│   ├── ui/                shadcn-vue primitives — registry-managed, do not hand-edit*
│   ├── layout/            App chrome: PageHeader, SectionHeader, sidebar, topbar
│   ├── data/              Presentation primitives: StatCard, DataPagination
│   ├── charts/            ECharts shells: LineChart, PieChart, BarChart, GeoChart
│   └── orders/            The reference feature: filters, form dialog, date field
├── lib/                   Pure logic + its tests. No Vue, no Pinia.
├── stores/                Pinia stores (app state)
├── router/index.ts        Route table; one lazy view per path
├── views/                 One component per route
├── App.vue                The shell: provider + sidebar + topbar + <RouterView>
└── main.ts                createApp, pinia, router, theme boot
```

\* Editing `components/ui/` is allowed, but it is a fork. Prefer passing a
`class` or wrapping the component. Re-run the registry command only when you
mean to take the upstream version.

---

## The dependency direction

```
views  ──▶  components/orders  ──▶  components/data  ──▶  components/ui
  │                │                      │
  └────────────────┴──────────────────────┘
                   ▼
                stores  ──▶  lib
                              ▲
                              └── (pure, imports nothing of ours)
```

Read it as: **arrows point down, and `lib` is at the bottom.**

Rules that follow from it:

- `lib/` imports no Vue, no Pinia, no component. It may import a pure
  third-party library (`@internationalized/date` is fine; `vue` is not).
- `components/data/` takes props and emits events. **No store, no router** —
  a guard fails the check otherwise.
- `stores/` may import `lib/`. Stores hold state and orchestrate; they do
  not render.
- `views/` composes the page — chrome, feature components, layout.
  It is where the pieces meet, but not the only place that may hold state.

**Why the split matters for how you get edited.** The interesting mistakes
live in the bottom two layers, and those are testable without a browser. The
top layer is deliberately thin so there is less of it to get wrong.

---

## Where does this code go?

| The code…                                                   | Goes in                                | Example                                        |
| ----------------------------------------------------------- | -------------------------------------- | ---------------------------------------------- |
| Decides something (filter, sort, validate, format, clamp)   | `lib/<domain>.ts`                      | `filterOrders`, `pageWindow`, `validateMember` |
| Holds state, coordinates mutations                          | `stores/<domain>.ts`                   | `useOrdersStore`                               |
| Renders a reusable piece of UI with no knowledge of the app | `components/data/` or `components/ui/` | `StatCard`, `DataPagination`                   |
| Renders a piece of one feature, and may own its state       | `components/<feature>/`                | `OrderFormDialog`                              |
| Renders a route                                             | `views/<Name>View.vue`                 | `OrdersView.vue`                               |
| Is a colour, size, radius or duration                       | `assets/main.css`                      | `--chart-3`                                    |

**Smell test:** if you are writing a loop with a condition inside a `.vue`
file, it belongs in `lib/`. If you are writing a `fetch` inside a component,
it belongs in a store (and eventually a query layer).

---

## State

The stores are deliberately small:

| Store                | Holds                                 | Persisted                                                              |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| `theme`              | colour mode + accent                  | yes (`vat-theme`, `vat-accent`)                                        |
| `ui`                 | sidebar collapsed, mobile drawer open | collapsed + closed Menus (`vat-sidebar-collapsed`, `vat-closed-menus`) |
| `orders` / `members` | the demo data                         | no                                                                     |

**Only persist what should survive a reload.** The mobile drawer is
deliberately not persisted — restoring it would open an overlay over a page
the user never asked to cover.

**Read storage through `lib/storage.ts`.** It swallows the exception that
private mode and blocked cookies throw; a preference that fails to save
should still apply for the session, not crash a toggle.

---

## SSR safety

The guards server-render components with `@vue/server-renderer`, and
`main.ts` runs the theme boot before mount. Both mean: **do not touch
`window` or `document` at module scope or in a component's setup.**

```ts
// Yes
globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false

// No — throws during SSR and in the guard tests
window.matchMedia("(prefers-color-scheme: dark)").matches
```

DOM work belongs in an effect or an event handler, where it only runs in a
browser.

---

## Naming

| Kind           | Convention                         | Example                  |
| -------------- | ---------------------------------- | ------------------------ |
| Component file | `PascalCase.vue`                   | `PageHeader.vue`         |
| View           | `<Name>View.vue`                   | `OrdersView.vue`         |
| Store          | `use<Name>Store`                   | `useOrdersStore`         |
| Pure module    | `camelCase.ts`, named exports      | `lib/pagination.ts`      |
| Test           | `<unit>.test.ts`, next to the unit | `lib/orders.test.ts`     |
| Type           | `PascalCase`                       | `OrderDraft`, `PageSize` |

Prefer **named exports** in `lib/` — they keep imports honest and make the
guard's source scanning unambiguous.

---

## Router

Routes are lazy (`() => import(...)`), so a view's dependencies stay out of
the first load. `meta.title` names the route; the page still renders its
own `PageHeader`, which remains the single source of the `<h1>`.

Adding a route is two edits: `src/router/index.ts` and `src/lib/nav.ts`
(the sidebar). The nav table is the sidebar's only source, so a page's name
can never disagree with the link that opens it.

---

## What is deliberately not here

Data fetching, auth, i18n, a mock API, server-side sorting, and URL-backed
filter state.

Each is a decision that depends on your backend. A scaffold that guesses is
harder to delete than to add. The RBAC pages are the seam: they call the
backend directly through `src/lib/api.ts`, and the shape of a page does not
change when the endpoints behind it do.

When you add a data layer, keep the direction intact: a `lib/` module for
the shaping logic, a store (or query layer) for the async part, and nothing
but props in the components.
