import { expect, type Locator, type Page } from "@playwright/test"

/** Wait for Vue's route content and actual font metrics before measuring layout.
 * @see https://playwright.dev/docs/api/class-page#page-wait-for-load-state
 */
export async function waitForPageReady(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

export async function gotoPage(page: Page, path: string) {
  await page.goto(path)
  await waitForPageReady(page)
  const titles: Record<string, string> = {
    "/": "总览",
    "/account/password": "修改密码",
    "/account/profile": "我的信息",
    "/login": "登录",
    "/system/organizations": "组织",
    "/system/users": "用户",
    "/system/views": "视图",
    "/system/roles": "角色",
    "/system/permissions": "权限",
    "/library/books": "图书",
    "/library/authors": "作者",
    "/library/stores": "书店",
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(titles[path] ?? "页面不存在")
}

/** Sample the final hover style, excluding infinite spinners. */
export async function settleTransitions(locator: Locator) {
  await locator.evaluate(async (element) => {
    const animations = element
      .getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)))
  })
}

/**
 * 一个已登录的会话。
 *
 * 路由现在**登录之后才有**：守卫先要一份可达集合，再把页面登记成路由。所以除
 * 登录页自己的测试，每个 spec 都得先伪装成已登录，否则 `gotoPage` 会被送去
 * `/login`，测的就不是它想测的东西了。
 */
export const TEST_SESSION = {
  id: "1",
  name: "测试用户",
  email: "test@example.com",
  token: "header.payload.signature",
}

/** 服务端会给的那份可达集合。内容与 seed 出来的库一致：全部页面。 */
export const TEST_ACCESS = {
  views: [
    {
      id: "22",
      name: "总览",
      icon: "LayoutDashboard",
      path: "/",
      componentPath: "views/DashboardView.vue",
      componentName: "DashboardView",
      type: "VIEW",
      parentId: null,
      sort: 1,
    },
    {
      id: "37",
      name: "系统管理",
      icon: "Shield",
      path: null,
      componentPath: null,
      componentName: null,
      type: "MENU",
      parentId: null,
      sort: 2,
    },
    {
      id: "94",
      name: "组织管理",
      icon: "Building2",
      path: "/system/organizations",
      componentPath: "views/system/OrganizationsView.vue",
      componentName: "OrganizationsView",
      type: "VIEW",
      parentId: "37",
      sort: 1,
    },
    {
      id: "95",
      name: "用户管理",
      icon: "Users",
      path: "/system/users",
      componentPath: "views/system/UsersView.vue",
      componentName: "UsersView",
      type: "VIEW",
      parentId: "37",
      sort: 2,
    },
    {
      id: "96",
      name: "视图管理",
      icon: "LayoutList",
      path: "/system/views",
      componentPath: "views/system/ViewsView.vue",
      componentName: "ViewsView",
      type: "VIEW",
      parentId: "37",
      sort: 3,
    },
    {
      id: "97",
      name: "角色管理",
      icon: "ShieldCheck",
      path: "/system/roles",
      componentPath: "views/system/RolesView.vue",
      componentName: "RolesView",
      type: "VIEW",
      parentId: "37",
      sort: 4,
    },
    {
      id: "98",
      name: "权限管理",
      icon: "KeyRound",
      path: "/system/permissions",
      componentPath: "views/system/PermissionsView.vue",
      componentName: "PermissionsView",
      type: "VIEW",
      parentId: "37",
      sort: 5,
    },
    {
      id: "422",
      name: "图书管理",
      icon: "Library",
      path: null,
      componentPath: null,
      componentName: null,
      type: "MENU",
      parentId: null,
      sort: 3,
    },
    {
      id: "423",
      name: "图书",
      icon: "BookOpen",
      path: "/library/books",
      componentPath: "views/library/BooksView.vue",
      componentName: "BooksView",
      type: "VIEW",
      parentId: "422",
      sort: 1,
    },
    {
      id: "424",
      name: "作者",
      icon: "PenLine",
      path: "/library/authors",
      componentPath: "views/library/AuthorsView.vue",
      componentName: "AuthorsView",
      type: "VIEW",
      parentId: "422",
      sort: 2,
    },
    {
      id: "425",
      name: "书店",
      icon: "Store",
      path: "/library/stores",
      componentPath: "views/library/StoresView.vue",
      componentName: "StoresView",
      type: "VIEW",
      parentId: "422",
      sort: 3,
    },
  ],
  permissions: [
    "rbac.organization.read",
    "rbac.organization.create",
    "rbac.organization.update",
    "rbac.organization.delete",
    "rbac.user.read",
    "rbac.user.create",
    "rbac.user.update",
    "rbac.user.delete",
    "rbac.user.resetPassword",
    "rbac.view.read",
    "rbac.view.create",
    "rbac.view.update",
    "rbac.view.delete",
    "rbac.role.read",
    "rbac.role.create",
    "rbac.role.update",
    "rbac.role.delete",
    "rbac.permission.read",
    "rbac.permission.create",
    "rbac.permission.update",
    "rbac.permission.delete",
    "book.book.read",
    "book.book.create",
    "book.book.update",
    "book.book.delete",
    "book.author.read",
    "book.author.create",
    "book.author.update",
    "book.author.delete",
    "book.store.read",
    "book.store.create",
    "book.store.update",
    "book.store.delete",
  ],
}

/**
 * 让后续的 `gotoPage` 落在一个已登录、且路由已登记的环境里。
 *
 * 两件事都要做：会话（守卫据此判断"有人登录"）和可达集合（路由据此登记）。
 * 会话用 `addInitScript` 写，因为它必须在每次导航前就位 —— 有的测试会 reload。
 */
export async function signIn(page: Page, access: typeof TEST_ACCESS = TEST_ACCESS) {
  await page.addInitScript((session) => {
    localStorage.setItem("vat-session", JSON.stringify(session))
  }, TEST_SESSION)
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "1",
        name: "测试用户",
        email: "test@example.com",
        mustChangePassword: false,
        organization: { id: "1", name: "示例组织" },
        roles: [{ id: "1", name: "管理员" }],
      },
    }),
  )
  await page.route("**/auth/me/access**", (route) => route.fulfill({ json: access }))
}
