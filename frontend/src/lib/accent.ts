/**
 * Brand accent variants. Teal is the default and renders with no
 * data-accent attribute; the CSS blocks live in assets/main.css.
 *
 * Plain module on purpose: the store wires this to the DOM, but the rules
 * themselves (which values are legal, what the attribute should be, how to
 * fall back) are testable without mounting anything.
 */
export const ACCENTS = ["teal", "green", "copper"] as const

export type Accent = (typeof ACCENTS)[number]

export const DEFAULT_ACCENT: Accent = "teal"

export function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && (ACCENTS as readonly string[]).includes(value)
}

/** Falls back to the default for null, undefined or any unknown string. */
export function parseAccent(value: string | null | undefined): Accent {
  return isAccent(value) ? value : DEFAULT_ACCENT
}

/**
 * The data-accent attribute value for an accent, or null when the
 * attribute should be absent (the default needs no attribute, but its CSS
 * rule still exists so scoped previews can resolve against it).
 */
export function accentAttribute(accent: Accent): string | null {
  return accent === DEFAULT_ACCENT ? null : accent
}

/** Display names, shared by the header picker and the settings page. */
export const ACCENT_LABELS: Record<Accent, string> = {
  teal: "极光青",
  green: "峡湾绿",
  copper: "余烬铜",
}
