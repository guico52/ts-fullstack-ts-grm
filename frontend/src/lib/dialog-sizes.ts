/**
 * Dialog widths, as data.
 *
 * A dialog's width is a content decision, not a taste one: a single-column
 * form is unreadable stretched to 900px, and a two-column form is unusable
 * squeezed into 512px (two half-width inputs end up narrower than one full
 * one). Naming the sizes keeps that decision at the call site instead of
 * scattering `sm:max-w-*` overrides.
 */
export const DIALOG_SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
} as const

export type DialogSize = keyof typeof DIALOG_SIZES
