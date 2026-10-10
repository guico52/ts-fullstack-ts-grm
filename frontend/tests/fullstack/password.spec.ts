import { test, expect } from "@playwright/test"

const apiURL = `http://127.0.0.1:${process.env.E2E_BACKEND_PORT ?? "3015"}`
const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com"
const adminPassword = process.env.ADMIN_PWD ?? "test-admin-password"

test("real password changes, admin reset and mandatory rotation revoke old sessions", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(60_000)
  const adminLogin = await request.post(`${apiURL}/auth/login`, {
    data: { email: adminEmail, password: adminPassword },
  })
  const headers = { authorization: `Bearer ${(await adminLogin.json()).token}` }
  const roles = await request.get(`${apiURL}/rbac/roles?limit=100`, { headers })
  const viewer = (await roles.json()).data.find((r: { name: string }) => r.name === "观察者")
  const stamp = Date.now()
  const org = await request.post(`${apiURL}/rbac/organizations`, {
    headers,
    data: { name: "E2E 密码组织", code: `E2E-PW-${stamp}` },
  })
  const orgId = (await org.json()).id
  const email = `e2e-password-${stamp}@example.com`
  const user = await request.post(`${apiURL}/rbac/users`, {
    headers,
    data: { name: "E2E 密码用户", email, password: "original-password", organizationId: orgId },
  })
  const userId = (await user.json()).id
  const role = await request.post(`${apiURL}/rbac/roles`, {
    headers,
    data: {
      name: `E2E-PW-${stamp}`,
      userIds: [userId],
      viewIds: viewer.views.map((v: { id: string }) => v.id),
      permissionIds: viewer.permissions.map((p: { id: string }) => p.id),
    },
  })
  const roleId = (await role.json()).id
  const adminPage = await browser.newPage()
  const login = async (password: string) => {
    await page.goto("/login")
    await page.getByLabel("邮箱").fill(email)
    await page.getByLabel("口令").fill(password)
    await page.getByRole("button", { name: "登录", exact: true }).click()
  }
  const change = async (oldPassword: string, nextPassword: string) => {
    await page.getByLabel("当前密码", { exact: true }).fill(oldPassword)
    await page.getByLabel("新密码", { exact: true }).fill(nextPassword)
    await page.getByLabel("确认新密码", { exact: true }).fill(nextPassword)
    await page.getByRole("button", { name: "确认修改", exact: true }).click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("登录")
  }
  try {
    await login("original-password")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("图书")
    const originalToken = await page.evaluate(
      () => JSON.parse(localStorage.getItem("vat-session")!).token,
    )
    await page.getByRole("button", { name: "我的信息", exact: true }).click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("我的信息")
    await expect(page.getByText(email, { exact: true })).toBeVisible()
    await expect(page.getByText(`E2E-PW-${stamp}`, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText(email, { exact: true })).toBeVisible()
    await page.getByRole("link", { name: "修改密码", exact: true }).click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("修改密码")
    await change("original-password", "changed-password")
    expect(
      (
        await request.get(`${apiURL}/auth/me/access`, {
          headers: { authorization: `Bearer ${originalToken}` },
        })
      ).status(),
    ).toBe(401)
    await login("changed-password")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("图书")
    await adminPage.goto("/login")
    await adminPage.getByLabel("邮箱").fill(adminEmail)
    await adminPage.getByLabel("口令").fill(adminPassword)
    await adminPage.getByRole("button", { name: "登录", exact: true }).click()
    await expect(adminPage.getByRole("heading", { level: 1 })).toHaveText("总览")
    await adminPage.goto("/system/users")
    await adminPage.getByRole("button", { name: `重置密码 ${email}`, exact: true }).click()
    await adminPage.getByLabel("临时密码", { exact: true }).fill("temporary-password")
    await adminPage.getByLabel("确认临时密码", { exact: true }).fill("temporary-password")
    await adminPage.getByRole("button", { name: "确认重置", exact: true }).click()
    await expect(adminPage.getByRole("dialog")).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("登录")
    await login("temporary-password")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("修改密码")
    await page.goto("/library/books")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("修改密码")
    await change("temporary-password", "final-password")
    await login("final-password")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("图书")
  } finally {
    await adminPage.close()
    await request.delete(`${apiURL}/rbac/roles/${roleId}`, { headers })
    await request.delete(`${apiURL}/rbac/users/${userId}`, { headers })
    await request.delete(`${apiURL}/rbac/organizations/${orgId}`, { headers })
  }
})
