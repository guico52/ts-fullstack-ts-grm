import { markRaw, type Component } from "vue"
import { LayoutList } from "@lucide/vue"

import { findIcon } from "@/config/icons"
import type { NavEntry, NavMenu, NavView } from "./nav"

/**
 * The server's answer to "what may this user reach".
 *
 * The type lives here rather than in the store so that `nav.ts` can build the
 * sidebar from it without importing the store, and the store can import this
 * without importing the sidebar's tree.
 */
export interface AccessView {
  id: string
  name: string
  icon: string
  path: string | null
  componentPath: string | null
  componentName: string | null
  type: string
  parentId: string | null
  sort: number
}

/** The three levels. A page hangs off a menu (or stands alone); a button is a grant point. */
export const VIEW_TYPE = { MENU: "MENU", VIEW: "VIEW", BUTTON: "BUTTON" } as const

/** 服务器上的图标是名字，侧栏要的是组件。取不到就退回一个中性的。 */
function iconOf(name: string): Component {
  return markRaw(findIcon(name) ?? LayoutList)
}

/** 只有页面能进侧栏——菜单是分组，按钮是授权点，两者都不是可点开的路由目标。 */
function routable(views: readonly AccessView[]): AccessView[] {
  return views
    .filter((view) => view.type === VIEW_TYPE.VIEW && view.path !== null)
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
}

/**
 * 把服务端的视图列表变成侧栏用的树。
 *
 * **侧栏的内容全部来自这里**，不再有一份写死的导航表。一份静态表加一份
 * 服务端列表，两边迟早会不一致，而不一致的表现是"菜单上有、点进去 404"。
 *
 * 一个页面若其菜单不在可访问集合里（或者根本没有菜单），它会作为顶层项出现，
 * 而不是消失：页面本身是可达的，藏起来等于把一个有权访问的东西变成看不见。
 */
export function navEntriesFrom(views: readonly AccessView[]): NavEntry[] {
  const pages = routable(views)
  const menus = views.filter((view) => view.type === VIEW_TYPE.MENU).sort((a, b) => a.sort - b.sort)

  const toView = (view: AccessView): NavView => ({
    kind: "view",
    title: view.name,
    to: view.path ?? "/",
    icon: iconOf(view.icon),
    description: view.name,
  })

  const taken = new Set<string>()
  const entries: NavEntry[] = []
  const sortOf = new Map<string, number>()

  for (const menu of menus) {
    const children = pages.filter((page) => page.parentId === menu.id)
    if (children.length === 0) continue
    for (const child of children) taken.add(child.id)

    const entry: NavMenu = {
      kind: "menu",
      id: `view-${menu.id}`,
      title: menu.name,
      icon: iconOf(menu.icon),
      description: menu.name,
      children: children.map(toView),
    }
    sortOf.set(entry.id, menu.sort)
    entries.push(entry)
  }

  // 剩下的是没有归属的页面：没有上级，或者上级菜单不在集合里。它们和菜单是
  // 同一层的兄弟，**用各自的 sort 参与排序**。把它们一律排到最后会让「总览」
  // （一个顶层页面）跑到「系统管理」后面，而它在库里的 sort 是 1。
  for (const page of pages) {
    if (taken.has(page.id)) continue
    const entry = toView(page)
    sortOf.set(entry.to, page.sort)
    entries.push(entry)
  }

  return entries.sort((a, b) => {
    const left = sortOf.get(a.kind === "menu" ? a.id : a.to) ?? Number.MAX_SAFE_INTEGER
    const right = sortOf.get(b.kind === "menu" ? b.id : b.to) ?? Number.MAX_SAFE_INTEGER
    return left - right || keyOf(a).localeCompare(keyOf(b))
  })
}

/** 同名 sort 时的稳定次序：菜单用 id，页面用路径。 */
function keyOf(entry: NavEntry): string {
  return entry.kind === "menu" ? entry.id : entry.to
}
