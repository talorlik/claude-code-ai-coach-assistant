import { describe, expect, it, vi, beforeEach } from "vitest"

import type { OnboardingInput } from "@/lib/validation/onboarding"
import type { GeneratedPlan } from "@/lib/ai/schemas"
import type { GenerationResult } from "@/lib/ai/generate-plan"

/**
 * Integration test for the onboarding -> AI generation -> persistence wiring.
 * The Supabase client (auth + clients upsert), the AI generator, and the plan
 * persistence layer are all mocked, so this asserts the orchestration in
 * saveOnboarding: that a valid generation is saved and an audit event recorded,
 * and that an invalid/failed generation persists no plan and reports
 * planGenerated: false while keeping the profile.
 */

let currentUser: { id: string; email: string } | null = null
let generationResult: GenerationResult
let savedPlans: GeneratedPlan[] = []
let recordedEvents: Array<{ status: string; planId?: string | null }> = []
let saveThrows = false

vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from() {
      return {
        upsert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => ({
              data: {
                ...row,
                created_at: "2026-06-04T00:00:00.000Z",
                updated_at: "2026-06-04T00:00:00.000Z",
              },
              error: null,
            }),
          }),
        }),
      }
    },
  }),
}))

vi.mock("@/lib/ai/generate-plan", () => ({
  generateWorkoutPlan: async () => generationResult,
}))

vi.mock("@/lib/db/plan-persistence", () => ({
  saveGeneratedPlan: async ({ plan }: { plan: GeneratedPlan }) => {
    if (saveThrows) throw new Error("persist failed")
    savedPlans.push(plan)
    return { plan: { id: "plan-1" }, workoutCount: 1, exerciseCount: 1 }
  },
  recordGenerationEvent: async (input: {
    status: string
    planId?: string | null
  }) => {
    recordedEvents.push({ status: input.status, planId: input.planId })
  },
}))

const { saveOnboarding } = await import("@/lib/onboarding/onboarding-actions")

function validInput(overrides: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    fullName: "Dana Levi",
    phone: "050-123-4567",
    age: "32",
    goal: "build_muscle",
    fitnessLevel: "intermediate",
    availableDays: ["monday", "wednesday", "friday"],
    preferredLocation: "gym",
    equipment: ["dumbbells"],
    limitations: "",
    notes: "",
    ...overrides,
  }
}

function plan(): GeneratedPlan {
  return {
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
  }
}

beforeEach(() => {
  currentUser = { id: "user-1", email: "dana@example.com" }
  generationResult = { ok: true, plan: plan() }
  savedPlans = []
  recordedEvents = []
  saveThrows = false
})

describe("saveOnboarding plan generation", () => {
  it("generates and saves a plan, recording a succeeded event", async () => {
    const result = await saveOnboarding(validInput(), "en")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.planGenerated).toBe(true)
    expect(savedPlans).toHaveLength(1)
    expect(recordedEvents).toContainEqual({ status: "succeeded", planId: "plan-1" })
  })

  it("saves nothing visible and reports failure when AI output is invalid", async () => {
    generationResult = { ok: false, reason: "invalid_output", issues: ["x"] }
    const result = await saveOnboarding(validInput(), "en")
    expect(result.ok).toBe(true)
    if (result.ok) {
      // The profile is kept, but no plan was generated.
      expect(result.data.planGenerated).toBe(false)
      expect(result.data.client.userId).toBe("user-1")
    }
    expect(savedPlans).toHaveLength(0)
    expect(recordedEvents).toContainEqual({ status: "failed", planId: undefined })
  })

  it("reports failure when the AI call errors", async () => {
    generationResult = { ok: false, reason: "ai_error" }
    const result = await saveOnboarding(validInput(), "he")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.planGenerated).toBe(false)
    expect(savedPlans).toHaveLength(0)
    expect(recordedEvents.some((e) => e.status === "failed")).toBe(true)
  })

  it("keeps the profile and reports failure when plan persistence throws", async () => {
    saveThrows = true
    const result = await saveOnboarding(validInput(), "en")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.planGenerated).toBe(false)
    expect(recordedEvents.some((e) => e.status === "failed")).toBe(true)
  })

  it("does not attempt generation for an invalid onboarding payload", async () => {
    const result = await saveOnboarding(validInput({ fullName: "" }), "en")
    expect(result.ok).toBe(false)
    expect(savedPlans).toHaveLength(0)
    expect(recordedEvents).toHaveLength(0)
  })
})
