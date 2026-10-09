import { expect, test } from "@playwright/test"
import { gotoPage, waitForPageReady } from "./helpers"

/**
 * Navigation: Menu vs View.
 *
 * The distinction is the whole point, and it is a behavioural contract, not
 * a styling one:
 *
 * - a **View** navigates when clicked
 * - a **Menu** expands and collapses, and never navigates
 *
 * A parent that does both makes the sidebar unpredictable — the user cannot
 * tell whether a click will move them or reveal something. These tests pin
 * that contract so a later "make the parent clickable too" cannot land.
 */

const MENU = /^系统管理$/

test.describe("Menu", () => {
  test("expands and collapses, and never navigates", async ({ page }) => {
    await gotoPage(page, "/system/organizations")

    const menu = page.getByRole("button", { name: MENU })
    const child = page.locator('aside a[href="/system/users"]')

    await expect(menu).toHaveAttribute("aria-expanded", "true")
    await expect(child).toBeVisible()

    const before = page.url()
    await menu.click()

    await expect(menu).toHaveAttribute("aria-expanded", "false")
    await expect(child).toBeHidden()
    // The contract: a Menu click changes the sidebar, not the location.
    expect(page.url()).toBe(before)

    await menu.click()
    await expect(menu).toHaveAttribute("aria-expanded", "true")
    await expect(child).toBeVisible()
  })

  test("points its button at the group it controls", async ({ page }) => {
    await gotoPage(page, "/system/organizations")
    const menu = page.getByRole("button", { name: MENU })
    const controls = await menu.getAttribute("aria-controls")
    expect(controls).toBeTruthy()
    await expect(page.locator(`#${controls}`)).toHaveCount(1)
  })

  test("opens itself when you land inside it", async ({ page }) => {
    await gotoPage(page, "/system/organizations")
    const menu = page.getByRole("button", { name: MENU })

    // Close it, then navigate into it from elsewhere.
    await menu.click()
    await expect(menu).toHaveAttribute("aria-expanded", "false")

    await gotoPage(page, "/system/users")

    // Landing on a page whose parent is shut leaves the sidebar unable to
    // show where you are, which is the one thing it is for.
    await expect(menu).toHaveAttribute("aria-expanded", "true")
    await expect(page.locator('aside a[href="/system/users"]')).toBeVisible()
  })

  test("remembers a manual collapse across a reload", async ({ page }) => {
    await gotoPage(page, "/")
    const menu = page.getByRole("button", { name: MENU })
    await expect(menu).toHaveAttribute("aria-expanded", "true")

    await menu.click()
    await expect(menu).toHaveAttribute("aria-expanded", "false")

    await page.reload()
    await waitForPageReady(page)
    await expect(menu).toHaveAttribute("aria-expanded", "false")
  })
})

test.describe("View", () => {
  test("navigates on click and expands nothing", async ({ page }) => {
    await gotoPage(page, "/system/organizations")
    await page.getByRole("link", { name: /^权限$/ }).click()
    await expect(page).toHaveURL(/\/system\/permissions$/)
  })

  test("reaches a page inside the menu from the sidebar", async ({ page }) => {
    await gotoPage(page, "/")
    await page.getByRole("link", { name: /^角色$/ }).click()
    await expect(page).toHaveURL(/\/system\/roles$/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("角色")
  })

  test("is the only kind of entry that links anywhere", async ({ page }) => {
    await gotoPage(page, "/")
    // Every link in the sidebar resolves to a real View; a Menu has no href.
    const links = await page
      .locator("aside nav a")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")))
    expect(links.length).toBeGreaterThan(0)
    for (const href of links) expect(href).toBeTruthy()
    expect(links).not.toContain("/operations")
  })
})

test.describe("icon rail", () => {
  test("turns a Menu into a flyout instead of hiding its children", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoPage(page, "/system/organizations")

    await page.getByRole("button", { name: /收起侧栏/i }).click()
    await expect(page.locator("aside")).toHaveCSS("width", "64px")

    // The inline group is gone; the parent is still reachable.
    //
    // Named, not positional: the rail holds one trigger per Menu, and there
    // is more than one Menu now. A bare `button[aria-haspopup="menu"]`
    // matches several and the click lands on whichever comes first.
    const trigger = page.locator("aside").getByRole("button", { name: "系统管理" })
    await expect(trigger).toBeVisible()
    await trigger.click()

    const items = page.getByRole("menuitem")
    await expect(items).toHaveCount(5)
    await expect(items.first()).toContainText("组织")
  })

  test("still navigates from the flyout", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoPage(page, "/system/organizations")
    await page.getByRole("button", { name: /收起侧栏/i }).click()
    await page.locator("aside").getByRole("button", { name: "系统管理" }).click()
    await page.getByRole("menuitem", { name: /用户/ }).click()
    await expect(page).toHaveURL(/\/system\/users$/)
  })

  test("keeps the active marker visible for a page inside a Menu", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoPage(page, "/system/organizations")
    await page.getByRole("button", { name: /收起侧栏/i }).click()

    // With the rail collapsed and its parent closed, the current page would
    // otherwise leave no trace in the sidebar at all.
    const trigger = page.locator('aside button[aria-haspopup="menu"]')
    await expect(trigger.locator("span.bg-primary")).toHaveCount(1)
  })
})

