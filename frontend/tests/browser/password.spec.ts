import { test, expect } from "@playwright/test"
import { signIn, TEST_ACCESS, TEST_SESSION, gotoPage } from "./helpers"

test("wrong current password stays signed in; successful change clears the session", async ({
  page,
}) => {
  await signIn(page)
  let accepts = false
  await page.route("**/auth/me/password", (route) =>
    route.fulfill(
      accepts
        ? { json: { changed: true } }
        : { status: 422, json: { message: "当前密码不正确", code: "INVALID_PASSWORD" } },
    ),
  )
  await gotoPage(page, "/account/password")
  await page.getByLabel("当前密码", { exact: true }).fill("wrong-password")
  await page.getByLabel("新密码", { exact: true }).fill("new-password")
  await page.getByLabel("确认新密码", { exact: true }).fill("new-password")
  await page.getByRole("button", { name: "确认修改" }).click()
  await expect(page.getByRole("alert")).toHaveText("当前密码不正确")
  expect(await page.evaluate(() => localStorage.getItem("vat-session"))).not.toBeNull()
  accepts = true
  await page.getByLabel("当前密码", { exact: true }).fill("original-password")
  await page.getByRole("button", { name: "确认修改" }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("登录")
  await expect(page.getByRole("status")).toHaveText("密码已修改，请重新登录。")
  expect(await page.evaluate(() => localStorage.getItem("vat-session"))).toBeNull()
})

test("reset sessions cannot navigate past the password page", async ({ page }) => {
  await page.addInitScript(
    (session) => localStorage.setItem("vat-session", JSON.stringify(session)),
    { ...TEST_SESSION, mustChangePassword: true },
  )
  await page.route("**/auth/me/access**", (route) => route.fulfill({ json: TEST_ACCESS }))
  await page.goto("/library/books")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("修改密码")
  await expect(page).toHaveURL(/account\/password$/)
  await expect(page.getByText("密码已被重置，请修改后继续使用。")).toBeVisible()
})

test("expired API credentials clear local session and dynamic routes", async ({ page }) => {
  await signIn(page)
  await page.route("**/rbac/users**", (route) =>
    route.fulfill({ status: 401, json: { message: "会话已失效", code: "UNAUTHORIZED" } }),
  )
  await page.goto("/system/users")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("登录")
  expect(await page.evaluate(() => localStorage.getItem("vat-session"))).toBeNull()
})

test("user editing hides password; reset has its own permission and masked form", async ({
  page,
}) => {
  await signIn(page)
  await page.route("**/rbac/users**", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "2",
            name: "普通用户",
            email: "user@example.com",
            organization: { id: "1", name: "组织" },
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    }),
  )
  await page.route("**/rbac/organizations**", (route) =>
    route.fulfill({ json: { data: [], total: 0 } }),
  )
  await gotoPage(page, "/system/users")
  await page.getByRole("button", { name: "编辑 user@example.com", exact: true }).click()
  await expect(page.getByRole("dialog").getByLabel("口令")).toHaveCount(0)
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click()
  await page.getByRole("button", { name: "重置密码 user@example.com", exact: true }).click()
  await expect(page.getByLabel("临时密码", { exact: true })).toHaveAttribute("type", "password")
  await expect(page.getByRole("dialog")).toContainText("用户下次登录必须修改密码")
})

test("ordinary update permission does not expose reset action", async ({ page }) => {
  await signIn(page, {
    ...TEST_ACCESS,
    permissions: TEST_ACCESS.permissions.filter((p) => p !== "rbac.user.resetPassword"),
  })
  await page.route("**/rbac/users**", (route) =>
    route.fulfill({
      json: {
        data: [{ id: "2", name: "普通用户", email: "user@example.com", organization: null }],
        total: 1,
      },
    }),
  )
  await page.route("**/rbac/organizations**", (route) =>
    route.fulfill({ json: { data: [], total: 0 } }),
  )
  await gotoPage(page, "/system/users")
  await expect(
    page.getByRole("button", { name: "编辑 user@example.com", exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: /重置密码/ })).toHaveCount(0)
})

test("entering the user page refreshes cached permissions and exposes newly granted reset", async ({
  page,
}) => {
  let loads = 0
  await signIn(page)
  await page.route("**/auth/me/access**", (route) =>
    route.fulfill({
      json: {
        ...TEST_ACCESS,
        permissions:
          ++loads === 1
            ? TEST_ACCESS.permissions.filter((p) => p !== "rbac.user.resetPassword")
            : TEST_ACCESS.permissions,
      },
    }),
  )
  await page.route("**/rbac/users**", (route) =>
    route.fulfill({
      json: {
        data: [{ id: "2", name: "用户", email: "user@example.com", organization: null }],
        total: 1,
      },
    }),
  )
  await page.route("**/rbac/organizations**", (route) =>
    route.fulfill({ json: { data: [], total: 0 } }),
  )
  await gotoPage(page, "/system/users")
  await expect(
    page.getByRole("button", { name: "重置密码 user@example.com", exact: true }),
  ).toBeVisible()
  expect(loads).toBeGreaterThanOrEqual(2)
})
