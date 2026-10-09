import { describe, expect, it } from "vitest"

import { isBlank, isEmail, parseAmount } from "./validation"

describe("isEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isEmail("ada@example.com")).toBe(true)
    expect(isEmail("first.last+tag@sub.example.co.uk")).toBe(true)
  })

  it("ignores surrounding whitespace", () => {
    expect(isEmail("  ada@example.com  ")).toBe(true)
  })

  it("rejects the shapes people actually mistype", () => {
    expect(isEmail("ada@example")).toBe(false)
    expect(isEmail("ada example.com")).toBe(false)
    expect(isEmail("@example.com")).toBe(false)
    expect(isEmail("ada@")).toBe(false)
    expect(isEmail("")).toBe(false)
  })

  it("stays permissive rather than inventing rules", () => {
    // Not a great address, but it has the shape of one and the server is
    // the real authority. Rejecting it here would be a false negative.
    expect(isEmail("a@b.c")).toBe(true)
  })
})

describe("isBlank", () => {
  it("treats whitespace as empty", () => {
    expect(isBlank("")).toBe(true)
    expect(isBlank("   ")).toBe(true)
    expect(isBlank("\t\n")).toBe(true)
    expect(isBlank(" x ")).toBe(false)
  })
})

describe("parseAmount", () => {
  it("reads a number from either shape a field can produce", () => {
    // A number input hands over a number; a text input a string.
    expect(parseAmount(42)).toBe(42)
    expect(parseAmount("42")).toBe(42)
    expect(parseAmount(" 42.5 ")).toBe(42.5)
    expect(parseAmount(0)).toBe(0)
  })

  it("reports a missing value as NaN, never as zero", () => {
    // Number("") is 0, which would read as "zero" instead of "missing".
    expect(Number.isNaN(parseAmount(""))).toBe(true)
    expect(Number.isNaN(parseAmount("   "))).toBe(true)
    expect(Number.isNaN(parseAmount(null))).toBe(true)
    expect(Number.isNaN(parseAmount(undefined))).toBe(true)
  })

  it("reports unparseable text as NaN", () => {
    expect(Number.isNaN(parseAmount("abc"))).toBe(true)
    expect(Number.isNaN(parseAmount("1,5"))).toBe(true)
  })
})
