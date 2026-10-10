import { describe, expect, it } from "vitest"
import { validatePassword } from "./password"
describe("password validation", () => {
  it("rejects short, long and mismatched passwords", () => {
    expect(validatePassword("short", "short")).toHaveProperty("newPassword")
    expect(validatePassword("a".repeat(129), "a".repeat(129))).toHaveProperty("newPassword")
    expect(validatePassword("secret123", "different")).toHaveProperty("confirmation")
  })
  it("preserves spaces in valid passwords", () => {
    expect(validatePassword("  secret  ", "  secret  ")).toEqual({})
  })
})
