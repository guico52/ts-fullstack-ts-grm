import { describe, expect, it } from "vitest"

import { AUTHORS, BOOKS, STORES } from "./books"

/**
 * The library specs, as data.
 *
 * These are thin, and deliberately so: the point is not to restate the table
 * but to pin the two things that fail **silently** if they are dropped —
 * a step a money column needs, and the shape `toForm` reads out of a row.
 */
describe("library resources", () => {
  it("定价 declares the step its column can actually hold", () => {
    const price = BOOKS.fields.find((field) => field.key === "price")

    // `numeric(10, 2)` means 88.50 is a legal value. An `<input type="number">`
    // defaults to step=1, which makes 88.50 fail HTML5 validation — and a form
    // that fails validation never fires `submit`, so the only symptom is a
    // 保存 button that appears to do nothing. Nothing else catches this.
    expect(price?.kind).toBe("number")
    expect(price?.step).toBe(0.01)
  })

  it("版次 is a whole number", () => {
    const edition = BOOKS.fields.find((field) => field.key === "edition")
    expect(edition?.kind).toBe("number")
    // No step of its own: the default of 1 is what a 版次 wants.
    expect(edition?.step).toBeUndefined()
  })

  it("定价 keeps two decimals in the table", () => {
    const price = BOOKS.columns.find((column) => column.key === "price")
    // The API returns numeric as a number, so 88.50 arrives as 88.5.
    expect(price?.value({ price: 88.5 })).toBe("88.50")
    expect(price?.value({ price: 128 })).toBe("128.00")
    // @ts-expect-error 验证异常运行时数据；API 的 price 静态契约不允许 null。
    expect(price?.value({ price: null })).toBe("—")
  })

  it("作者 reads as a list, not a count", () => {
    const authors = BOOKS.columns.find((column) => column.key === "authors")
    expect(
      authors?.value({
        authors: [
          { id: "1", name: "甲" },
          { id: "2", name: "乙" },
        ],
      }),
    ).toBe("甲、乙")
    expect(authors?.value({ authors: [] })).toBe("—")
  })

  it("toForm pulls the store id out of the nested object and authors out of the list", () => {
    expect(
      BOOKS.toForm({
        name: "书",
        edition: 2,
        price: 88.5,
        store: { id: "10", name: "书店" },
        authors: [
          { id: "9", name: "甲" },
          { id: "10", name: "乙" },
        ],
      }),
    ).toEqual({ name: "书", edition: 2, price: 88.5, storeId: "10", authorIds: ["9", "10"] })
  })

  it("toForm tolerates a missing store rather than inventing one", () => {
    // @ts-expect-error 验证异常运行时关联；API 的 authors 静态契约不允许 null。
    expect(BOOKS.toForm({ name: "书", store: null, authors: null })).toMatchObject({
      storeId: undefined,
      authorIds: [],
    })
  })

  it("only 图书 carries relation fields", () => {
    const withRelation = (spec: typeof BOOKS) => spec.fields.filter((f) => f.from !== undefined)
    expect(withRelation(BOOKS).map((f) => f.key)).toEqual(["storeId", "authorIds"])
    // 作者与书店是被指向的一方，写入发生在图书那侧。
    expect(withRelation(AUTHORS)).toEqual([])
    expect(withRelation(STORES)).toEqual([])
  })
})
