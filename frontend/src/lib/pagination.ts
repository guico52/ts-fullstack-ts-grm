/**
 * Pagination rules as plain functions.
 *
 * Two things here are easy to get wrong and invisible until a user hits
 * them: a page number that outlives the data it pointed at (delete the last
 * row on page 3 and the table goes blank), and an ellipsis window that
 * collapses into a lonely "…" between two adjacent numbers.
 */

export const PAGE_SIZES = [10, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

export const DEFAULT_PAGE_SIZE: PageSize = 10

export interface Page<T> {
  rows: T[]
  /** 1-based, always within [1, pageCount]. */
  page: number
  pageSize: number
  /** At least 1, so an empty result still has a page to be on. */
  pageCount: number
  total: number
  /** 1-based index of the first row shown; 0 when there are no rows. */
  from: number
  to: number
}

/** Coerces anything into a usable page number. NaN, 0, -3 and 999 all land
 *  somewhere real, which is what keeps a stale page from emptying the table. */
export function clampPage(page: number, pageCount: number): number {
  const last = Math.max(1, Math.trunc(pageCount) || 1)
  if (!Number.isFinite(page)) return 1
  return Math.min(Math.max(1, Math.trunc(page)), last)
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const total = items.length
  const size = Number.isFinite(pageSize) && pageSize >= 1 ? Math.trunc(pageSize) : DEFAULT_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(total / size))
  const safePage = clampPage(page, pageCount)
  const start = (safePage - 1) * size
  const rows = items.slice(start, start + size)

  return {
    rows,
    page: safePage,
    pageSize: size,
    pageCount,
    total,
    // "1–10 of 42" reads as a position in the whole set; "1–10 of 10" on
    // the last page is the same sentence with different numbers.
    from: total === 0 ? 0 : start + 1,
    to: start + rows.length,
  }
}

/**
 * The page numbers to render, with "ellipsis" holes.
 *
 * The first and last page are always present so the control does not
 * reshape as the user walks it, and a hole of exactly one page renders the
 * number instead of an ellipsis — a lone "…" standing in for a single value
 * is strictly worse than the value.
 */
export function pageWindow(
  current: number,
  pageCount: number,
  span = 1,
): Array<number | "ellipsis"> {
  if (pageCount <= 0) return []
  const safeCurrent = clampPage(current, pageCount)

  const wanted = new Set<number>([1, pageCount])
  for (let page = safeCurrent - span; page <= safeCurrent + span; page += 1) {
    if (page >= 1 && page <= pageCount) wanted.add(page)
  }

  const sorted = [...wanted].sort((a, b) => a - b)
  const out: Array<number | "ellipsis"> = []
  let previous = 0

  for (const page of sorted) {
    if (previous > 0 && page - previous > 1) {
      if (page - previous === 2) out.push(previous + 1)
      else out.push("ellipsis")
    }
    out.push(page)
    previous = page
  }

  return out
}

/** True when a hole should be drawn, for the template's aria-hidden marks. */
export function isEllipsis(value: number | "ellipsis"): value is "ellipsis" {
  return value === "ellipsis"
}

/**
 * The numbers `DataPagination` needs, for a table the **server** paginates.
 *
 * The rows are not here — they came from the API — so only the window we
 * asked for and the total we were told are known. Deriving the display
 * numbers in one place keeps the views free of arithmetic that is easy to
 * get subtly wrong (“0–0 of 0” being the classic one).
 */
export interface PageInfo {
  /** 1-based, clamped into [1, pageCount]. */
  page: number
  pageSize: number
  pageCount: number
  total: number
  /** 0 when there are no rows, so an empty table cannot claim to show row 1. */
  from: number
  to: number
}

export function pageInfoOf(total: number, limit: number, offset: number): PageInfo {
  const size = Number.isFinite(limit) && limit >= 1 ? Math.trunc(limit) : DEFAULT_PAGE_SIZE
  const safeTotal = Math.max(0, Math.trunc(total))
  const safeOffset = Math.max(0, Math.trunc(offset))
  const pageCount = Math.max(1, Math.ceil(safeTotal / size))

  return {
    page: clampPage(Math.floor(safeOffset / size) + 1, pageCount),
    pageSize: size,
    pageCount,
    total: safeTotal,
    from: safeTotal === 0 ? 0 : Math.min(safeOffset + 1, safeTotal),
    to: Math.min(safeOffset + size, safeTotal),
  }
}
