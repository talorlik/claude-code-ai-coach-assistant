import { describe, expect, it } from "vitest"

import {
  parseEquipmentOther,
  validateOnboarding,
  validateOnboardingStep,
  type OnboardingInput,
} from "@/lib/validation/onboarding"

/**
 * Unit tests for the pure onboarding validator. They exercise required fields,
 * the age / age-range either-or rule, available-days rules, equipment array
 * handling, and the optional free-text fields - the five areas the batch's task
 * breakdown calls out.
 */

/** A fully valid baseline payload; tests override individual fields. */
function valid(overrides: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    fullName: "Dana Levi",
    phone: "+972541234567",
    countryIso2: "IL",
    age: "32",
    goals: ["build_muscle"],
    fitnessLevel: "intermediate",
    availableDays: ["monday", "wednesday", "friday"],
    availability: {
      monday: [{ start: "06:00", end: "08:00" }],
      wednesday: [{ start: "06:00", end: "08:00" }],
      friday: [{ start: "18:00", end: "20:00" }],
    },
    sessionDurationMinutes: "45",
    preferredLocation: "gym",
    equipment: ["dumbbells", "bench"],
    limitations: "",
    notes: "",
    ...overrides,
  }
}

describe("validateOnboarding - required fields", () => {
  it("accepts a complete, valid payload and normalizes it", () => {
    const result = validateOnboarding(valid({ fullName: "  Dana Levi  " }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.fullName).toBe("Dana Levi")
      expect(result.data.phone).toBe("+972541234567")
      expect(result.data.goals).toEqual(["build_muscle"])
      expect(result.data.fitnessLevel).toBe("intermediate")
      expect(result.data.preferredLocation).toBe("gym")
    }
  })

  it("rejects an empty name as required", () => {
    const result = validateOnboarding(valid({ fullName: "   " }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.fullName).toBe("required")
  })

  it("rejects a too-short name as a length error", () => {
    const result = validateOnboarding(valid({ fullName: "A" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.fullName).toBe("length")
  })

  it("rejects a name longer than 30 characters as a length error", () => {
    const result = validateOnboarding(valid({ fullName: "x".repeat(31) }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.fullName).toBe("length")
  })

  it("accepts a 30-character name at the boundary", () => {
    const name = "a".repeat(30)
    const result = validateOnboarding(valid({ fullName: name }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.fullName).toBe(name)
  })

  it("rejects a name containing digits or symbols as a charset error", () => {
    const digits = validateOnboarding(valid({ fullName: "John123" }))
    const symbol = validateOnboarding(valid({ fullName: "שם!" }))
    expect(digits.ok).toBe(false)
    if (!digits.ok) expect(digits.fieldErrors?.fullName).toBe("chars")
    expect(symbol.ok).toBe(false)
    if (!symbol.ok) expect(symbol.fieldErrors?.fullName).toBe("chars")
  })

  it("accepts Hebrew letters, spaces, dots, and hyphens", () => {
    const hebrew = validateOnboarding(valid({ fullName: "ישראל ישראלי" }))
    const latin = validateOnboarding(valid({ fullName: "Anne-Marie O." }))
    expect(hebrew.ok).toBe(true)
    if (hebrew.ok) expect(hebrew.data.fullName).toBe("ישראל ישראלי")
    expect(latin.ok).toBe(true)
    if (latin.ok) expect(latin.data.fullName).toBe("Anne-Marie O.")
  })

  it("accepts a single goal", () => {
    const result = validateOnboarding(valid({ goals: ["build_muscle"] }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.goals).toEqual(["build_muscle"])
  })

  it("accepts multiple goals", () => {
    const result = validateOnboarding(
      valid({ goals: ["lose_weight", "build_muscle"] })
    )
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.data.goals).toEqual(["lose_weight", "build_muscle"])
  })

  it("requires at least one goal", () => {
    const result = validateOnboarding(valid({ goals: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.goals).toBe("required")
  })

  it("rejects an unknown goal", () => {
    const result = validateOnboarding(valid({ goals: ["become_a_wizard"] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.goals).toBe("invalid")
  })

  it("rejects duplicate goals", () => {
    const result = validateOnboarding(
      valid({ goals: ["build_muscle", "build_muscle"] })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.goals).toBe("invalid")
  })

  it("rejects a missing fitness level", () => {
    const result = validateOnboarding(valid({ fitnessLevel: "" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.fitnessLevel).toBe("required")
  })

  it("rejects a missing preferred location", () => {
    const result = validateOnboarding(valid({ preferredLocation: "" }))
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.fieldErrors?.preferredLocation).toBe("required")
  })
})

describe("validateOnboarding - age and age range", () => {
  it("accepts an exact age without a range", () => {
    const result = validateOnboarding(valid({ age: "40", ageRange: "" }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.age).toBe(40)
      expect(result.data.ageRange).toBeNull()
    }
  })

  it("accepts an age range without an exact age", () => {
    const result = validateOnboarding(valid({ age: "", ageRange: "30_39" }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.age).toBeNull()
      expect(result.data.ageRange).toBe("30_39")
    }
  })

  it("requires at least one of age or age range", () => {
    const result = validateOnboarding(valid({ age: "", ageRange: "" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.age).toBe("required")
  })

  it("rejects an out-of-range age", () => {
    const result = validateOnboarding(valid({ age: "5" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.age).toBe("invalid")
  })

  it("rejects a non-integer age", () => {
    const result = validateOnboarding(valid({ age: "32.5" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.age).toBe("invalid")
  })

  it("rejects an unknown age range", () => {
    const result = validateOnboarding(valid({ age: "", ageRange: "ancient" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.ageRange).toBe("invalid")
  })
})

describe("validateOnboarding - available days", () => {
  it("requires at least one day", () => {
    const result = validateOnboarding(valid({ availableDays: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.availableDays).toBe("required")
  })

  it("rejects an unknown day", () => {
    const result = validateOnboarding(
      valid({ availableDays: ["monday", "funday"] })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.availableDays).toBe("invalid")
  })

  it("rejects duplicate days", () => {
    const result = validateOnboarding(
      valid({ availableDays: ["monday", "monday"] })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.availableDays).toBe("invalid")
  })

  it("accepts a single valid day", () => {
    const result = validateOnboarding(
      valid({
        availableDays: ["sunday"],
        // Availability is cross-validated against the selected days, so the
        // window map must match the overridden day set.
        availability: { sunday: [{ start: "09:00", end: "11:00" }] },
      })
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.availableDays).toEqual(["sunday"])
  })
})

describe("validateOnboarding - equipment array handling", () => {
  it("accepts an empty equipment array", () => {
    const result = validateOnboarding(valid({ equipment: [] }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.equipment).toEqual([])
  })

  it("accepts a defined equipment list verbatim", () => {
    const result = validateOnboarding(
      valid({ equipment: ["dumbbells", "kettlebell"] })
    )
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.data.equipment).toEqual(["dumbbells", "kettlebell"])
  })

  it("rejects an unknown equipment value", () => {
    const result = validateOnboarding(valid({ equipment: ["jetpack"] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.equipment).toBe("invalid")
  })

  it("rejects duplicate equipment", () => {
    const result = validateOnboarding(
      valid({ equipment: ["bench", "bench"] })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.equipment).toBe("invalid")
  })

  it("defaults a missing equipment field to an empty array", () => {
    const result = validateOnboarding(valid({ equipment: undefined }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.equipment).toEqual([])
  })
})

describe("validateOnboarding - optional free text", () => {
  it("treats empty limitations as null (optional)", () => {
    const result = validateOnboarding(valid({ limitations: "   " }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.limitations).toBeNull()
  })

  it("keeps and trims provided limitations", () => {
    const result = validateOnboarding(
      valid({ limitations: "  bad knee  " })
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.limitations).toBe("bad knee")
  })

  it("treats empty notes as null and keeps provided notes", () => {
    const empty = validateOnboarding(valid({ notes: "" }))
    const filled = validateOnboarding(valid({ notes: "prefers mornings" }))
    expect(empty.ok && empty.data.notes).toBeNull()
    expect(filled.ok && filled.data.notes).toBe("prefers mornings")
  })

})

describe("validateOnboarding - phone (required, E.164)", () => {
  it("rejects a blank phone as required", () => {
    const result = validateOnboarding(valid({ phone: "  " }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.phone).toBe("required")
  })

  it("accepts an international number with a leading plus", () => {
    const result = validateOnboarding(valid({ phone: "+972 54-123-4567" }))
    expect(result.ok).toBe(true)
    // Normalized: separators stripped, leading + kept.
    if (result.ok) expect(result.data.phone).toBe("+972541234567")
  })

  it("rejects a number without a leading plus (selector always prepends one)", () => {
    // PHONE_RE now requires a leading "+"; the selector always supplies the
    // dial code, so a bare national-style number is not valid E.164.
    const result = validateOnboarding(valid({ phone: "972 54-123-4567" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.phone).toBe("invalid")
  })

  it("rejects a number with a leading zero (not E.164)", () => {
    // ^\+[1-9]\d{7,14}$ requires a leading "+" and forbids a 0 in the first
    // significant position, so a local-format number like 054-... must be
    // entered in its +country form.
    const local = validateOnboarding(valid({ phone: "054-123-4567" }))
    const plusZero = validateOnboarding(valid({ phone: "+0123456789" }))
    expect(local.ok).toBe(false)
    if (!local.ok) expect(local.fieldErrors?.phone).toBe("invalid")
    expect(plusZero.ok).toBe(false)
    if (!plusZero.ok) expect(plusZero.fieldErrors?.phone).toBe("invalid")
  })

  it("rejects a too-short phone", () => {
    const result = validateOnboarding(valid({ phone: "12345" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.phone).toBe("invalid")
  })

  it("rejects a too-long phone", () => {
    const result = validateOnboarding(valid({ phone: "+1234567890123456" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.phone).toBe("invalid")
  })
})

describe("validateOnboardingStep", () => {
  it("validates only step 0 fields, ignoring later steps", () => {
    // Missing goals (step 1) and availableDays (step 2) must not fail step 0.
    const errs = validateOnboardingStep(0, {
      fullName: "Dana Levi",
      phone: "+972541234567",
      countryIso2: "IL",
      age: "32",
      goals: [],
      availableDays: [],
    } as OnboardingInput)
    expect(errs).toEqual({})
  })

  it("reports step 0 field errors", () => {
    const errs = validateOnboardingStep(0, {
      fullName: "",
      phone: "",
      age: "",
      ageRange: "",
    } as OnboardingInput)
    expect(errs.fullName).toBe("required")
    expect(errs.phone).toBe("required")
    expect(errs.age).toBe("required")
  })

  it("validates only step 1 fields, ignoring name and phone", () => {
    const errs = validateOnboardingStep(1, {
      fullName: "",
      phone: "",
      goals: ["build_muscle"],
      fitnessLevel: "beginner",
      preferredLocation: "home",
    } as OnboardingInput)
    expect(errs).toEqual({})
  })

  it("requires availableDays on step 2 but ignores earlier steps", () => {
    const errs = validateOnboardingStep(2, {
      fullName: "",
      availableDays: [],
    } as OnboardingInput)
    expect(errs.availableDays).toBe("required")
    expect(errs.fullName).toBeUndefined()
  })
})

describe("validateOnboarding - phone and country", () => {
  it("accepts a valid E.164 phone with a known country", () => {
    const result = validateOnboarding(
      valid({ phone: "+972541234567", countryIso2: "IL" })
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.phone).toBe("+972541234567")
      expect(result.data.countryIso2).toBe("IL")
    }
  })

  it("rejects an empty phone as required", () => {
    const result = validateOnboarding(valid({ phone: "", countryIso2: "IL" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.phone).toBe("required")
  })

  it("rejects a malformed phone as invalid", () => {
    const result = validateOnboarding(
      valid({ phone: "+12", countryIso2: "US" })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.phone).toBe("invalid")
  })

  it("rejects an unknown country code as invalid", () => {
    const result = validateOnboarding(
      valid({ phone: "+972541234567", countryIso2: "ZZ" })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.countryIso2).toBe("invalid")
  })
})

describe("validateOnboardingStep - step 0 country", () => {
  it("flags an unknown country on step 0", () => {
    const errs = validateOnboardingStep(0, valid({ countryIso2: "ZZ" }))
    expect(errs.countryIso2).toBe("invalid")
  })
})

describe("availability windows", () => {
  it("accepts a window per selected day and normalizes order", () => {
    const result = validateOnboarding(
      valid({
        availableDays: ["monday"],
        availability: {
          monday: [
            { start: "18:00", end: "20:00" },
            { start: "06:00", end: "08:00" },
          ],
        },
      })
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Windows are returned sorted by start time.
      expect(result.data.availability.monday).toEqual([
        { start: "06:00", end: "08:00" },
        { start: "18:00", end: "20:00" },
      ])
    }
  })

  it("requires a window for every selected day", () => {
    const result = validateOnboarding(
      valid({
        availableDays: ["monday", "tuesday"],
        availability: { monday: [{ start: "06:00", end: "08:00" }] },
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.availability).toBe("required")
  })

  it("rejects a window for a day the client did not select", () => {
    const result = validateOnboarding(
      valid({
        availableDays: ["monday"],
        availability: {
          monday: [{ start: "06:00", end: "08:00" }],
          tuesday: [{ start: "06:00", end: "08:00" }],
        },
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.availability).toBe("invalid")
  })

  it("rejects a malformed HH:MM time", () => {
    const result = validateOnboarding(
      valid({
        availableDays: ["monday"],
        availability: { monday: [{ start: "6:00", end: "08:00" }] },
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.availability).toBe("invalid")
  })

  it("rejects start at or after end", () => {
    const result = validateOnboarding(
      valid({
        availableDays: ["monday"],
        availability: { monday: [{ start: "08:00", end: "08:00" }] },
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.availability).toBe("invalid")
  })

  it("rejects overlapping windows on the same day", () => {
    const result = validateOnboarding(
      valid({
        availableDays: ["monday"],
        availability: {
          monday: [
            { start: "06:00", end: "09:00" },
            { start: "08:00", end: "10:00" },
          ],
        },
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.availability).toBe("overlap")
  })

  it("rejects more than the per-day window cap", () => {
    const result = validateOnboarding(
      valid({
        availableDays: ["monday"],
        availability: {
          monday: [
            { start: "06:00", end: "07:00" },
            { start: "08:00", end: "09:00" },
            { start: "10:00", end: "11:00" },
            { start: "12:00", end: "13:00" },
            { start: "14:00", end: "15:00" },
          ],
        },
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.availability).toBe("invalid")
  })
})

describe("session duration", () => {
  it("requires a duration", () => {
    const result = validateOnboarding(valid({ sessionDurationMinutes: "" }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors?.sessionDurationMinutes).toBe("required")
    }
  })

  it("rejects a value that is not a multiple of 15", () => {
    const result = validateOnboarding(valid({ sessionDurationMinutes: "50" }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors?.sessionDurationMinutes).toBe("invalid")
    }
  })

  it("rejects a value below the minimum or above the maximum", () => {
    const low = validateOnboarding(valid({ sessionDurationMinutes: "0" }))
    expect(low.ok).toBe(false)
    if (!low.ok) expect(low.fieldErrors?.sessionDurationMinutes).toBe("range")
    const high = validateOnboarding(valid({ sessionDurationMinutes: "195" }))
    expect(high.ok).toBe(false)
    if (!high.ok) {
      expect(high.fieldErrors?.sessionDurationMinutes).toBe("range")
    }
  })

  it("accepts a valid 15-minute multiple and returns a number", () => {
    const result = validateOnboarding(valid({ sessionDurationMinutes: "90" }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.sessionDurationMinutes).toBe(90)
  })
})

describe("parseEquipmentOther", () => {
  it("returns an empty list when not selected and blank", () => {
    expect(parseEquipmentOther({ fullName: "" })).toEqual({ value: [] })
  })

  it("requires text when the Other toggle is on", () => {
    expect(
      parseEquipmentOther({
        fullName: "",
        equipmentOtherSelected: true,
        equipmentOther: "   ",
      })
    ).toEqual({ value: [], error: "required" })
  })

  it("splits, trims, and dedupes case-insensitively", () => {
    expect(
      parseEquipmentOther({
        fullName: "",
        equipmentOther: " Sled , battle ropes ,SLED, ",
      })
    ).toEqual({ value: ["Sled", "battle ropes"] })
  })

  it("rejects an item that exceeds the length cap", () => {
    const long = "x".repeat(41)
    expect(
      parseEquipmentOther({ fullName: "", equipmentOther: long })
    ).toEqual({ value: [], error: "length" })
  })

  it("rejects more items than the count cap", () => {
    const many = Array.from({ length: 11 }, (_, i) => `item${i}`).join(",")
    expect(
      parseEquipmentOther({ fullName: "", equipmentOther: many })
    ).toEqual({ value: [], error: "length" })
  })

  it("feeds the parsed list into the full validator result", () => {
    const result = validateOnboarding(
      valid({ equipmentOtherSelected: true, equipmentOther: "sled, prowler" })
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.equipmentOther).toEqual(["sled", "prowler"])
    }
  })
})

describe("new equipment members", () => {
  it("accepts a newly added closed-set equipment value", () => {
    const result = validateOnboarding(
      valid({ equipment: ["dumbbells", "rowing_machine", "trx"] })
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.equipment).toEqual([
        "dumbbells",
        "rowing_machine",
        "trx",
      ])
    }
  })

  it("still rejects an unknown equipment value", () => {
    const result = validateOnboarding(valid({ equipment: ["spaceship"] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.equipment).toBe("invalid")
  })
})
