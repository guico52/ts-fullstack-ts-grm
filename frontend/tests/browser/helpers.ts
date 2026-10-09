import { expect, type Locator, type Page } from "@playwright/test"

/** Wait for Vue's route content and actual font metrics before measuring layout.
 * @see https://playwright.dev/docs/api/class-page#page-wait-for-load-state
 */
export async function waitForPageReady(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

export async function gotoPage(page: Page, path: string) {
  await page.goto(path)
  await waitForPageReady(page)
}

/** Sample the final hover style, excluding infinite spinners. */
export async function settleTransitions(locator: Locator) {
  await locator.evaluate(async (element) => {
    const animations = element
      .getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)))
  })
}
