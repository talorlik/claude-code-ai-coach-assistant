import { describe, expect, it } from "vitest"
import { validateProfile } from "@/lib/profile/profile-validation"
import type { ProfileInput } from "@/lib/profile/profile-types"

function input(overrides: Partial<ProfileInput> = {}): ProfileInput {
  return { fullName: "Dana Levi", phone: "050-123-4567", ...overrides }
}

describe("validateProfile", () => {
  it("passes and normalizes valid input", () => {
    const result = validateProfile(input({ fullName: "  Dana Levi  " }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.fullName).toBe("Dana Levi")
      expect(result.data.phone).toBe("0501234567")
    }
  })

  it("requires a name of at least 2 chars", () => {
    const result = validateProfile(input({ fullName: "A" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.fullName).toBeTruthy()
  })

  it("allows an empty phone", () => {
    const result = validateProfile(input({ phone: "" }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.phone).toBe("")
  })

  it("rejects a phone with too few digits", () => {
    const result = validateProfile(input({ phone: "123" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.phone).toBeTruthy()
  })
})
