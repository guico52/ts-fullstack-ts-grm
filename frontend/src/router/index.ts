import { createRouter, createWebHistory } from "vue-router"

/**
 * Routes are lazy so a view's dependencies (tables, dialogs, editors) stay
 * out of the first load. `meta.title` names the route; the page itself still
 * renders its own PageHeader, which is the single source of the <h1>.
 *
 * Every navigable page appears in `src/lib/nav.ts` too — the sidebar reads
 * that table, and a route missing from it is a page nobody can reach.
 */
export const routes = [
  {
    path: "/",
    name: "dashboard",
    component: () => import("@/views/DashboardView.vue"),
    meta: { title: "总览" },
  },
  {
    path: "/system/organizations",
    name: "system-organizations",
    component: () => import("@/views/system/OrganizationsView.vue"),
    meta: { title: "组织" },
  },
  {
    path: "/system/users",
    name: "system-users",
    component: () => import("@/views/system/UsersView.vue"),
    meta: { title: "用户" },
  },
  {
    path: "/system/views",
    name: "system-views",
    component: () => import("@/views/system/ViewsView.vue"),
    meta: { title: "视图" },
  },
  {
    path: "/system/roles",
    name: "system-roles",
    component: () => import("@/views/system/RolesView.vue"),
    meta: { title: "角色" },
  },
  {
    path: "/system/permissions",
    name: "system-permissions",
    component: () => import("@/views/system/PermissionsView.vue"),
    meta: { title: "权限" },
  },
  {
    // Catch-all, last on purpose: anything above wins. An unmatched URL
    // otherwise renders the shell with an empty main area, which reads as
    // a broken app rather than a wrong address.
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("@/views/NotFoundView.vue"),
    meta: { title: "页面不存在" },
  },
] as const

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
