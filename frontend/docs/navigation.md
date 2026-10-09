# Navigation

The sidebar has two entry kinds, and the difference is a behavioural
contract, not a styling choice:

|          | Behaviour                                   |
| -------- | ------------------------------------------- |
| **View** | Navigates when clicked. A leaf.             |
| **Menu** | Expands and collapses. **Never navigates.** |

**A parent that does both is the single easiest way to make a sidebar feel
unpredictable.** The user cannot tell whether a click will move them or
reveal something, so every click becomes a small gamble. Keeping the two
behaviours on separate components is what removes the guesswork.

This is pinned by `tests/browser/navigation.spec.ts` — including the
negative case: clicking a Menu must leave the URL unchanged.

---

## 添加页面

导航唯一数据源是 GET /auth/me/access。access.ts 将 SysView 的 MENU / VIEW 转成侧栏树，BUTTON 不进入侧栏。
新建 views/ 下组件后，在视图管理创建页面并选择组件，设置 path，再给角色绑定视图及资源权限。
views-catalog 自动发现组件，router 根据 componentName 注册对应路由；找不到组件不会注册。
默认路径是总览 /、系统 /system/_、图书 /library/_。详见[扩展指南](../../docs/extending.md)。

## State

Three rules, each one chosen against a specific failure:

**1. Default is expanded.** A section added later is discoverable. The
opposite (default collapsed) means a new area is invisible until the user
happens to guess it exists.

**2. What is persisted is the _closed_ set, not the open set.**

```ts
const closedMenus = ref<string[]>(readStringArray(CLOSED_MENUS_KEY))
const isMenuOpen = (id: string) => !closedMenus.value.includes(id)
```

Storing "which are open" would make every future Menu start closed, which
is the same discoverability problem in a different costume.

**3. Landing inside a closed Menu opens it.**

```ts
watch(
  () => route.path,
  (path) => ui.revealPath(path),
  { immediate: true },
)
```

Without this, following a link into a collapsed section leaves the user on
a page whose parent is shut. The sidebar then shows nothing about where
they are, which is the one thing a sidebar is for.

Storage goes through `lib/storage.ts`, which swallows the exception private
mode throws and discards anything that is not an array of strings. A
preference that fails to load costs the user their layout, not the page.

---

## The icon rail

Collapsing the sidebar to icons (a separate feature, about screen space)
raises a question the two entry kinds answer differently:

- A **View** keeps its icon and gains a tooltip.
- A **Menu** becomes a **flyout** — `DropdownMenu` — listing its children.

A 64px column cannot show a nested list, and expanding the rail on hover
would be a layout jump the user did not ask for. The flyout keeps the
children reachable without either.

A Menu whose child is the current page keeps a lit marker on the rail even
while collapsed; otherwise the rail would show no trace of the page you are
on.

---

## Accessibility

- The Menu button carries `aria-expanded` and `aria-controls` pointing at
  the group's `id`. Both are asserted by tests — not because they are hard
  to write, but because they are easy to drop during a refactor.
- `v-show`, not `v-if`, for the child group: the children stay in the DOM,
  so browsers' find-in-page and assistive tech still know they exist.
- The flyout trigger carries `aria-haspopup="menu"`.
- The active View carries `aria-current="page"`.

---

## What the tests pin

`tests/browser/navigation.spec.ts` (9 tests):

- a Menu expands, collapses, and **never changes the URL**
- `aria-controls` resolves to exactly one element
- landing inside a closed Menu opens it
- a manual collapse survives a reload
- a View navigates and expands nothing
- every sidebar link resolves to a real View — a Menu has no `href`
- the icon rail turns a Menu into a flyout with its children
- the flyout navigates
- the rail keeps the active marker for a page inside a Menu

Removing `aria-expanded` fails three of them and leaves the other six
green — the checks are independent, and each names what broke.

---

## Nesting

The tree is **two levels deep**: a Menu holds Views, and a View holds
nothing. That covers an admin sidebar, and it is what the icon rail can
still present honestly.

If you need a third level, the type already allows recursion in spirit —
but reconsider first. Deep nesting in a sidebar is usually a sign the
information architecture wants to be flat, with a section header instead.
