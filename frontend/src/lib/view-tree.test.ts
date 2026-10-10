import { describe, expect, it } from "vitest"

import { flattenVisible, groupByParent, nextSort, parentIds, type ViewTreeRow } from "./view-tree"

const row = (id: string, parentId: string | null, sort = 0): ViewTreeRow => ({ id, parentId, sort })

/** menu ─┬─ pageA ─┬─ buttonA1
 *        │         └─ buttonA2
 *        └─ pageB
 */
const TREE: ViewTreeRow[] = [
  row("menu", null),
  row("pageA", "menu", 1),
  row("pageB", "menu", 2),
  row("buttonA1", "pageA", 1),
  row("buttonA2", "pageA", 2),
]

describe("groupByParent", () => {
  it("keys children by parent, roots under null", () => {
    const groups = groupByParent(TREE)
    expect(groups.get(null)?.map((r) => r.id)).toEqual(["menu"])
    expect(groups.get("menu")?.map((r) => r.id)).toEqual(["pageA", "pageB"])
  })

  it("orders siblings by sort", () => {
    const unordered = [row("b", null, 2), row("a", null, 1)]
    expect(
      groupByParent(unordered)
        .get(null)
        ?.map((r) => r.id),
    ).toEqual(["a", "b"])
  })
})

describe("flattenVisible", () => {
  it("collapsed shows only the roots", () => {
    const lines = flattenVisible(TREE, new Set())
    expect(lines.map((line) => line.row.id)).toEqual(["menu"])
    expect(lines[0]?.hasChildren).toBe(true)
    expect(lines[0]?.expanded).toBe(false)
  })

  it("one level open shows that level, indented", () => {
    const lines = flattenVisible(TREE, new Set(["menu"]))
    expect(lines.map((line) => `${line.row.id}@${line.depth}`)).toEqual([
      "menu@0",
      "pageA@1",
      "pageB@1",
    ])
  })

  it("expanding deeper keeps the parent's position", () => {
    const lines = flattenVisible(TREE, new Set(["menu", "pageA"]))
    expect(lines.map((line) => `${line.row.id}@${line.depth}`)).toEqual([
      "menu@0",
      "pageA@1",
      "buttonA1@2",
      "buttonA2@2",
      "pageB@1",
    ])
  })

  it("marks a leaf as having no children, so it gets no toggle", () => {
    const lines = flattenVisible(TREE, new Set(["menu", "pageA"]))
    expect(lines.find((line) => line.row.id === "buttonA1")?.hasChildren).toBe(false)
  })

  it("shows a row whose parent is absent as a root rather than dropping it", () => {
    // A filtered or partial page must not look like a deleted subtree.
    const partial = [row("orphan", "missing-parent")]
    const lines = flattenVisible(partial, new Set())
    expect(lines.map((line) => line.row.id)).toEqual(["orphan"])
  })

  it("survives a cycle instead of recursing forever", () => {
    const cyclic = [row("a", "b"), row("b", "a")]
    // Both parents exist in the list, so neither is an orphan root; the point
    // here is only that this terminates.
    expect(() => flattenVisible(cyclic, new Set(["a", "b"]))).not.toThrow()
  })
})

describe("parentIds", () => {
  it("collects every id that is somebody's parent", () => {
    expect([...parentIds(TREE)].sort()).toEqual(["menu", "pageA"])
  })
})

describe("nextSort", () => {
  it("gives the first sibling 1", () => {
    expect(nextSort([], null)).toBe(1)
  })

  it("counts each level on its own", () => {
    const rows = [row("m1", null, 1), row("m2", null, 2), row("p1", "m1", 1), row("p2", "m1", 2)]
    // A menu with two pages does not push the next top-level menu to 4.
    expect(nextSort(rows, null)).toBe(3)
    expect(nextSort(rows, "m1")).toBe(3)
    expect(nextSort(rows, "m2")).toBe(1)
  })

  it("ignores siblings that belong to another parent", () => {
    const rows = [row("p1", "m1", 7)]
    expect(nextSort(rows, "m2")).toBe(1)
  })

  it("tolerates a missing or non-numeric sort", () => {
    // @ts-expect-error 模拟错误运行时 sort，同时验证静态契约拒绝字符串。
    const rows: ViewTreeRow[] = [row("a", null), { id: "b", parentId: null, sort: "3" }]
    expect(nextSort(rows, null)).toBe(4)
  })
})