// ---------------------------------------------------------------------------
test.describe("topbar", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [320, 360, 414, 640, 768, 1024, 1280, 1440]) {
      test(`keeps a full company name centred and clear of controls at ${width}px (${colorScheme})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ colorScheme })
        await gotoPage(page, "/system/organizations")

        const brand = page.locator('[data-slot="topbar-brand"]')
        // Exercise the configurable company name, beyond the short demo name.
        await brand.evaluate((el) => {
          el.textContent = "安徽泉象科技实业发展有限公司"
        })
        const brandBox = await brand.boundingBox()
        const barBox = await page.locator('[data-slot="topbar"]').boundingBox()
        expect(brandBox).not.toBeNull()
        expect(barBox).not.toBeNull()
        expect(
          Math.abs(brandBox!.x + brandBox!.width / 2 - (barBox!.x + barBox!.width / 2)),
        ).toBeLessThanOrEqual(1)
        expect(await brand.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)

        for (const button of await page.locator('[data-slot="topbar"] button:visible').all()) {
          const box = await button.boundingBox()
          expect(box).not.toBeNull()
          const overlaps =
            brandBox!.x < box!.x + box!.width &&
            brandBox!.x + brandBox!.width > box!.x &&
            brandBox!.y < box!.y + box!.height &&
            brandBox!.y + brandBox!.height > box!.y
          expect(overlaps, "company name overlaps a topbar control").toBe(false)
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          ),
        ).toBe(true)
      })
    }
  }

  test("centres the company name and carries no breadcrumb", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoPage(page, "/system/organizations")

    const brand = page.locator('[data-slot="topbar-brand"]')
    await expect(brand).toHaveText("安徽泉象科技实业发展有限公司")
    await expect(page.locator('aside [data-slot="project-name"]')).toHaveText("管理端模板")
    const logo = page.locator('aside [data-slot="company-logo"] img')
    await expect(logo).toBeVisible()
    await expect(logo).toHaveAttribute("src", "/images/default-company-logo.svg")
    await expect
      .poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)
    await expect(page.getByText("运营控制台", { exact: true })).toHaveCount(0)
    await expect(page).toHaveTitle("管理端模板 · 安徽泉象科技实业发展有限公司")

    // Centred for real, not just in the class list: the middle of the name
    // has to land on the middle of the bar.
    const bar = page.locator('[data-slot="topbar"]')
    const barBox = await bar.boundingBox()
    const brandBox = await brand.boundingBox()
    expect(barBox).not.toBeNull()
    expect(brandBox).not.toBeNull()
    const barCentre = barBox!.x + barBox!.width / 2
    const brandCentre = brandBox!.x + brandBox!.width / 2
    expect(Math.abs(brandCentre - barCentre)).toBeLessThanOrEqual(1)

    // The breadcrumb is gone, on every page.
    await expect(page.getByRole("navigation", { name: "面包屑" })).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
test.describe("unknown routes", () => {
  test("an unmatched URL lands on a real page, not an empty shell", async ({ page }) => {
    await gotoPage(page, "/this/does/not/exist")

    // The shell is still there, with the bar's company name in place...
    await expect(page.locator('[data-slot="topbar-brand"]')).toBeVisible()
    // ...but the main area says something, and offers a way out.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("页面不存在")
    await expect(page.getByRole("link", { name: /回到Overview/ })).toBeVisible()
  })

  test("the way out works", async ({ page }) => {
    await gotoPage(page, "/nope")
    await page.getByRole("link", { name: /回到Overview/ }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("总览")
  })

  test("unknown URLs do not horizontal-overflow either", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 })
    await gotoPage(page, "/nope")
    const scrolls = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(scrolls).toBe(false)
  })
})
