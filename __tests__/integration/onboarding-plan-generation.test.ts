import { describe, expect, it, vi, beforeEach } from "vitest"

import type { GeneratedPlan } from "@/lib/ai/schemas"
import type { GenerationResult } from "@/lib/ai/generate-plan"
import type { Client } from "@/lib/db/mappers"

/**
 * Integration test for the onboarding -> AI generation -> persistence wiring.
 * Generation is now a standalone `generateOnboardingPlan` action that re-reads
 * the already-saved client via `getClient` (the save actions no longer trigger
 * the AI). The `getClient` data layer, the AI generator, and the plan
 * persistence layer are all mocked, so this asserts the orchestration: that a
 * valid generation is saved and an audit event recorded, that an invalid/failed
 * generation persists no plan and reports planGenerated: false, and that a
 * missing saved client is rejected.
 */

let currentUser: { id: string; email: string } | null = null
let savedClient: Client | null = null
let generationResult: GenerationResult
let savedPlans: GeneratedPlan[] = []
let recordedEvents: Array<{ status: string; planId?: string | null }> = []
let saveThrows = false

vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}))

vi.mock("@/lib/db/clients", () => ({
  getClient: async () => savedClient,
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

const { generateOnboardingPlan } = await import(
  "@/lib/onboarding/onboarding-actions"
)

/** A fully-onboarded client row as the data layer would return it. */
function client(): Client {
  return {
    userId: "user-1",
    fullName: "Dana Levi",
    phone: "+972541234567",
    age: 32,
    ageRange: null,
    goals: ["build_muscle"],
    fitnessLevel: "intermediate",
    limitations: null,
    availableDays: ["monday", "wednesday", "friday"],
    preferredLocation: "gym",
    equipment: ["dumbbells"],
    notes: null,
    onboardedAt: "2026-06-04T00:00:00.000Z",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
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
  savedClient = client()
  generationResult = { ok: true, plan: plan() }
  savedPlans = []
  recordedEvents = []
  saveThrows = false
})

describe("generateOnboardingPlan", () => {
  it("generates and saves a plan, recording a succeeded event", async () => {
    const result = await generateOnboardingPlan("en")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.planGenerated).toBe(true)
    expect(savedPlans).toHaveLength(1)
    expect(recordedEvents).toContainEqual({
      status: "succeeded",
      planId: "plan-1",
    })
  })

  it("saves nothing visible and reports failure when AI output is invalid", async () => {
    generationResult = { ok: false, reason: "invalid_output", issues: ["x"] }
    const result = await generateOnboardingPlan("en")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.planGenerated).toBe(false)
    expect(savedPlans).toHaveLength(0)
    expect(recordedEvents).toContainEqual({
      status: "failed",
      planId: undefined,
    })
  })

  it("reports failure when the AI call errors", async () => {
    generationResult = { ok: false, reason: "ai_error" }
    const result = await generateOnboardingPlan("he")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.planGenerated).toBe(false)
    expect(savedPlans).toHaveLength(0)
    expect(recordedEvents.some((e) => e.status === "failed")).toBe(true)
  })

  it("keeps the profile and reports failure when plan persistence throws", async () => {
    saveThrows = true
    const result = await generateOnboardingPlan("en")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.planGenerated).toBe(false)
    expect(recordedEvents.some((e) => e.status === "failed")).toBe(true)
  })

  it("fails when no saved client exists yet", async () => {
    savedClient = null
    const result = await generateOnboardingPlan("en")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("saveFailed")
    expect(savedPlans).toHaveLength(0)
  })

  it("fails when not signed in", async () => {
    currentUser = null
    const result = await generateOnboardingPlan("en")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("signedOut")
  })
})
