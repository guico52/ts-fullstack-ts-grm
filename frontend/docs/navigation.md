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

---

## 它现在由服务端决定

侧栏里有什么、以及**路由表里有什么**，都来自同一个答案：登录后前端请求
`GET /auth/me/access`，服务端按这个人的角色返回可访问的视图。

```
/auth/me/access → { views: [...], permissions: [...] }
        │
        ├─→ stores/access.ts 的 navEntries  ──→  侧栏
        └─→ registerAccessRoutes()           ──→  router.addRoute
```

**一份数据两个用途，就不可能出现"菜单上有、点进去 404"。** 这也是为什么
`lib/nav.ts` 里那张写死的 `NAV_ENTRIES` 被删掉了——它是第二份导航真相，而真相
在服务端。`lib/nav.ts` 现在只剩类型和三条规则（`isMenu` / `isActivePath` /
`menuContaining`）。

**未授权与不存在都落 404。** 一个已登录的用户不该能区分"这个页面不是你的"和
"这个页面不存在"——那个区别不是他需要知道的，而区分开就等于泄露了系统里有什么。

### 三件容易忘的事

- **刷新之后路由表是空的。** 会话还在 `localStorage`，动态路由却随页面一起没了。
  守卫在这种情况下会先取一次 access、把路由登记上、再重新解析同一个地址。它不会
  循环：第二遍看到 `loaded === true` 就放行。
- **退出必须撤掉动态路由。** 否则换一个权限更小的账号登进来，上一个人的页面还留
  在路由表里，守卫会放行——因为已登录——页面渲染出来后才被后端一个个 403。
  `clearAccessRoutes()` 就是干这个的。
- **登录后落的不是 `/`。** 落点是"第一个可访问的页面"（`access.landingPath`）。
  写死 `/` 会把一次成功的登录变成一次 404，只要那个用户没有总览的权限。

### 页面地址由数据决定

一个视图的可达地址是它在 `sys_view.path` 里的值，不是从组件名推导的。所以改一个
页面的地址是**改数据**，不是改代码——而 `views-catalog` 推导出来的那个
`/xxx-view` 只在表单里当默认值用。
