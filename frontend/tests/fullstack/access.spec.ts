import { expect, test } from "@playwright/test"

const apiURL = `http://127.0.0.1:${process.env.E2E_BACKEND_PORT ?? "3015"}`
const email = process.env.ADMIN_EMAIL ?? "admin@example.com"
const password = process.env.ADMIN_PWD ?? "test-admin-password"

test("初始管理员可管理系统，观察者只读图书", async ({ page, request }) => {
  // 初始化发生在监听之后；等待登录和授权真正可用，不只等待健康探针。
  let token = ""
  await expect(async () => {
    const login = await request.post(`${apiURL}/auth/login`, { data: { email, password } })
    expect(login.ok()).toBe(true)
    token = (await login.json()).token
    const access = await request.get(`${apiURL}/auth/me/access`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect((await access.json()).views.map((v: { path: string }) => v.path)).toContain(
      "/system/roles",
    )
  }).toPass({ timeout: 15_000 })

  await page.goto("/login")
  await page.getByLabel("邮箱").fill(email)
  await page.getByLabel("口令").fill(password)
  await page.getByRole("button", { name: "登录", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("总览")
  for (const [path, title] of [
    ["organizations", "组织"],
    ["users", "用户"],
    ["views", "视图"],
    ["roles", "角色"],
    ["permissions", "权限"],
  ]) {
    await page.goto(`/system/${path}`)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title!)
  }
  const headers = { authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const org = await request.post(`${apiURL}/rbac/organizations`, {
    headers,
    data: { name: "E2E 组织", code: `E2E-${stamp}` },
  })
  expect(org.status()).toBe(201)
  const orgId = (await org.json()).id
  const viewerEmail = `e2e-${stamp}@example.com`
  const user = await request.post(`${apiURL}/rbac/users`, {
    headers,
    data: { name: "E2E 观察者", email: viewerEmail, password, organizationId: orgId },
  })
  expect(user.status()).toBe(201)
  const userId = (await user.json()).id
  try {
    const role = await request.post(`${apiURL}/rbac/roles`, {
      headers,
      data: { name: `E2E-${stamp}`, userIds: [userId] },
    })
    expect(role.status()).toBe(201)
    const roleId = (await role.json()).id
    try {
      const permissions = await request.get(`${apiURL}/rbac/permissions?limit=100`, { headers })
      const views = await request.get(`${apiURL}/rbac/views?limit=100`, { headers })
      const permissionIds = (await permissions.json()).data
        .filter((p: { code: string }) => p.code.startsWith("book.") && p.code.endsWith(".read"))
        .map((p: { id: string }) => p.id)
      const viewIds = (await views.json()).data
        .filter((v: { name: string }) => ["图书管理", "图书", "作者", "书店"].includes(v.name))
        .map((v: { id: string }) => v.id)
      expect(
        (
          await request.patch(`${apiURL}/rbac/roles/${roleId}`, {
            headers,
            data: { permissionIds, viewIds },
          })
        ).ok(),
      ).toBe(true)
      await page.getByRole("button", { name: "退出登录" }).click()
      await page.getByLabel("邮箱").fill(viewerEmail)
      await page.getByLabel("口令").fill(password)
      await page.getByRole("button", { name: "登录", exact: true }).click()
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("图书")
      await expect(page.getByRole("button", { name: /新建|编辑|删除/ })).toHaveCount(0)
      await page.goto("/system/users")
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("页面不存在")
      const viewer = await request.post(`${apiURL}/auth/login`, {
        data: { email: viewerEmail, password },
      })
      const viewerToken = (await viewer.json()).token
      expect(
        (
          await request.post(`${apiURL}/book/authors`, {
            headers: { authorization: `Bearer ${viewerToken}` },
            data: { name: "不该创建" },
          })
        ).status(),
      ).toBe(403)
    } finally {
      await request.delete(`${apiURL}/rbac/roles/${roleId}`, { headers })
    }
  } finally {
    await request.delete(`${apiURL}/rbac/users/${userId}`, { headers })
    await request.delete(`${apiURL}/rbac/organizations/${orgId}`, { headers })
  }
})
