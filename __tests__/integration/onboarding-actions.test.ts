import { describe, expect, it, vi, beforeEach } from "vitest"

import type { OnboardingInput } from "@/lib/validation/onboarding"

/**
 * Integration test for the onboarding server actions' profile-save behavior.
 * The Supabase client is faked so the actions' real validation, auth check, and
 * upsert mapping run without a live database. `next/cache` is stubbed because
 * revalidatePath needs a request context. The fake `from().upsert()` records
 * the row written so the test can assert the snake_case payload the data layer
 * produced.
 *
 * The save actions (`saveOnboardingStep`, `saveOnboardingDetails`) no longer
 * trigger AI generation: that is now a separate `generateOnboardingPlan` action
 * exercised by `onboarding-plan-generation.test.ts`. These tests assert the
 * generation flow is NOT invoked on save.
 */

let currentUser: { id: string; email: string } | null = null
let upsertedRow: Record<string, unknown> | null = null
let upsertError: { message: string } | null = null
let generateCalled = false

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}))

vi.mock("@/lib/ai/generate-plan", () => ({
  generateWorkoutPlan: async () => {
    generateCalled = true
    return { ok: true, plan: { title: "Plan", workouts: [] } }
  },
}))

vi.mock("@/lib/db/plan-persistence", () => ({
  saveGeneratedPlan: async () => ({
    plan: { id: "plan-1" },
    workoutCount: 1,
    exerciseCount: 1,
  }),
  recordGenerationEvent: async () => {},
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser } }),
    },
    from() {
      return {
        upsert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              if (upsertError) return { data: null, error: upsertError }
              upsertedRow = row
              // Echo the row back as the saved record, adding the server-set
              // timestamps the real table would supply.
              return {
                data: {
                  ...row,
                  created_at: "2026-06-04T00:00:00.000Z",
                  updated_at: "2026-06-04T00:00:00.000Z",
                },
                error: null,
              }
            },
          }),
        }),
      }
    },
  }),
}))

import {
  saveOnboardingDetails,
  saveOnboardingStep,
} from "@/lib/onboarding/onboarding-actions"

/** A valid baseline payload; tests override individual fields. */
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

beforeEach(() => {
  currentUser = { id: "user-1", email: "dana@example.com" }
  upsertedRow = null
  upsertError = null
  generateCalled = false
})

describe("saveOnboardingDetails", () => {
  it("saves a complete profile and stamps completion, without generating", async () => {
    const result = await saveOnboardingDetails(valid())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.client.userId).toBe("user-1")
      expect(result.data.client.goals).toEqual(["build_muscle"])
    }
    expect(upsertedRow).toMatchObject({
      user_id: "user-1",
      full_name: "Dana Levi",
      phone: "+972541234567",
      country_iso2: "IL",
      age: 32,
      goals: ["build_muscle"],
      fitness_level: "intermediate",
      available_days: ["monday", "wednesday", "friday"],
      preferred_location: "gym",
      equipment: ["dumbbells", "bench"],
    })
    // Completion is stamped only by the final details save.
    expect(upsertedRow?.onboarded_at).toBeTruthy()
    // The save action must not trigger AI generation.
    expect(generateCalled).toBe(false)
  })

  it("updates existing onboarding data with new answers", async () => {
    // Simulate a returning client changing their goal, level, and schedule.
    const result = await saveOnboardingDetails(
      valid({
        goals: ["lose_weight"],
        fitnessLevel: "advanced",
        availableDays: ["tuesday", "thursday"],
        // Availability must match the new day set (cross-validated).
        availability: {
          tuesday: [{ start: "07:00", end: "09:00" }],
          thursday: [{ start: "19:00", end: "20:30" }],
        },
        equipment: [],
        age: "",
        ageRange: "40_49",
      })
    )
    expect(result.ok).toBe(true)
    expect(upsertedRow).toMatchObject({
      user_id: "user-1",
      goals: ["lose_weight"],
      fitness_level: "advanced",
      available_days: ["tuesday", "thursday"],
      equipment: [],
      age_range: "40_49",
    })
    // No exact age supplied this time: the row carries null, not a stale value.
    expect(upsertedRow?.age).toBeNull()
  })

  it("rejects an invalid payload without writing", async () => {
    const result = await saveOnboardingDetails(
      valid({ fullName: "", availableDays: [] })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors?.fullName).toBe("required")
      expect(result.fieldErrors?.availableDays).toBe("required")
    }
    expect(upsertedRow).toBeNull()
  })

  it("fails when not signed in", async () => {
    currentUser = null
    const result = await saveOnboardingDetails(valid())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("signedOut")
    expect(upsertedRow).toBeNull()
  })

  it("surfaces a save failure as a user-safe code", async () => {
    upsertError = { message: "db exploded" }
    const result = await saveOnboardingDetails(valid())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("saveFailed")
  })
})

describe("saveOnboardingStep", () => {
  it("writes only step 0 columns and never stamps completion", async () => {
    const result = await saveOnboardingStep(0, {
      fullName: "Dana Levi",
      phone: "+972541234567",
      countryIso2: "IL",
      age: "32",
      ageRange: "",
    })
    expect(result.ok).toBe(true)
    // Only the step-0 columns are present; later-step columns are omitted so a
    // partial upsert cannot clobber them.
    expect(upsertedRow).toMatchObject({
      user_id: "user-1",
      full_name: "Dana Levi",
      phone: "+972541234567",
      age: 32,
    })
    expect(upsertedRow).not.toHaveProperty("goals")
    expect(upsertedRow).not.toHaveProperty("available_days")
    // A partial save must not look like a completed onboarding.
    expect(upsertedRow).not.toHaveProperty("onboarded_at")
    expect(generateCalled).toBe(false)
  })

  it("persists country_iso2 on the step-0 save", async () => {
    const result = await saveOnboardingStep(0, valid())
    expect(result.ok).toBe(true)
    expect(upsertedRow).toMatchObject({
      user_id: "user-1",
      phone: "+972541234567",
      country_iso2: "IL",
    })
  })

  it("writes only step 1 columns", async () => {
    const result = await saveOnboardingStep(1, {
      fullName: "",
      goals: ["lose_weight"],
      fitnessLevel: "beginner",
      preferredLocation: "home",
    })
    expect(result.ok).toBe(true)
    expect(upsertedRow).toMatchObject({
      user_id: "user-1",
      goals: ["lose_weight"],
      fitness_level: "beginner",
      preferred_location: "home",
    })
    expect(upsertedRow).not.toHaveProperty("full_name")
    expect(upsertedRow).not.toHaveProperty("onboarded_at")
  })

  it("returns field errors for an invalid step without writing", async () => {
    const result = await saveOnboardingStep(0, {
      fullName: "",
      phone: "",
      age: "",
      ageRange: "",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("invalid")
      expect(result.fieldErrors?.fullName).toBe("required")
      expect(result.fieldErrors?.phone).toBe("required")
      expect(result.fieldErrors?.age).toBe("required")
    }
    expect(upsertedRow).toBeNull()
  })

  it("fails when not signed in", async () => {
    currentUser = null
    const result = await saveOnboardingStep(1, {
      fullName: "",
      goals: ["lose_weight"],
      fitnessLevel: "beginner",
      preferredLocation: "home",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("signedOut")
    expect(upsertedRow).toBeNull()
  })
})
