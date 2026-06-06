import { describe, expect, it } from "vitest"

import {
  validateOnboarding,
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
    phone: "050-123-4567",
    age: "32",
    goals: ["build_muscle"],
    fitnessLevel: "intermediate",
    availableDays: ["monday", "wednesday", "friday"],
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
      expect(result.data.phone).toBe("0501234567")
      expect(result.data.goals).toEqual(["build_muscle"])
      expect(result.data.fitnessLevel).toBe("intermediate")
      expect(result.data.preferredLocation).toBe("gym")
    }
  })

  it("rejects a missing name", () => {
    const result = validateOnboarding(valid({ fullName: "A" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.fullName).toBe("invalid")
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
    const result = validateOnboarding(valid({ availableDays: ["sunday"] }))
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

  it("allows a blank phone but rejects a too-short one", () => {
    const blank = validateOnboarding(valid({ phone: "" }))
    const short = validateOnboarding(valid({ phone: "123" }))
    expect(blank.ok).toBe(true)
    if (blank.ok) expect(blank.data.phone).toBe("")
    expect(short.ok).toBe(false)
    if (!short.ok) expect(short.fieldErrors?.phone).toBe("invalid")
  })
})
