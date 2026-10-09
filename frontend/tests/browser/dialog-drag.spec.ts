import { expect, test, type Page } from "@playwright/test"
import { gotoPage } from "./helpers"

/**
 * Drag-to-move, on a real layout engine.
 *
 * The unit tests cover the arithmetic; these cover the two ways the feature
 * actually goes wrong: the box leaves the screen with nothing left to grab,
 * and the drag swallows the dialog's own dismissal (Escape, the overlay) —
 * which no DOM-less test can see.
 */
async function openDialog(page: Page) {
  await gotoPage(page, "/system/organizations")
  await page.getByRole("button", { name: "新建组织" }).first().click()
  const content = page.locator("[data-slot=dialog-content]")
  await expect(content).toBeVisible()
  // Wait out the 200ms enter transition — coordinates sampled mid-animation
  // are not where the box lands.
  await page.waitForTimeout(350)
  return content
}

async function dragBy(page: Page, dx: number, dy: number) {
  const box = await page.locator("[data-slot=dialog-header]").first().boundingBox()
  if (!box) throw new Error("dialog header has no box")
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx, startY + dy, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(350)
}

test.describe("draggable dialog", () => {
  test("follows the pointer", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const content = await openDialog(page)
    const before = await content.boundingBox()
    expect(before).not.toBeNull()

    await dragBy(page, 140, 80)

    const after = await content.boundingBox()
    expect(after).not.toBeNull()
    expect(Math.round(after!.x - before!.x)).toBe(140)
    expect(Math.round(after!.y - before!.y)).toBe(80)
  })

  test("cannot be dragged off screen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const content = await openDialog(page)

    await dragBy(page, -5000, -5000)

    const box = await content.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    // The header is the only part you can grab; it has to stay reachable.
    const handle = await page.locator("[data-slot=dialog-header]").first().boundingBox()
    expect(handle!.y).toBeLessThan(900)
  })

  test("Escape still closes it after a drag", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const content = await openDialog(page)

    await dragBy(page, 120, 60)
    await page.keyboard.press("Escape")

    await expect(content).toBeHidden()
  })

  test("the overlay still closes it after a drag", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const content = await openDialog(page)

    await dragBy(page, 120, 60)
    await page.mouse.click(20, 20)

    await expect(content).toBeHidden()
  })

  test("reopens centred", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const content = await openDialog(page)
    const centred = await content.boundingBox()
    expect(centred).not.toBeNull()

    await dragBy(page, 160, 90)
    await page.keyboard.press("Escape")
    await expect(content).toBeHidden()

    const reopened = await openDialog(page)
    const box = await reopened.boundingBox()
    expect(box).not.toBeNull()
    expect(Math.abs(box!.x - centred!.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(box!.y - centred!.y)).toBeLessThanOrEqual(1)
  })
})
