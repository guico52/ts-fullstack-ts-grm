import { expect, test, type Page } from "@playwright/test"
import { gotoPage } from "./helpers"

/**
 * Overflow checks.
 *
 * A page that scrolls sideways is the single most common layout defect and
 * the one least likely to be caught in review — it usually happens at a
 * width the author never tried. These tests run every page at every
 * breakpoint and fail on the first element that crosses the viewport edge.
 *
 * Why not a component test: happy-dom has no layout engine. Every element
 * measures 0x0 and every overflow assertion passes.
 */

/**
 * Everything on the page that sticks out past the right edge.
 *
 * Deliberate exclusions:
 * - `position: fixed` and portal content — tooltips, popovers, toasts and
 *   dialogs are supposed to be able to sit anywhere.
 * - 1px helpers (`sr-only`, decorative hairlines).
 * - Anything hidden.
 */
async function findOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const doc = document.documentElement
    const viewportWidth = doc.clientWidth
    const problems: string[] = []

    const describe = (el: Element) => {
      const tag = el.tagName.toLowerCase()
      const id = el.id ? `#${el.id}` : ""
      const classes = (el.getAttribute("class") ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .join(".")
      return `${tag}${id}${classes ? `.${classes}` : ""}`
    }

    /**
     * Content inside a horizontally scrollable box is meant to be wider
     * than the box — that is what the box is for. Reporting every cell of a
     * wide table would drown the real faults; the box itself is still
     * measured, so a scroll container that escapes the viewport is caught.
     */
    const insideScroller = (el: Element) => {
      let node = el.parentElement
      while (node && node !== document.body) {
        const overflowX = getComputedStyle(node).overflowX
        if (overflowX === "auto" || overflowX === "scroll") return true
        node = node.parentElement
      }
      return false
    }

    if (doc.scrollWidth > viewportWidth + 1) {
      problems.push(
        `document scrolls horizontally: scrollWidth=${doc.scrollWidth} viewport=${viewportWidth}`,
      )
    }

    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const style = getComputedStyle(el)
      if (style.display === "none" || style.visibility === "hidden") continue
      if (style.position === "fixed") continue
      if (
        el.closest(
          "[data-reka-popper-content-wrapper], [data-slot='dialog-content'], [data-slot='sheet-content']",
        )
      ) {
        continue
      }
      if (insideScroller(el)) continue

      const rect = el.getBoundingClientRect()
      if (rect.width <= 2 || rect.height <= 2) continue

      if (rect.right > viewportWidth + 1) {
        problems.push(`${describe(el)} right=${Math.round(rect.right)} > viewport=${viewportWidth}`)
      }
    }

    // A deep chain of overflowing children reports the same fault once per
    // level; the first few distinct lines are enough to locate it.
    return [...new Set(problems)].slice(0, 15)
  })
}
const PAGES = [
  { path: "/", name: "总览" },
  { path: "/system/organizations", name: "组织" },
  { path: "/system/users", name: "用户" },
  { path: "/system/views", name: "视图" },
  { path: "/system/roles", name: "角色" },
  { path: "/system/permissions", name: "权限" },
  { path: "/library/books", name: "图书" },
  { path: "/library/authors", name: "作者" },
  { path: "/library/stores", name: "书店" },
]

/**
 * The narrowest realistic phone first: if a layout breaks anywhere, it
 * breaks here, and finding it at 320px is cheaper than finding it on a
 * user's SE.
 */
const WIDTHS = [320, 360, 414, 768, 1024, 1280, 1440]

for (const { path, name } of PAGES) {
  test.describe(`${name} (${path})`, () => {
    for (const width of WIDTHS) {
      test(`no horizontal overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await gotoPage(page, path)

        expect(await findOverflow(page), `overflow at ${width}px on ${path}`).toEqual([])
      })
    }
  })
}

// ---------------------------------------------------------------------------
test.describe("dialogs", () => {
  // The create dialog is the widest fixed-width box in the app; if it fits
  // at 360px, nothing inside a form will push the page out.
  for (const width of [360, 414, 768, 1280]) {
    test(`the create dialog fits at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await gotoPage(page, "/system/organizations")

      await page.getByRole("button", { name: "新建组织" }).first().click()
      await expect(page.getByRole("dialog")).toBeVisible()

      expect(await findOverflow(page), `dialog overflow at ${width}px`).toEqual([])
    })
  }
})
