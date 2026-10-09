import { expect, test, type Page } from "@playwright/test"
import { gotoPage, settleTransitions } from "./helpers"

/**
 * Affordance checks: does a control look clickable before you click it?
 *
 * Two signals, and both are required:
 *
 * 1. The cursor. A button that shows an arrow is a button the user has to
 *    guess about. Tailwind v4 removed preflight's `cursor: pointer` on
 *    <button>, so this is not a hypothetical — every control in the app
 *    showed a default arrow until main.css put it back.
 * 2. A visible change on hover. The cursor says "clickable"; the change
 *    says "this one, right now, is the thing you are about to hit".
 *
 * Neither is visible to a component test: happy-dom does not compute
 * styles, does not cascade, and has no cursor.
 */

const INTERACTIVE =
  'button:not(:disabled), a[href], [role="button"]:not([aria-disabled="true"]), [role="tab"]:not([aria-disabled="true"]), [role="menuitem"]:not([data-disabled]), [role="option"]:not([data-disabled]), [role="switch"]:not(:disabled), [role="combobox"]:not(:disabled), select:not(:disabled)'

const PAGES = [
  "/",
  "/system/organizations",
  "/system/users",
  "/system/views",
  "/system/roles",
  "/system/permissions",
]

/** Every control on the page whose cursor is not a hand. */
async function findWrongCursor(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const describe = (el: Element) => {
      const tag = el.tagName.toLowerCase()
      const slot = el.getAttribute("data-slot")
      const role = el.getAttribute("role")
      const label = el.getAttribute("aria-label")
      const text = (el.textContent ?? "").trim().slice(0, 24)
      return [
        tag,
        slot && `[${slot}]`,
        role && `role=${role}`,
        label && `"${label}"`,
        text && `"${text}"`,
      ]
        .filter(Boolean)
        .join(" ")
    }

    const offenders: string[] = []
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 2 || rect.height <= 2) continue
      const style = getComputedStyle(el)
      if (style.display === "none" || style.visibility === "hidden") continue
      if (style.cursor !== "pointer") {
        offenders.push(`${describe(el)} cursor=${style.cursor}`)
      }
    }
    return [...new Set(offenders)]
  }, INTERACTIVE)
}
test.describe("cursor", () => {
  for (const path of PAGES) {
    test(`${path}: every interactive control shows a hand`, async ({ page }) => {
      await gotoPage(page, path)
      expect(await findWrongCursor(page)).toEqual([])
    })
  }

  test("the open dialog's controls follow the same rule", async ({ page }) => {
    await gotoPage(page, "/system/organizations")
    await page.getByRole("button", { name: "新建组织" }).first().click()
    await expect(page.getByRole("dialog")).toBeVisible()
    expect(await findWrongCursor(page)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
test.describe("hover feedback", () => {
  test("sidebar links respond to hover", async ({ page }) => {
    await gotoPage(page, "/")
    const link = page.locator('aside a[href="/system/users"]')
    await settleTransitions(link)
    const before = await link.evaluate((el) => getComputedStyle(el).backgroundColor)
    await link.hover()
    await settleTransitions(link)
    const after = await link.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(after).not.toBe(before)
  })

  test("the theme and accent toggles respond to hover", async ({ page }) => {
    await gotoPage(page, "/")
    for (const name of [/主题/, /强调色/]) {
      const button = page.getByRole("button", { name })
      await settleTransitions(button)
      const before = await button.evaluate((el) => getComputedStyle(el).backgroundColor)
      await button.hover()
      await settleTransitions(button)
      const after = await button.evaluate((el) => getComputedStyle(el).backgroundColor)
      expect(after, (await button.getAttribute("aria-label")) ?? "").not.toBe(before)
    }
  })
})

// ---------------------------------------------------------------------------
test.describe("label association", () => {
  /**
   * This is the general check for a whole class of bug: a component whose
   * root renders no element drops whatever it was handed. `class` went first,
   * `id` went second and more quietly — a label pointing at an id that no
   * longer exists still looks fine.
   */
  for (const path of PAGES) {
    test(`${path}: every label points at a real control`, async ({ page }) => {
      await gotoPage(page, path)

      const orphans = await page.evaluate(() => {
        const broken: string[] = []
        for (const label of Array.from(document.querySelectorAll("label[for]"))) {
          const id = label.getAttribute("for")
          if (!id) continue
          if (!document.getElementById(id)) {
            broken.push(`for="${id}" on label "${(label.textContent ?? "").trim()}"`)
          }
        }
        return broken
      })

      expect(orphans).toEqual([])
    })
  }

  test("the create dialog's labels all resolve", async ({ page }) => {
    await gotoPage(page, "/system/users")
    await page.getByRole("button", { name: "新建用户" }).first().click()
    await expect(page.getByRole("dialog")).toBeVisible()

    const orphans = await page.evaluate(() => {
      const broken: string[] = []
      for (const label of Array.from(document.querySelectorAll("label[for]"))) {
        const id = label.getAttribute("for")
        if (id && !document.getElementById(id)) broken.push(id)
      }
      return broken
    })
    expect(orphans).toEqual([])
  })
})
