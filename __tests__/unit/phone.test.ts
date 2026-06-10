import { describe, expect, it } from "vitest"

import { countryByIso2 } from "@/lib/phone/countries"
import { combineE164, matchCountry, splitE164 } from "@/lib/phone/phone"

const IL = countryByIso2("IL")!
const US = countryByIso2("US")!

describe("combineE164", () => {
  it("strips separators from the national part and prepends the dial code", () => {
    expect(combineE164("+972", "054-123 4567")).toBe("+972541234567")
  })

  it("ignores a national part that already contains the dial digits", () => {
    expect(combineE164("+1", "(415) 555-0123")).toBe("+14155550123")
  })

  it("returns an empty string when the national part has no digits", () => {
    expect(combineE164("+972", "")).toBe("")
  })

  it("drops a single leading trunk-0 for the common case", () => {
    expect(combineE164("+972", "0541234567")).toBe("+972541234567")
  })

  it("preserves the leading 0 for keep-the-zero dial codes (Italy)", () => {
    expect(combineE164("+39", "0612345678")).toBe("+390612345678")
  })
})

describe("splitE164", () => {
  it("uses the stored iso2 to resolve a shared dial code exactly", () => {
    expect(splitE164("+14155550123", "CA").country.iso2).toBe("CA")
    expect(splitE164("+14155550123", "US").country.iso2).toBe("US")
  })

  it("returns the national number without the dial code", () => {
    const r = splitE164("+972541234567", "IL")
    expect(r.country.iso2).toBe("IL")
    expect(r.national).toBe("541234567")
  })

  it("falls back to longest dial-code prefix match when iso2 is null", () => {
    expect(splitE164("+972541234567", null).country.iso2).toBe("IL")
  })

  it("falls back to the default country when unparseable", () => {
    expect(splitE164("", null).country.iso2).toBe("IL")
    expect(splitE164("+000000", null).country.iso2).toBe("IL")
  })

  it("ignores a stored iso2 whose dial code does not prefix the number", () => {
    expect(splitE164("+972541234567", "US").country.iso2).toBe("IL")
  })

  it("round-trips a keep-the-zero Italian number through split -> combine", () => {
    // Acceptance for the combineE164 trunk-0 tech-debt item: a stored Italian
    // E.164 whose national part keeps the leading 0 must survive an edit cycle.
    const stored = "+390612345678"
    const { country, national } = splitE164(stored, "IT")
    expect(country.iso2).toBe("IT")
    expect(national).toBe("0612345678")
    expect(combineE164(country.dialCode, national)).toBe(stored)
  })
})

describe("matchCountry", () => {
  it("matches on dial code with or without a leading +", () => {
    expect(matchCountry("972", IL)).toBe(true)
    expect(matchCountry("+972", IL)).toBe(true)
  })

  it("matches on ISO2 code, case-insensitively", () => {
    expect(matchCountry("il", IL)).toBe(true)
    expect(matchCountry("IL", IL)).toBe(true)
  })

  it("matches on English and Hebrew names, as substrings", () => {
    expect(matchCountry("isr", IL)).toBe(true)
    expect(matchCountry("ישר", IL)).toBe(true)
  })

  it("does not match unrelated queries", () => {
    expect(matchCountry("france", IL)).toBe(false)
    expect(matchCountry("+1", IL)).toBe(false)
  })

  it("matches everything on an empty query", () => {
    expect(matchCountry("", IL)).toBe(true)
    expect(matchCountry("  ", US)).toBe(true)
  })
})
