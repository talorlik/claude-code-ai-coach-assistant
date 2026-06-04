import { describe, expect, it } from "vitest"

import {
  toWhatsAppNumber,
  whatsAppLink,
  hasWhatsAppNumber,
} from "@/lib/trainer/phone"

/**
 * Unit tests for WhatsApp phone handling. `toWhatsAppNumber` produces the
 * digits-only international form `wa.me` expects (no `+`, no separators);
 * `hasWhatsAppNumber` decides whether the contact button should render at all;
 * `whatsAppLink` assembles the deep link (with an optional prefilled message).
 */

describe("toWhatsAppNumber", () => {
  it("strips separators and the leading plus from an international number", () => {
    expect(toWhatsAppNumber("+972 54-123-4567")).toBe("972541234567")
  })

  it("normalizes a number stored with parentheses and dashes", () => {
    expect(toWhatsAppNumber("+1 (415) 555-2671")).toBe("14155552671")
  })

  it("returns null for a number that is too short to be valid", () => {
    // Six digits cannot be a real international subscriber number.
    expect(toWhatsAppNumber("12345")).toBeNull()
  })

  it("returns null for a number that is implausibly long", () => {
    // E.164 caps the national+country number at 15 digits.
    expect(toWhatsAppNumber("+1234567890123456")).toBeNull()
  })

  it("returns null for null, empty, or non-digit input", () => {
    expect(toWhatsAppNumber(null)).toBeNull()
    expect(toWhatsAppNumber("")).toBeNull()
    expect(toWhatsAppNumber("   ")).toBeNull()
    expect(toWhatsAppNumber("not-a-phone")).toBeNull()
  })

  it("treats a bare 0 prefix as part of the number (no implicit country code)", () => {
    // Stored numbers without a country code keep their digits as-is; validity is
    // length-based, not locale-inferred.
    expect(toWhatsAppNumber("054-123-4567")).toBe("0541234567")
  })
})

describe("hasWhatsAppNumber", () => {
  it("is true for a valid international number", () => {
    expect(hasWhatsAppNumber("+972541234567")).toBe(true)
  })

  it("is false for an invalid or missing number", () => {
    expect(hasWhatsAppNumber(null)).toBe(false)
    expect(hasWhatsAppNumber("123")).toBe(false)
    expect(hasWhatsAppNumber("")).toBe(false)
  })
})

describe("whatsAppLink", () => {
  it("builds a wa.me deep link from a valid number", () => {
    expect(whatsAppLink("+972 54-123-4567")).toBe("https://wa.me/972541234567")
  })

  it("appends a url-encoded prefilled message when provided", () => {
    expect(whatsAppLink("+972541234567", "Hi Dana! How's training?")).toBe(
      "https://wa.me/972541234567?text=Hi%20Dana!%20How's%20training%3F"
    )
  })

  it("returns null when the number is invalid, so callers can hide the button", () => {
    expect(whatsAppLink("123")).toBeNull()
    expect(whatsAppLink(null)).toBeNull()
  })
})
