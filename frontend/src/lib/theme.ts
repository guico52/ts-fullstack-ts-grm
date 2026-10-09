/**
 * Theme rules as pure functions, so the store stays a thin binding.
 * Same split as url-filters: the logic is unit-tested, the reactive
 * wrapper is not (and does not need to be).
 */
export const THEMES = ["light", "dark", "system"] as const

export type Theme = (typeof THEMES)[number]
export type ResolvedTheme = "light" | "dark"

export const DEFAULT_THEME: Theme = "dark"

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value)
}

export function parseTheme(value: string | null | undefined): Theme {
  return isTheme(value) ? value : DEFAULT_THEME
}

/**
 * What the page shows for a stored preference. "system" defers to the OS,
 * and a missing preference resolves to dark — the app's default look, so a
 * first visit is never a flash of white.
 */
export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === "system") return prefersDark ? "dark" : "light"
  return theme
}
