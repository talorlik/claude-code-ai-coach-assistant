import { describe, expect, it } from "vitest"

import {
  validateRegenerationReason,
  REGENERATION_REASON_MIN_LENGTH,
  REGENERATION_REASON_MAX_LENGTH,
} from "@/lib/validation/regeneration"

/**
 * Unit tests for the regeneration-reason validator (batch task 3: "require
 * regeneration reason"). The validator is the single source of truth shared by
 * the server actions and the trigger forms, so these assert the exact field
 * codes the UI localizes.
 */
describe("validateRegenerationReason", () => {
  it("accepts a reasonable trimmed reason", () => {
    const result = validateRegenerationReason("  Goals changed, want more cardio  ")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // The persisted reason is trimmed so callers store exactly what was checked.
    expect(result.data.reason).toBe("Goals changed, want more cardio")
  })

  it("rejects an empty or whitespace-only reason as required", () => {
    for (const raw of ["", "   ", "\n\t"]) {
      const result = validateRegenerationReason(raw)
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.fieldErrors?.reason).toBe("required")
    }
  })

  it("rejects null and undefined as required", () => {
    expect(validateRegenerationReason(null).ok).toBe(false)
    expect(validateRegenerationReason(undefined).ok).toBe(false)
  })

  it("rejects a reason below the minimum length as tooShort", () => {
    const tooShort = "a".repeat(REGENERATION_REASON_MIN_LENGTH - 1)
    const result = validateRegenerationReason(tooShort)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.reason).toBe("tooShort")
  })

  it("accepts a reason exactly at the minimum length", () => {
    const atMin = "a".repeat(REGENERATION_REASON_MIN_LENGTH)
    expect(validateRegenerationReason(atMin).ok).toBe(true)
  })

  it("rejects a reason over the maximum length as tooLong", () => {
    const tooLong = "a".repeat(REGENERATION_REASON_MAX_LENGTH + 1)
    const result = validateRegenerationReason(tooLong)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.reason).toBe("tooLong")
  })

  it("accepts a reason exactly at the maximum length", () => {
    const atMax = "a".repeat(REGENERATION_REASON_MAX_LENGTH)
    expect(validateRegenerationReason(atMax).ok).toBe(true)
  })
})
