import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router"

import { VIEW_TYPE, type AccessView } from "@/lib/access"
import { findComponent } from "@/lib/views-catalog"

declare module "vue-router" {
  interface RouteMeta {
    /** 文档标题。 */
    title: string
    /** `"bare"` = 不套侧栏与顶栏的 shell。目前只有登录页用它。 */
    layout?: "bare"
  }
}

/**
 * Routes are added in two waves.
 *
 * Only the two pages that must exist before anyone signs in are declared here:
 * the login page, and the catch-all. **Everything else is registered after the
 * server answers "what may this user reach"** — so a page nobody granted is not
 * a page that renders a "forbidden" screen, it is a page that does not exist in
 * this router at all. The catch-all turns it into "页面不存在", which is also
 * what an unknown URL gets: a signed-in user cannot tell "not yours" from "not
 * here", because the difference is not theirs to know.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/LoginView.vue"),
    meta: { title: "登录", layout: "bare" },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("@/views/NotFoundView.vue"),
    meta: { title: "页面不存在" },
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

/** Names added in the second wave, so signing out can take them back out. */
let registered: string[] = []

/**
 * 把可达的页面登记成路由，返回登记了几个。
 *
 * 找不到组件的**跳过**：服务端指向的文件可能已被删掉或改名，那种情况下让它
 * 落进 404 比让整个导航崩掉好。
 */
export function registerAccessRoutes(views: readonly AccessView[]): number {
  clearAccessRoutes()

  let added = 0
  for (const view of views) {
    if (view.type !== VIEW_TYPE.VIEW || !view.path || !view.componentName) continue

    const component = findComponent(view.componentName)
    if (!component) continue

    const name = `access-${view.id}`
    router.addRoute({
      path: view.path,
      name,
      component: component.load,
      meta: { title: view.name },
    })
    registered.push(name)
    added++
  }
  return added
}

/** 登出时撤掉，否则换一个权限更小的账号会看到上一个人的页面。 */
export function clearAccessRoutes(): void {
  for (const name of registered) {
    if (router.hasRoute(name)) router.removeRoute(name)
  }
  registered = []
}
