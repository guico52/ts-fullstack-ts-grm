import { expect, test, type Page } from "@playwright/test"
import { gotoPage } from "./helpers"

/**
 * The role form's two relational pickers.
 *
 * A role names pages and permissions, and the two need opposite shapes: a page
 * only reads correctly under its menu, while permissions are a flat set. So the
 * same `links` field renders as a tree for one and a list for the other — and
 * that difference is what this file pins.
 *
 * The API is mocked: the shape of the options is under test, not whether a
 * database happens to hold rows.
 */
const VIEWS = [
  {
    id: "1",
    name: "系统",
    icon: "Shield",
    type: "MENU",
    sort: 1,
    parentId: null,
    path: null,
    active: true,
  },
  {
    id: "2",
    name: "组织",
    icon: "Building2",
    type: "VIEW",
    sort: 1,
    parentId: "1",
    path: "/org",
    active: true,
  },
  {
    id: "3",
    name: "新建",
    icon: "Hash",
    type: "BUTTON",
    sort: 1,
    parentId: "2",
    path: null,
    active: true,
  },
]

const PERMISSIONS = [
  { id: "10", name: "读取" },
  { id: "11", name: "写入" },
]

const USERS = [{ id: "20", name: "张三", email: "zhangsan@example.com" }]

const page1 = <T>(rows: T[]) => ({ data: rows, total: rows.length, limit: 100, offset: 0 })

async function mockApi(page: Page) {
  await page.route("**/rbac/views**", (route) => route.fulfill({ json: page1(VIEWS) }))
  await page.route("**/rbac/permissions**", (route) => route.fulfill({ json: page1(PERMISSIONS) }))
  await page.route("**/rbac/users**", (route) => route.fulfill({ json: page1(USERS) }))
  await page.route("**/rbac/roles**", (route) => route.fulfill({ json: page1([]) }))
}

/** The popover is portalled, so it is not a descendant of the dialog. */
const listbox = (page: Page) => page.locator("[data-slot=popover-content]")

async function openCreate(page: Page) {
  await gotoPage(page, "/system/roles")
  await page.getByRole("button", { name: "新建角色" }).first().click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(300)
  return dialog
}

/** Rows of an open picker, as `indent text`.
 *
 * The indent is read off the inline style the tree writes; a flat list has no
 * inline style at all, so an empty string means the same as zero.
 */
async function rowsOf(page: Page, slot: string): Promise<string[]> {
  return listbox(page)
    .locator(`[data-slot=${slot}]`)
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const indent = (node.firstElementChild as HTMLElement | null)?.style.paddingLeft
        return `${indent || "0rem"} ${(node.textContent ?? "").trim()}`
      }),
    )
}

const treeRows = (page: Page) => rowsOf(page, "tree-select-option")
const listRows = (page: Page) => rowsOf(page, "multi-select-option")

test.describe("role form pickers", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
  })

  test("the view picker shows the hierarchy, not three peers", async ({ page }) => {
    const dialog = await openCreate(page)

    await dialog.getByLabel("视图", { exact: true }).click()
    await expect(listbox(page)).toBeVisible()

    // Depth becomes indentation — the whole reason this field is a tree.
    expect(await treeRows(page)).toEqual(["0rem 系统", "0.9rem 组织", "1.8rem 新建"])
  })

  test("searching for a leaf keeps its ancestors on screen", async ({ page }) => {
    const dialog = await openCreate(page)

    await dialog.getByLabel("视图", { exact: true }).click()
    await listbox(page)
      .getByPlaceholder(/搜索视图/)
      .fill("新建")

    // The hit plus the path down to it — never an orphan.
    expect(await treeRows(page)).toEqual(["0rem 系统", "0.9rem 组织", "1.8rem 新建"])
  })

  test("a branch collapses, a leaf has no expander", async ({ page }) => {
    const dialog = await openCreate(page)

    await dialog.getByLabel("视图", { exact: true }).click()
    const expanders = listbox(page).getByRole("button", { name: "折叠" })
    expect(await expanders.count()).toBe(2)

    await expanders.first().click()
    expect(await treeRows(page)).toEqual(["0rem 系统"])

    await listbox(page).getByRole("button", { name: "展开" }).first().click()
    expect(await treeRows(page)).toEqual(["0rem 系统", "0.9rem 组织", "1.8rem 新建"])
  })

  test("picking a view does not close the dropdown, and the choice shows as a chip", async ({
    page,
  }) => {
    const dialog = await openCreate(page)

    await dialog.getByLabel("视图", { exact: true }).click()
    await listbox(page).getByText("组织", { exact: true }).click()

    // Choosing the second one is the point of a multi-select: it must stay open.
    await expect(listbox(page)).toBeVisible()
    await listbox(page).getByText("新建", { exact: true }).click()

    const trigger = dialog.getByLabel("视图", { exact: true })
    await expect(trigger).toContainText("组织")
    await expect(trigger).toContainText("新建")
  })

  test("a chosen view can be taken back off", async ({ page }) => {
    const dialog = await openCreate(page)

    await dialog.getByLabel("视图", { exact: true }).click()
    await listbox(page).getByText("组织", { exact: true }).click()
    await listbox(page).getByText("组织", { exact: true }).click()

    await expect(dialog.getByLabel("视图", { exact: true })).toContainText("选择视图…")
  })

  test("the permission picker is a flat multi-select, with no indentation", async ({ page }) => {
    const dialog = await openCreate(page)

    await dialog.getByLabel("权限", { exact: true }).click()
    await expect(listbox(page)).toBeVisible()

    expect(await listRows(page)).toEqual(["0rem 读取", "0rem 写入"])
  })

  test("permissions accumulate as chips", async ({ page }) => {
    const dialog = await openCreate(page)

    await dialog.getByLabel("权限", { exact: true }).click()
    await listbox(page).getByText("读取", { exact: true }).click()
    await expect(listbox(page)).toBeVisible()
    await listbox(page).getByText("写入", { exact: true }).click()

    const trigger = dialog.getByLabel("权限", { exact: true })
    await expect(trigger).toContainText("读取")
    await expect(trigger).toContainText("写入")
  })

  test("清空 empties a multi-select without touching the others", async ({ page }) => {
    const dialog = await openCreate(page)

    await dialog.getByLabel("权限", { exact: true }).click()
    await listbox(page).getByText("读取", { exact: true }).click()

    await dialog.getByLabel("视图", { exact: true }).click()
    await listbox(page).getByText("组织", { exact: true }).click()

    await listbox(page).getByRole("button", { name: "清空" }).click()

    await expect(dialog.getByLabel("视图", { exact: true })).toContainText("选择视图…")
    await expect(dialog.getByLabel("权限", { exact: true })).toContainText("读取")
  })

  test("a flat field is still a flat list", async ({ page }) => {
    const dialog = await openCreate(page)

    await dialog.getByLabel("用户", { exact: true }).click()
    // 用户的标签是邮箱，不是姓名——选项里显示的就是这一列。
    expect(await listRows(page)).toEqual(["0rem zhangsan@example.com"])
  })
})
