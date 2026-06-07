import { describe, expect, it } from "vitest"
import { isValidEmail, normalizePhone } from "@/lib/auth/validation"

describe("isValidEmail", () => {
  it("accepts a well-formed address", () => {
    expect(isValidEmail("dana@example.com")).toBe(true)
    expect(isValidEmail("  dana@example.com  ")).toBe(true)
  })

  it("accepts addresses using the allowed local-part symbols", () => {
    expect(isValidEmail("dana.levi+tag@sub.example.co.il")).toBe(true)
    expect(isValidEmail("a_b%c@example.com")).toBe(true)
  })

  it("rejects malformed addresses", () => {
    expect(isValidEmail("nope")).toBe(false)
    expect(isValidEmail("a@b")).toBe(false)
    expect(isValidEmail("a b@example.com")).toBe(false)
    expect(isValidEmail("")).toBe(false)
  })

  it("rejects a missing or too-short TLD and a trailing dot", () => {
    // The new regex requires a dot-separated TLD of at least two letters.
    expect(isValidEmail("dana@example")).toBe(false)
    expect(isValidEmail("dana@example.c")).toBe(false)
    expect(isValidEmail("dana@example.com.")).toBe(false)
    expect(isValidEmail("dana@@example.com")).toBe(false)
  })
})

describe("normalizePhone", () => {
  it("strips non-digits and keeps a single leading +", () => {
    expect(normalizePhone("050-123-4567")).toBe("0501234567")
    expect(normalizePhone("+972 50 123 4567")).toBe("+972501234567")
  })

  it("returns an empty string for no digits", () => {
    expect(normalizePhone("   ")).toBe("")
  })
})
