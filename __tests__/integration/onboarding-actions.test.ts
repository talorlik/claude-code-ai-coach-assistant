import { describe, expect, it, vi, beforeEach } from "vitest"

import type { OnboardingInput } from "@/lib/validation/onboarding"

/**
 * Integration test for the onboarding server action's profile-save behavior.
 * The Supabase client is faked so the action's real validation, auth check, and
 * upsert mapping run without a live database. `next/cache` is stubbed because
 * revalidatePath needs a request context. The fake `from().upsert()` records
 * the row written so the test can assert the snake_case payload the data layer
 * produced.
 *
 * Since batch 08, saveOnboarding also triggers AI plan generation; that flow is
 * mocked here (generation succeeds with a no-op persistence) so these tests stay
 * focused on the profile save. The generation/persistence wiring is covered by
 * `onboarding-plan-generation.test.ts`.
 */

let currentUser: { id: string; email: string } | null = null
let upsertedRow: Record<string, unknown> | null = null
let upsertError: { message: string } | null = null

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}))

vi.mock("@/lib/ai/generate-plan", () => ({
  generateWorkoutPlan: async () => ({
    ok: true,
    plan: {
      title: "Plan",
      summary: null,
      safety_notes: "Not medical advice.",
      workouts: [
        {
          day_of_week: "monday",
          title: "Day 1",
          focus: null,
          notes: null,
          exercises: [
            {
              name: "Squat",
              sets: 3,
              reps: "10",
              duration: null,
              rest: "60s",
              instructions: null,
              safety_notes: null,
            },
          ],
        },
      ],
    },
  }),
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

import { saveOnboarding } from "@/lib/onboarding/onboarding-actions"

/** A valid baseline payload; tests override individual fields. */
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

beforeEach(() => {
  currentUser = { id: "user-1", email: "dana@example.com" }
  upsertedRow = null
  upsertError = null
})

describe("saveOnboarding", () => {
  it("saves a new client's onboarding answers", async () => {
    const result = await saveOnboarding(valid())
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Generation is mocked to succeed, so a plan is reported generated.
      expect(result.data.planGenerated).toBe(true)
      expect(result.data.client.userId).toBe("user-1")
      expect(result.data.client.goals).toEqual(["build_muscle"])
    }
    expect(upsertedRow).toMatchObject({
      user_id: "user-1",
      full_name: "Dana Levi",
      phone: "0501234567",
      age: 32,
      goals: ["build_muscle"],
      fitness_level: "intermediate",
      available_days: ["monday", "wednesday", "friday"],
      preferred_location: "gym",
      equipment: ["dumbbells", "bench"],
    })
    // Completion is stamped on save.
    expect(upsertedRow?.onboarded_at).toBeTruthy()
  })

  it("updates existing onboarding data with new answers", async () => {
    // Simulate a returning client changing their goal, level, and schedule.
    const result = await saveOnboarding(
      valid({
        goals: ["lose_weight"],
        fitnessLevel: "advanced",
        availableDays: ["tuesday", "thursday"],
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
    const result = await saveOnboarding(
      valid({ fullName: "", availableDays: [] })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors?.fullName).toBe("invalid")
      expect(result.fieldErrors?.availableDays).toBe("required")
    }
    expect(upsertedRow).toBeNull()
  })

  it("fails when not signed in", async () => {
    currentUser = null
    const result = await saveOnboarding(valid())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("signedOut")
    expect(upsertedRow).toBeNull()
  })

  it("surfaces a save failure as a user-safe code", async () => {
    upsertError = { message: "db exploded" }
    const result = await saveOnboarding(valid())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("saveFailed")
  })
})
