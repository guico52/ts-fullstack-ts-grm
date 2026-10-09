import { markRaw, type Component } from "vue"
import { Building2, KeyRound, LayoutDashboard, LayoutList, Shield, ShieldCheck, Users } from "@lucide/vue"

/**
 * The navigation tree.
 *
 * Two kinds of entry, and the distinction is the point:
 *
 * - **View** — a leaf that navigates when clicked.
 * - **Menu** — a parent that expands and collapses, and never navigates on
 *   its own. A parent that both opens and navigates is the classic way to
 *   make a sidebar feel unpredictable: the user cannot tell whether a click
 *   will move them or reveal something.
 *
 * One table feeds the sidebar, so a page's name can never disagree with the
 * link that opens it.
 */
export interface NavView {
  kind: "view"
  title: string
  to: string
  icon: Component
  description: string
}

export interface NavMenu {
  kind: "menu"
  /** Stable key for the persisted expanded/collapsed state. */
  id: string
  title: string
  icon: Component
  description: string
  children: NavView[]
}

export type NavEntry = NavView | NavMenu

export function isMenu(entry: NavEntry): entry is NavMenu {
  return entry.kind === "menu"
}

/**
 * markRaw: an icon is a component, not state. Wrapping it in a reactive
 * proxy would make Vue track it for no reason and warn in dev.
 */
export const NAV_ENTRIES: NavEntry[] = [
  {
    kind: "view",
    title: "总览",
    to: "/",
    icon: markRaw(LayoutDashboard),
    description: "概览与指标",
  },
  {
    kind: "menu",
    id: "system",
    title: "系统管理",
    icon: markRaw(Shield),
    description: "组织、用户、视图、角色与权限",
    children: [
      {
        kind: "view",
        title: "组织",
        to: "/system/organizations",
        icon: markRaw(Building2),
        description: "组织单位",
      },
      {
        kind: "view",
        title: "用户",
        to: "/system/users",
        icon: markRaw(Users),
        description: "用户与所属组织",
      },
      {
        kind: "view",
        title: "视图",
        to: "/system/views",
        icon: markRaw(LayoutList),
        description: "菜单、页面与按钮",
      },
      {
        kind: "view",
        title: "角色",
        to: "/system/roles",
        icon: markRaw(ShieldCheck),
        description: "用户、视图与权限的绑定",
      },
      {
        kind: "view",
        title: "权限",
        to: "/system/permissions",
        icon: markRaw(KeyRound),
        description: "最小授权单元",
      },
    ],
  },
]

/**
 * True when `to` is the current location, or an ancestor of it.
 *
 * "/" must match exactly; everything else matches by prefix so a child
 * route keeps its parent lit.
 */
export function isActivePath(to: string, path: string): boolean {
  return to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`)
}

/** The Menu a path belongs to, if any. */
export function menuContaining(
  path: string,
  entries: readonly NavEntry[] = NAV_ENTRIES,
): NavMenu | undefined {
  return entries
    .filter(isMenu)
    .find((menu) => menu.children.some((child) => isActivePath(child.to, path)))
}
