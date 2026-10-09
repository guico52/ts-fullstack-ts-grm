import { expect, test, type Page } from "@playwright/test"

import { gotoPage, signIn } from "./helpers"

// 路由是登录之后才登记的：这里的每个用例都得先有一个会话，否则 gotoPage 会被
// 守卫送去 /login。（登录页自己的用例不在此列。）
test.beforeEach(async ({ page }) => {
  await signIn(page)
})

/**
 * The shared chrome of every resource list.
 *
 * Narrow on purpose: this covers the one piece of that chrome which talks
 * about the data at all — the delete confirmation. Everything else in
 * `ResourceListView` is exercised through the real pages.
 */
const BOOKS = [
  {
    id: "1",
    name: "三体",
    edition: 1,
    price: 23,
    store: { id: "1", name: "新华书店" },
    authors: [{ id: "1", name: "刘慈欣" }],
  },
]

async function mockBooks(page: Page) {
  const one = { data: BOOKS, total: BOOKS.length, limit: 10, offset: 0 }
  const empty = { data: [], total: 0, limit: 100, offset: 0 }
  await page.route("**/book/books**", (route) => route.fulfill({ json: one }))
  // 关联候选项：这张表有两个 from 字段，列表页挂载时就会去取。
  await page.route("**/book/stores**", (route) => route.fulfill({ json: empty }))
  await page.route("**/book/authors**", (route) => route.fulfill({ json: empty }))
}

test("the delete confirmation names the row and explains nothing", async ({ page }) => {
  await mockBooks(page)
  await gotoPage(page, "/library/books")

  await page.getByRole("button", { name: "删除 三体" }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()

  // 标题点名了要删哪一个，这就够了。
  await expect(dialog.getByText("删除「三体」？")).toBeVisible()

  // 描述是个空槽位：reka-ui 要求要么有描述、要么显式声明没有，而视觉上
  // 不该有话说（见 principles 第 21 条）。
  await expect(dialog.locator("[data-slot=alert-dialog-description]")).toHaveText("")

  // 这两句都在这里出现过，也都是错的：
  //   「该图书会被软删除……」   —— 实现细节，用户不关心行怎么存
  //   「删除后无法从界面恢复。」 —— 说得像数据没了，而写入其实是软删除，
  //                                行还在库里，只是界面上没有恢复入口
  await expect(dialog).not.toContainText("软删除")
  await expect(dialog).not.toContainText("恢复")
})

test("取消失效一次也不留下痕迹", async ({ page }) => {
  await mockBooks(page)
  await gotoPage(page, "/library/books")

  await page.getByRole("button", { name: "删除 三体" }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()

  await dialog.getByRole("button", { name: "取消" }).click()
  await expect(dialog).toBeHidden()
  // 行还在——取消就是取消。
  await expect(page.getByRole("button", { name: "删除 三体" })).toBeVisible()
})
