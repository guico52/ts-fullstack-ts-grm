import { expect, test, type Locator, type Page } from "@playwright/test"
import { gotoPage, signIn } from "./helpers"

// 路由是登录之后才登记的：这里的每个用例都得先有一个会话，否则 gotoPage 会被
// 守卫送去 /login。（登录页自己的用例不在此列。）
test.beforeEach(async ({ page }) => {
  await signIn(page)
})

/**
 * The view form's controls.
 *
 * The route/component block only applies to a 页面, so most of these tests
 * pick that type first — which is itself the behaviour worth pinning: a 菜单
 * must not be asked for a component it will never render.
 */
async function openCreate(page: Page) {
  await gotoPage(page, "/system/views")
  await page.getByRole("button", { name: "新建视图" }).first().click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(300)
  return dialog
}

/** The popover lives in a portal, so it is not inside `dialog`. */
const listbox = (page: Page) => page.locator("[data-slot=popover-content]")

async function chooseType(page: Page, dialog: Locator, label: string) {
  await dialog.getByLabel("类型", { exact: true }).click()
  await listbox(page)
    .getByRole("button", { name: new RegExp(label) })
    .click()
  await page.waitForTimeout(150)
}

test.describe("view form", () => {
  test("picking an icon selects it instead of typing it", async ({ page }) => {
    const dialog = await openCreate(page)

    await dialog.getByPlaceholder(/搜索图标名/).fill("users")
    await dialog.getByRole("button", { name: "Users", exact: true }).click()

    await expect(dialog.getByText("Users", { exact: true }).first()).toBeVisible()
  })

  test("a select field is a dropdown, and its options are not explained", async ({ page }) => {
    const dialog = await openCreate(page)

    await dialog.getByLabel("类型", { exact: true }).click()
    await expect(listbox(page).getByText("菜单", { exact: true })).toBeVisible()
    // 选项只给名字。解释要么进了 label，要么进了控件本身（见
    // principles 第 21 条）——这条断言就是那个规则的守卫。
    await expect(listbox(page)).not.toContainText("用于分组")
    await listbox(page).getByRole("button", { name: /菜单/ }).click()

    await expect(dialog.getByLabel("类型", { exact: true })).toContainText("菜单")
  })

  test("the component picker is a dropdown, and fills name and route", async ({ page }) => {
    const dialog = await openCreate(page)
    await chooseType(page, dialog, "页面")

    await expect(listbox(page)).toBeHidden()
    await dialog.getByLabel("组件", { exact: true }).click()
    await expect(listbox(page)).toBeVisible()

    await listbox(page)
      .getByPlaceholder(/搜索组件/)
      .fill("organizations")
    await listbox(page)
      .getByRole("button", { name: /OrganizationsView\.vue/ })
      .click()

    // One click, three columns — the whole point of the picker.
    await expect(dialog.getByLabel("组件名")).toHaveValue("OrganizationsView")
    await expect(dialog.getByLabel("路由路径")).toHaveValue("/organizations-view")
  })

  test("the component dropdown searches, and says so when nothing matches", async ({ page }) => {
    const dialog = await openCreate(page)
    await chooseType(page, dialog, "页面")
    await dialog.getByLabel("组件", { exact: true }).click()

    await expect(listbox(page).getByRole("button", { name: /\.vue/ }).first()).toBeVisible()

    await listbox(page)
      .getByPlaceholder(/搜索组件/)
      .fill("zzz-no-such-view")
    await expect(listbox(page).getByText("没有匹配的组件。")).toBeVisible()
  })

  test("菜单 and 按钮 are not asked for a component", async ({ page }) => {
    const dialog = await openCreate(page)

    // Nothing picked yet: the block has nothing to attach to, so it is absent.
    await expect(dialog.getByLabel("组件", { exact: true })).toHaveCount(0)

    await chooseType(page, dialog, "页面")
    await expect(dialog.getByLabel("组件", { exact: true })).toHaveCount(1)
    await expect(dialog.getByText("组件与路由", { exact: true })).toBeVisible()

    // Switching back hides it again — the whole section, not just the input.
    await chooseType(page, dialog, "菜单")
    await expect(dialog.getByLabel("组件", { exact: true })).toHaveCount(0)
    await expect(dialog.getByText("组件与路由", { exact: true })).toHaveCount(0)
  })

  test("type and route come before the icon; short fields are paired", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const dialog = await openCreate(page)
    await chooseType(page, dialog, "页面")

    // What the developer decides first sits above the cosmetic choices.
    const order = await page.evaluate(() => {
      const d = document.querySelector("[data-slot=dialog-content]")
      return [...d.querySelectorAll("[data-slot=field-label]")].map((el) => el.textContent.trim())
    })
    expect(order.indexOf("类型")).toBeLessThan(order.indexOf("图标"))
    expect(order.indexOf("组件")).toBeLessThan(order.indexOf("图标"))

    const pairs: Array<[string, string]> = [
      ["类型", "排序"],
      ["组件", "组件名"],
      ["上级视图", "启用"],
    ]
    for (const [left, right] of pairs) {
      const a = await dialog.getByLabel(left, { exact: true }).boundingBox()
      const b = await dialog.getByLabel(right, { exact: true }).boundingBox()
      expect(a, left).not.toBeNull()
      expect(b, right).not.toBeNull()
      expect(Math.round(a!.y), `${left} / ${right} share a row`).toBe(Math.round(b!.y))
      expect(b!.x, `${right} is to the right of ${left}`).toBeGreaterThan(a!.x)
      // Pairing is only worth it if each half is still usable: two 221px
      // inputs in a 512px dialog would be narrower than one full-width one.
      expect(a!.width, `${left} is wide enough to type in`).toBeGreaterThan(300)
    }
  })
})
