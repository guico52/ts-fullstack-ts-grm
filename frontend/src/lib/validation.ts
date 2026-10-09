/**
 * Field-level rules shared by every form.
 *
 * Kept in one place because these are exactly the rules that drift when
 * they are copied: two forms that each own an email regex will disagree
 * within a month, and the one that is wrong will be the one nobody looks
 * at.
 */

/**
 * Deliberately permissive: an address either has the shape of one or it
 * does not. Anything stricter starts rejecting addresses that are legal,
 * and the server is the real authority anyway.
 */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim())
}

export function isBlank(value: string): boolean {
  return value.trim() === ""
}

/**
 * A positive amount, from either shape a form field can produce.
 *
 * `Number(input.value)` is not enough: a number input hands over a number,
 * a text input a string, and an untouched field an empty string. All three
 * arrive here, and `Number("")` is 0 — which would read as "zero", not
 * "missing".
 */
export function parseAmount(value: string | number | null | undefined): number {
  const raw = String(value ?? "").trim()
  return raw === "" ? Number.NaN : Number(raw)
}
