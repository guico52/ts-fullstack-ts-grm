/**
 * Pagination edge cases.
 *
 * The happy path is one assertion; the rest of this file is the two ways a
 * table goes blank on a user: a page number that outlives its data, and a
 * window that renders a lone ellipsis.
 */
import { describe, expect, it } from "vitest"

import { DEFAULT_PAGE_SIZE, clampPage, pageWindow, paginate, type PageSize } from "./pagination"

const ITEMS = Array.from({ length: 42 }, (_, index) => index + 1)

describe("paginate", () => {
  it("slices the requested page", () => {
    const page = paginate(ITEMS, 2, 10)
    expect(page.rows).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(page.page).toBe(2)
    expect(page.pageCount).toBe(5)
    expect(page.total).toBe(42)
    expect(page.from).toBe(11)
    expect(page.to).toBe(20)
  })

  it("returns the short last page", () => {
    const page = paginate(ITEMS, 5, 10)
    expect(page.rows).toEqual([41, 42])
    expect(page.from).toBe(41)
    expect(page.to).toBe(42)
  })

  it("clamps a page past the end instead of returning nothing", () => {
    // The delete-the-last-row-on-page-3 case: the page number outlives the
    // data, and an unclamped slice would render an empty table with rows
    // still sitting behind it.
    const page = paginate(ITEMS, 99, 10)
    expect(page.page).toBe(5)
    expect(page.rows).toHaveLength(2)
  })

  it("clamps a page below the start", () => {
    expect(paginate(ITEMS, 0, 10).page).toBe(1)
    expect(paginate(ITEMS, -4, 10).page).toBe(1)
  })

  it("survives a NaN page", () => {
    expect(paginate(ITEMS, Number.NaN, 10).page).toBe(1)
  })

  it("keeps one page for an empty set", () => {
    const page = paginate([], 1, 10)
    expect(page.rows).toEqual([])
    expect(page.pageCount).toBe(1)
    expect(page.page).toBe(1)
    expect(page.from).toBe(0)
    expect(page.to).toBe(0)
  })

  it("falls back to the default size for a nonsensical pageSize", () => {
    expect(paginate(ITEMS, 1, 0).pageSize).toBe(DEFAULT_PAGE_SIZE)
    expect(paginate(ITEMS, 1, Number.NaN).pageSize).toBe(DEFAULT_PAGE_SIZE)
    expect(paginate(ITEMS, 1, -10).pageSize).toBe(DEFAULT_PAGE_SIZE)
  })

  it("covers every row exactly once across all pages", () => {
    const collected: number[] = []
    const first = paginate(ITEMS, 1, 10)
    for (let page = 1; page <= first.pageCount; page += 1) {
      collected.push(...paginate(ITEMS, page, 10).rows)
    }
    expect(collected).toEqual(ITEMS)
  })

  it("does not mutate the input", () => {
    const original = [...ITEMS]
    paginate(ITEMS, 2, 10)
    expect(ITEMS).toEqual(original)
  })
})

describe("clampPage", () => {
  it("keeps a legal page", () => {
    expect(clampPage(3, 5)).toBe(3)
  })

  it("pulls anything else into range", () => {
    expect(clampPage(0, 5)).toBe(1)
    expect(clampPage(-1, 5)).toBe(1)
    expect(clampPage(6, 5)).toBe(5)
    expect(clampPage(Number.NaN, 5)).toBe(1)
    expect(clampPage(2.7, 5)).toBe(2)
  })

  it("never returns less than 1, even with a zero page count", () => {
    expect(clampPage(1, 0)).toBe(1)
    expect(clampPage(5, 0)).toBe(1)
  })
})

describe("pageWindow", () => {
  it("renders a single page without decoration", () => {
    expect(pageWindow(1, 1)).toEqual([1])
  })

  it("renders every number when they all fit", () => {
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it("puts a hole on both sides in the middle of a long run", () => {
    expect(pageWindow(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10])
  })

  it("keeps the first and last page always visible", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, "ellipsis", 10])
    expect(pageWindow(10, 10)).toEqual([1, "ellipsis", 9, 10])
  })

  it("shows the number instead of an ellipsis standing in for one page", () => {
    // 7 pages: every hole is exactly one page wide, so nothing should be hidden.
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("widens with a larger span", () => {
    // span=2 covers 3..7; the gap down from 3 to 1 is exactly one page, so
    // page 2 is shown rather than hidden behind an ellipsis.
    expect(pageWindow(5, 20, 2)).toEqual([1, 2, 3, 4, 5, 6, 7, "ellipsis", 20])
  })

  it("clamps an out-of-range current page before windowing", () => {
    expect(pageWindow(99, 3)).toEqual([1, 2, 3])
  })

  it("returns nothing for a zero page count", () => {
    expect(pageWindow(1, 0)).toEqual([])
  })

  it("never emits two adjacent ellipses or a leading/trailing one", () => {
    for (const pageCount of [1, 2, 5, 8, 9, 10, 50]) {
      for (let current = 1; current <= pageCount; current += 1) {
        const window = pageWindow(current, pageCount)
        expect(window[0], `pageCount=${pageCount} current=${current}`).not.toBe("ellipsis")
        expect(window.at(-1), `pageCount=${pageCount} current=${current}`).not.toBe("ellipsis")
        expect(
          window.filter((v) => v === "ellipsis").length,
          `pageCount=${pageCount} current=${current}`,
        ).toBeLessThanOrEqual(2)
      }
    }
  })

  it("only ever lists pages that exist", () => {
    const window = pageWindow(5, 10)
    for (const value of window) {
      if (value !== "ellipsis") {
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeLessThanOrEqual(10)
      }
    }
  })
})

describe("page size options", () => {
  it("are the ones the default paginator offers", () => {
    const sizes: readonly PageSize[] = [10, 25, 50, 100]
    expect(sizes).toContain(DEFAULT_PAGE_SIZE)
  })
})
