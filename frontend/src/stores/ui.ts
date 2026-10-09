import { computed, ref } from "vue"
import { defineStore } from "pinia"

import { isMenu, menuContaining, NAV_ENTRIES } from "@/lib/nav"
import { readFlag, readStringArray, writeFlag, writeStringArray } from "@/lib/storage"

const COLLAPSED_KEY = "vat-sidebar-collapsed"
const CLOSED_MENUS_KEY = "vat-closed-menus"

/**
 * Shell state: the sidebar rail, the mobile drawer, and which navigation
 * Menus are collapsed.
 *
 * Only the persisted parts are stored. The mobile drawer is deliberately
 * transient — restoring it would open an overlay over a page the user never
 * asked to cover.
 */
export const useUiStore = defineStore("ui", () => {
  const sidebarCollapsed = ref(readFlag(COLLAPSED_KEY, false))
  const mobileNavOpen = ref(false)

  /**
   * Menus the user has **closed**, not the ones that are open.
   *
   * Storing the closed set means a Menu added later starts expanded: a new
   * section is discoverable by default rather than invisible until the user
   * happens to guess it exists.
   */
  const closedMenus = ref<string[]>(readStringArray(CLOSED_MENUS_KEY))

  function isMenuOpen(id: string): boolean {
    return !closedMenus.value.includes(id)
  }

  function toggleMenu(id: string) {
    closedMenus.value = isMenuOpen(id)
      ? [...closedMenus.value, id]
      : closedMenus.value.filter((closed) => closed !== id)
    writeStringArray(CLOSED_MENUS_KEY, closedMenus.value)
  }

  /**
   * Opens the Menu a route belongs to. Called on navigation: landing on
   * /orders with its parent collapsed leaves the user staring at a sidebar
   * that does not show where they are.
   */
  function revealPath(path: string) {
    const menu = menuContaining(path)
    if (!menu || isMenuOpen(menu.id)) return
    closedMenus.value = closedMenus.value.filter((closed) => closed !== menu.id)
    writeStringArray(CLOSED_MENUS_KEY, closedMenus.value)
  }

  /** Ignored on small screens: there the sidebar is a drawer, and
   *  "collapsed to icons" has no meaning for a surface that is either open
   *  or closed. */
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    writeFlag(COLLAPSED_KEY, sidebarCollapsed.value)
  }

  function setMobileNav(open: boolean) {
    mobileNavOpen.value = open
  }

  const sidebarWidth = computed(() => (sidebarCollapsed.value ? "4rem" : "15rem"))

  /** Entries with at least one Menu, for the guard that keeps the demo honest. */
  const hasMenus = computed(() => NAV_ENTRIES.some(isMenu))

  return {
    sidebarCollapsed,
    mobileNavOpen,
    closedMenus,
    hasMenus,
    sidebarWidth,
    isMenuOpen,
    toggleMenu,
    revealPath,
    toggleSidebar,
    setMobileNav,
  }
})
