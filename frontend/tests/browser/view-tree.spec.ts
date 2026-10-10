import { expect, test } from "@playwright/test"
import { gotoPage, signIn } from "./helpers"

/**
 * The view tree table.
 *
 * The tree maths is unit-tested in `lib/view-tree.test.ts`; this covers the
 * part that only exists in a browser — that depth becomes indentation, that
 * a leaf gets no expander, and that collapsing actually hides descendants.
 *
 * The API is mocked: the shape of the tree is what is under test, not
 * whether a database happens to be running.
 */
const ROWS = [
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

test.describe("view tree", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await page.route("**/rbac/views**", (route) =>
      route.fulfill({
        json: { data: ROWS, total: ROWS.length, limit: 100, offset: 0 },
      }),
    )
  })

  test("nests children under their parent and indents by depth", async ({ page }) => {
    await gotoPage(page, "/system/views")

    const cells = page.locator("table tbody tr td:first-child")
    await expect(cells).toHaveCount(3)
    await expect(cells).toHaveText([/系统/, /组织/, /新建/])

    const indents = await page
      .locator("table tbody tr td:first-child > div")
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).style.paddingLeft))
    expect(indents).toEqual(["0rem", "1.25rem", "2.5rem"])
  })

  test("a leaf gets no expander, a parent does", async ({ page }) => {
    await gotoPage(page, "/system/views")

    const rows = page.locator("table tbody tr")
    await expect(rows).toHaveCount(3)
    // 系统 (menu) and 组织 (page) can expand; 新建 (button) is a leaf.
    await expect(rows.nth(0).locator("button[aria-expanded]")).toHaveCount(1)
    await expect(rows.nth(1).locator("button[aria-expanded]")).toHaveCount(1)
    await expect(rows.nth(2).locator("button[aria-expanded]")).toHaveCount(0)
  })

  test("collapsing hides descendants, expanding brings them back", async ({ page }) => {
    await gotoPage(page, "/system/views")

    await page.getByRole("button", { name: "折叠" }).first().click()
    await expect(page.locator("table tbody tr")).toHaveCount(1)
    await expect(page.locator("table tbody tr td:first-child")).toHaveText(/系统/)

    await page.getByRole("button", { name: "展开" }).first().click()
    await expect(page.locator("table tbody tr")).toHaveCount(3)
  })

  test("the header counts rows and explains nothing", async ({ page }) => {
    await gotoPage(page, "/system/views")

    // 层级已经由缩进和配色表达了。再写一行“按 菜单 → 页面 → 按钮 三层
    // 展开”就是解释，而且会随实现腐烂（见 principles 第 21 条）。
    // 这条断言守住它不再长回来。
    await expect(page.getByText(/共 \d+ 条/)).toBeVisible()
    await expect(page.getByText(/菜单 → 页面 → 按钮/)).toHaveCount(0)
  })

  test("a new node's order follows the level it lands in", async ({ page }) => {
    await gotoPage(page, "/system/views")
    await page.getByRole("button", { name: "新建视图" }).first().click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // 顶层最大的 sort 是 1（系统），所以新的顶层节点排 2。
    await expect(dialog.getByLabel("排序")).toHaveValue("2")

    // 页面挂在「系统」下：该菜单已有 sort=1 的「组织」，新的排 2。
    await dialog.getByLabel("类型", { exact: true }).click()
    await page.locator("[data-slot=popover-content]").getByRole("button", { name: /页面/ }).click()
    await dialog.getByLabel("上级视图", { exact: true }).click()
    const parents = page.locator("[data-slot=popover-content]")
    // 只有菜单能当页面的上级，「组织」虽然是同一棵树里的节点也不该出现。
    await expect(parents.getByRole("button")).toHaveCount(1)
    await parents.getByRole("button", { name: "系统" }).click()
    await expect(dialog.getByLabel("排序")).toHaveValue("2")
  })

  test("typing an order stops it following the level", async ({ page }) => {
    await gotoPage(page, "/system/views")
    await page.getByRole("button", { name: "新建视图" }).first().click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    await dialog.getByLabel("排序").fill("42")
    // Changing the level must not overwrite a value the user typed.
    await dialog.getByLabel("类型", { exact: true }).click()
    await page.locator("[data-slot=popover-content]").getByRole("button", { name: /菜单/ }).click()
    await expect(dialog.getByLabel("排序")).toHaveValue("42")
  })

  test("editing a node leaves its order alone", async ({ page }) => {
    await gotoPage(page, "/system/views")

    // 「组织」的 sort 是 1，同级最大也是 1。`auto` 若在编辑时跑，它会变成 2。
    await page.getByRole("button", { name: "编辑 组织" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // 打开弹窗、什么都没做 —— 顺序必须还是它自己那个值。
    await expect(dialog.getByLabel("排序")).toHaveValue("1")

    // 改上级也不重算 —— `auto` 是默认值，不是每次改动都重算的派生值。
    await dialog.getByLabel("上级视图").click()
    await page.locator("[data-slot=popover-content]").getByRole("button", { name: "系统" }).click()
    await expect(dialog.getByLabel("排序")).toHaveValue("1")

    // 清空也不会让 `auto` 复活 —— 戳过就是用户的意思，而“清空”就是一个意思。
    // `sort` 本来也允许为空（后端在插入时取同级最大值 +1）。
    await dialog.getByLabel("排序").fill("")
    await expect(dialog.getByLabel("排序")).toHaveValue("")
  })

  test("a menu offers 添加页面, a page offers 添加按钮, a button offers neither", async ({
    page,
  }) => {
    await gotoPage(page, "/system/views")

    await expect(page.getByRole("button", { name: "为「系统」添加页面" })).toBeVisible()
    await expect(page.getByRole("button", { name: "为「组织」添加按钮" })).toBeVisible()
    // 按钮是叶子，操作栏里没有 ⊕。
    await expect(page.getByRole("button", { name: /为「新建」添加/ })).toHaveCount(0)
  })

  test("adding a page under a menu opens the form already answered", async ({ page }) => {
    await gotoPage(page, "/system/views")
    await page.getByRole("button", { name: "为「系统」添加页面" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    // The three questions the ⊕ button already answered.
    await expect(dialog.getByLabel("类型", { exact: true })).toContainText("页面")
    await expect(dialog.getByLabel("上级视图", { exact: true })).toContainText("系统")
    // 「系统」下已有 sort=1 的「组织」，新的排 2。
    await expect(dialog.getByLabel("排序")).toHaveValue("2")
    // And a page needs a component, so that part of the form is there.
    await expect(dialog.getByLabel("组件", { exact: true })).toHaveCount(1)
  })

  test("adding a button under a page asks for no component", async ({ page }) => {
    await gotoPage(page, "/system/views")
    await page.getByRole("button", { name: "为「组织」添加按钮" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel("类型", { exact: true })).toContainText("按钮")
    await expect(dialog.getByLabel("上级视图", { exact: true })).toContainText("组织")
    await expect(dialog.getByLabel("组件", { exact: true })).toHaveCount(0)
  })

  test("the kind and the status read as coloured labels", async ({ page }) => {
    await gotoPage(page, "/system/views")
    const rows = page.locator("table tbody tr")

    // 三个层级各一个标签；状态单独一个。
    await expect(rows.nth(0).locator(".rounded-full")).toHaveText(["菜单", "启用"])
    await expect(rows.nth(1).locator(".rounded-full")).toHaveText(["页面", "启用"])
    await expect(rows.nth(2).locator(".rounded-full")).toHaveText(["按钮", "启用"])
  })

  test("the level's colour sits on the icon, and hover only paints the row", async ({ page }) => {
    await gotoPage(page, "/system/views")
    const rows = page.locator("table tbody tr")
    const iconOf = (n: number) =>
      rows.nth(n).locator("td:first-child svg:not(.lucide-chevron-right)").first()

    const menuColour = await iconOf(0).evaluate((el) => getComputedStyle(el).color)
    const pageColour = await iconOf(1).evaluate((el) => getComputedStyle(el).color)
    // 菜单与页面是不同的颜色，否则图标上色没有意义。
    expect(menuColour).not.toBe(pageColour)

    const row = rows.nth(1)
    const backgroundBefore = await row.evaluate((el) => getComputedStyle(el).backgroundColor)
    await row.hover()
    await page.waitForTimeout(200)

    // 只有背景变。图标不是控件，悬停时变亮会让人以为能点。
    expect(await iconOf(1).evaluate((el) => getComputedStyle(el).color)).toBe(pageColour)
    expect(await row.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      backgroundBefore,
    )
  })

  test("row actions are coloured, and hovering one only paints its background", async ({
    page,
  }) => {
    await gotoPage(page, "/system/views")
    const row = page.locator("table tbody tr").filter({ hasText: "系统" })

    const colours: string[] = []
    for (const prefix of ["为「系统」", "编辑 系统", "删除 系统"]) {
      const button = row.locator(`button[aria-label^="${prefix}"]`).first()
      const icon = button.locator("svg").first()
      await expect(button).toBeVisible()

      const before = await icon.evaluate((el) => getComputedStyle(el).color)
      const backgroundBefore = await button.evaluate((el) => getComputedStyle(el).backgroundColor)
      colours.push(before)

      await button.hover()
      await page.waitForTimeout(200)

      // 颜色是图标自带的，不是悬停给的：悬停只加背景。
      expect(await icon.evaluate((el) => getComputedStyle(el).color)).toBe(before)
      expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
        backgroundBefore,
      )
      await page.mouse.move(0, 0)
    }

    // 添加 / 编辑 / 删除 各一种颜色。
    expect(new Set(colours).size).toBe(3)
  })
})
