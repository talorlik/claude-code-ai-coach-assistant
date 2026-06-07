import { describe, expect, it } from "vitest"

import {
  COUNTRIES,
  countryByIso2,
  flagEmoji,
} from "@/lib/phone/countries"

describe("flagEmoji", () => {
  it("derives the regional-indicator emoji for an ISO2 code", () => {
    expect(flagEmoji("IL")).toBe("🇮🇱")
    expect(flagEmoji("US")).toBe("🇺🇸")
  })

  it("uppercases lowercase input before deriving", () => {
    expect(flagEmoji("il")).toBe("🇮🇱")
  })
})

describe("COUNTRIES dataset", () => {
  it("includes Israel with the correct dial code and names", () => {
    const il = countryByIso2("IL")
    expect(il).toBeDefined()
    expect(il?.dialCode).toBe("+972")
    expect(il?.nameEn).toBe("Israel")
    expect(il?.nameHe).toBe("ישראל")
  })

  it("has unique ISO2 codes and well-formed dial codes", () => {
    const seen = new Set<string>()
    for (const c of COUNTRIES) {
      expect(c.iso2).toMatch(/^[A-Z]{2}$/)
      expect(c.dialCode).toMatch(/^\+\d{1,4}$/)
      expect(c.nameEn.length).toBeGreaterThan(0)
      expect(c.nameHe.length).toBeGreaterThan(0)
      expect(seen.has(c.iso2)).toBe(false)
      seen.add(c.iso2)
    }
    expect(COUNTRIES.length).toBeGreaterThan(200)
  })

  it("countryByIso2 is case-insensitive and returns undefined for unknown", () => {
    expect(countryByIso2("il")?.iso2).toBe("IL")
    expect(countryByIso2("ZZ")).toBeUndefined()
  })
})
