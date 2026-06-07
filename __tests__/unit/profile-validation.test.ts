import { describe, expect, it } from "vitest"

import { validateProfile } from "@/lib/profile/profile-validation"

describe("validateProfile - phone and country", () => {
  it("accepts a valid E.164 phone with a known country", () => {
    const r = validateProfile({
      fullName: "Dana Levi",
      phone: "+972541234567",
      countryIso2: "IL",
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.phone).toBe("+972541234567")
      expect(r.data.countryIso2).toBe("IL")
    }
  })

  it("allows a blank phone and ignores the country", () => {
    const r = validateProfile({
      fullName: "Dana Levi",
      phone: "",
      countryIso2: "IL",
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.phone).toBe("")
      expect(r.data.countryIso2).toBeNull()
    }
  })

  it("rejects a malformed phone", () => {
    const r = validateProfile({
      fullName: "Dana Levi",
      phone: "+12",
      countryIso2: "US",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors?.phone).toBe("invalid")
  })

  it("rejects an unknown country when a phone is present", () => {
    const r = validateProfile({
      fullName: "Dana Levi",
      phone: "+972541234567",
      countryIso2: "ZZ",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors?.countryIso2).toBe("invalid")
  })

  it("rejects a too-short name with the length code", () => {
    const r = validateProfile({ fullName: "A", phone: "", countryIso2: "IL" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors?.fullName).toBe("length")
  })
})
