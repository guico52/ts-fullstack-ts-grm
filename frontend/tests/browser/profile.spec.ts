import { test, expect } from "@playwright/test"
import { signIn, TEST_ACCESS, gotoPage } from "./helpers"

test("my information is reachable without management permissions and uses fresh API data", async ({
  page,
}) => {
  await signIn(page, { ...TEST_ACCESS, views: [], permissions: [] })
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "1",
        name: "最新姓名",
        email: "fresh@example.com",
        mustChangePassword: false,
        organization: { id: "1", name: "研发组织" },
        roles: [{ id: "2", name: "观察者" }],
      },
    }),
  )
  await gotoPage(page, "/account/profile")
  await expect(page.getByText("fresh@example.com", { exact: true })).toBeVisible()
  await expect(page.getByText("研发组织", { exact: true })).toBeVisible()
  await expect(page.getByText("观察者", { exact: true })).toBeVisible()
  await page.getByRole("link", { name: "修改密码", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("修改密码")
})

test("profile errors can be retried and missing organization/roles have clear states", async ({
  page,
}) => {
  await signIn(page)
  let fails = true
  await page.route("**/auth/me", (route) =>
    route.fulfill(
      fails
        ? { status: 503, json: { message: "数据库暂时不可用" } }
        : {
            json: {
              id: "1",
              name: "用户",
              email: "user@example.com",
              mustChangePassword: false,
              organization: null,
              roles: [],
            },
          },
    ),
  )
  await gotoPage(page, "/account/profile")
  await expect(page.getByRole("alert")).toHaveText("数据库暂时不可用")
  fails = false
  await page.getByRole("button", { name: "重新加载", exact: true }).click()
  await expect(page.getByText("未关联组织", { exact: true })).toBeVisible()
  await expect(page.getByText("未分配角色", { exact: true })).toBeVisible()
})

test("topbar exposes my information at phone widths", async ({ page }) => {
  await signIn(page)
  await page.setViewportSize({ width: 320, height: 900 })
  await gotoPage(page, "/account/password")
  await page.getByRole("button", { name: "我的信息", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("我的信息")
})
