import { expect, test, type Page } from "@playwright/test"

import { gotoPage } from "./helpers"

/**
 * The login page.
 *
 * The API is mocked: this covers the page, not whether a database happens to
 * hold a user. What is worth pinning here is the shape of the page (a bare
 * layout with no sidebar), that the form explains nothing, and that a failure
 * puts the server's own message on screen.
 */
const SESSION = {
  id: "85",
  name: "演示用户",
  email: "demo@example.com",
  // 形状要与服务端一致：少了 token，刷新后 readSession 会直接丢弃整个会话。
  token: "header.payload.signature",
}

async function mockApi(page: Page) {
  await page.route("**/auth/login**", async (route) => {
    const body = route.request().postDataJSON() as { password?: string }
    if (body.password === "secret123") {
      await route.fulfill({ json: SESSION })
      return
    }
    await route.fulfill({
      status: 401,
      json: { message: "邮箱或口令不正确", code: "INVALID_CREDENTIALS" },
    })
  })
  // 登录成功后会落到总览页，那里并发取八个计数。给个空响应，
  // 测试就不必依赖一个跑着的后端。
  const empty = { data: [], total: 0, limit: 1, offset: 0 }
  await page.route("**/rbac/**", (route) => route.fulfill({ json: empty }))
  await page.route("**/book/**", (route) => route.fulfill({ json: empty }))
}

test.describe("login", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
  })

  test("renders without the app shell", async ({ page }) => {
    await gotoPage(page, "/login")

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("登录")
    // 一个还没进来的人不该看见导航——那会让他以为已经进来了。
    await expect(page.locator("aside")).toHaveCount(0)
    await expect(page.locator("[data-slot=topbar]")).toHaveCount(0)
  })

  test("the form says what it needs and nothing else", async ({ page }) => {
    await gotoPage(page, "/login")

    await expect(page.getByLabel("邮箱")).toBeVisible()
    await expect(page.getByLabel("口令")).toBeVisible()
    // 这一页曾经很容易长满"请输入管理员分配的账号"之类的话。留在屏幕上的
    // 只有 label 和按钮（见 principles 第 21 条）。
    await expect(page.getByRole("alert")).toHaveCount(0)
  })

  test("an empty submit reports both fields, not nothing", async ({ page }) => {
    await gotoPage(page, "/login")

    await page.getByRole("button", { name: "登录" }).click()

    // 未填时用我们自己的提示，不靠浏览器的气泡——那东西在不同浏览器里
    // 长得不一样，而且失败时不派发 submit（见 principles 第 19 条）。
    await expect(page.getByText("请填写邮箱。")).toBeVisible()
    await expect(page.getByText("请填写口令。")).toBeVisible()
  })

  test("a malformed email is caught before any request goes out", async ({ page }) => {
    let called = false
    await page.route("**/auth/login**", async (route) => {
      called = true
      await route.fulfill({ json: SESSION })
    })

    await gotoPage(page, "/login")
    await page.getByLabel("邮箱").fill("not-an-email")
    await page.getByLabel("口令").fill("secret123")
    await page.getByRole("button", { name: "登录" }).click()

    await expect(page.getByText("邮箱格式不正确。")).toBeVisible()
    expect(called).toBe(false)
  })

  test("rejected credentials show the server's message", async ({ page }) => {
    await gotoPage(page, "/login")

    await page.getByLabel("邮箱").fill("demo@example.com")
    await page.getByLabel("口令").fill("wrong-password")
    await page.getByRole("button", { name: "登录" }).click()

    await expect(page.getByRole("alert")).toHaveText("邮箱或口令不正确")
    // 没进去就还在这一页。
    await expect(page).toHaveURL(/\/login$/)
  })

  test("accepted credentials land on the overview and show who is signed in", async ({ page }) => {
    await gotoPage(page, "/login")

    await page.getByLabel("邮箱").fill("demo@example.com")
    await page.getByLabel("口令").fill("secret123")
    await page.getByRole("button", { name: "登录" }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator("[data-slot=topbar]")).toContainText("演示用户")
  })

  test("the session survives a reload, and signing out ends it", async ({ page }) => {
    await gotoPage(page, "/login")
    await page.getByLabel("邮箱").fill("demo@example.com")
    await page.getByLabel("口令").fill("secret123")
    await page.getByRole("button", { name: "登录" }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.reload()
    await expect(page.locator("[data-slot=topbar]")).toContainText("演示用户")

    await page.getByRole("button", { name: "退出登录" }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(await page.evaluate(() => localStorage.getItem("vat-session"))).toBeNull()
  })
})
