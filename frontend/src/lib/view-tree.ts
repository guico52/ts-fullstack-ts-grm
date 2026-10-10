/**
 * The view tree, as plain functions.
 *
 * The API returns a flat list with `parentId`; the table needs rows in
 * display order with the depth to indent them by. That conversion is where
 * the edge cases live — a parent that was filtered out, a cycle, sibling
 * order — so it happens here, where it can be tested without a DOM.
 */

export interface ViewTreeRow {
  id: string
  parentId: string | null
  /** Sibling order; missing sorts as 0. */
  sort?: number
}

/** 共享行投影必须具备树字段；类型收窄保留原实体字段。 */
export function hasTreeFields<T extends { id?: string; parentId?: string | null }>(
  row: T,
): row is T & ViewTreeRow {
  return typeof row.id === "string" && (row.parentId === null || typeof row.parentId === "string")
}

export interface TreeLine<T> {
  row: T
  /** 0 for a root, 1 for its child, 2 for a button under that. */
  depth: number
  hasChildren: boolean
  expanded: boolean
}

function compare(a: ViewTreeRow, b: ViewTreeRow): number {
  const bySort = (Number(a.sort) || 0) - (Number(b.sort) || 0)
  if (bySort !== 0) return bySort
  return String(a.id).localeCompare(String(b.id))
}

/** Children keyed by parent id; `null` holds the roots. */
export function groupByParent<T extends ViewTreeRow>(rows: readonly T[]): Map<string | null, T[]> {
  const byParent = new Map<string | null, T[]>()
  for (const row of rows) {
    // A row whose parent is not in the list is shown as a root. The
    // alternative — dropping it — makes a filtered page look like the
    // subtree was deleted.
    const key = row.parentId === null ? null : String(row.parentId)
    const bucket = byParent.get(key)
    if (bucket) bucket.push(row)
    else byParent.set(key, [row])
  }
  for (const bucket of byParent.values()) bucket.sort(compare)
  return byParent
}

/**
 * The rows to render for the current expansion state, in tree order.
 *
 * Depth is what the table indents by. `hasChildren` drives the toggle — a
 * leaf must not get an expander that does nothing.
 */
export function flattenVisible<T extends ViewTreeRow>(
  rows: readonly T[],
  expanded: ReadonlySet<string>,
): Array<TreeLine<T>> {
  const byParent = groupByParent(rows)
  const known = new Set(rows.map((row) => String(row.id)))
  const out: Array<TreeLine<T>> = []
  const visited = new Set<string>()

  const walk = (parentKey: string | null, depth: number): void => {
    for (const row of byParent.get(parentKey) ?? []) {
      const id = String(row.id)
      // A cycle would otherwise recurse forever; the database cannot produce
      // one today, but a bad import can.
      if (visited.has(id)) continue
      visited.add(id)

      const children = byParent.get(id) ?? []
      const isExpanded = expanded.has(id)
      out.push({ row, depth, hasChildren: children.length > 0, expanded: isExpanded })
      if (children.length > 0 && isExpanded) walk(id, depth + 1)
    }
  }

  // Roots first. Then any row whose parent is *not in the list* is shown as
  // a root — a filtered or partial page must not look like a deleted
  // subtree. (Being unvisited is not the test: a collapsed child is
  // unvisited too, and must stay hidden.)
  walk(null, 0)
  for (const row of rows) {
    const parentId = row.parentId === null ? null : String(row.parentId)
    if (!visited.has(String(row.id)) && (parentId === null || !known.has(parentId))) {
      walk(parentId, 0)
    }
  }

  return out
}

/** Every id that has children — the default expansion for a first render. */
export function parentIds(rows: readonly ViewTreeRow[]): Set<string> {
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.parentId !== null) ids.add(String(row.parentId))
  }
  return ids
}

/**
 * Where a new row lands among its siblings: 1 for the first, otherwise one
 * past the highest in that level.
 *
 * Levels are counted separately — a menu with three pages does not push a
 * new top-level menu to 4. The backend computes the same thing inside the
 * insert transaction; this copy is what the form can show before saving.
 */
export function nextSort(rows: readonly ViewTreeRow[], parentId: string | null): number {
  const level = parentId === null ? "" : String(parentId)
  let highest = 0
  for (const row of rows) {
    if (String(row.parentId ?? "") !== level) continue
    const value = Number(row.sort)
    if (Number.isFinite(value) && value > highest) highest = value
  }
  return highest + 1
}
