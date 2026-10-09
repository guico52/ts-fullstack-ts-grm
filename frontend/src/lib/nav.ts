import type { Component } from "vue"

/**
 * The navigation tree, as types and rules.
 *
 * **There is no static entry table here any more.** The tree is built from what
 * the server says the signed-in user may reach — see `lib/access.ts`. Keeping a
 * second, hard-coded copy of the navigation was the one way the two could
 * disagree, and the symptom is a menu item that leads to a 404.
 *
 * Two kinds of entry, and the distinction is behavioural:
 *
 * - **View** — a leaf that navigates when clicked.
 * - **Menu** — a parent that expands and collapses, and never navigates on
 *   its own. A parent that both opens and navigates is the classic way to
 *   make a sidebar feel unpredictable: the user cannot tell whether a click
 *   will move them or reveal something.
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
 * True when `to` is the current location, or an ancestor of it.
 *
 * "/" must match exactly; everything else matches by prefix so a child
 * route keeps its parent lit.
 */
export function isActivePath(to: string, path: string): boolean {
  return to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`)
}

/** The Menu a path belongs to, if any. */
export function menuContaining(path: string, entries: readonly NavEntry[]): NavMenu | undefined {
  return entries
    .filter(isMenu)
    .find((menu) => menu.children.some((child) => isActivePath(child.to, path)))
}
