import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the core regeneration orchestration
 * ({@link regeneratePlanForClient}). These cover the batch's history-preservation
 * contract directly at the orchestration seam, with the client load, AI
 * generation, persistence, and audit all mocked so no database or network is hit:
 *
 * - A valid regeneration archives the prior active plan and inserts a new active
 *   plan via the shared `saveGeneratedPlan({ archivePrevious: true })` path, and
 *   records a `succeeded` event carrying the reason.
 * - An invalid AI response never calls `saveGeneratedPlan`, so the current active
 *   plan is left untouched; a `failed` event is still recorded.
 * - A persistence failure reports `save_error` and records a `failed` event
 *   (the writer itself rolls back any partial plan).
 * - A missing client cannot be regenerated for.
 */

const getClient = vi.fn()
const generateWorkoutPlan = vi.fn()
const saveGeneratedPlan = vi.fn()
const recordGenerationEvent = vi.fn()

vi.mock("@/lib/db/clients", () => ({
  getClient: (...args: unknown[]) => getClient(...args),
}))

vi.mock("@/lib/ai/generate-plan", () => ({
  generateWorkoutPlan: (...args: unknown[]) => generateWorkoutPlan(...args),
}))

vi.mock("@/lib/db/plan-persistence", () => ({
  saveGeneratedPlan: (...args: unknown[]) => saveGeneratedPlan(...args),
  recordGenerationEvent: (...args: unknown[]) => recordGenerationEvent(...args),
}))

import { regeneratePlanForClient } from "@/lib/ai/regenerate-plan"

function validPlan() {
  return {
    title: "Refreshed plan",
    summary: "Summary",
    safety_notes: "Not medical advice.",
    workouts: [
      {
        day_of_week: "monday",
        title: "Full body",
        focus: null,
        notes: null,
        exercises: [
          {
            name: "Squat",
            sets: 3,
            reps: "8-12",
            duration: null,
            rest: "60-90s",
            instructions: "Chest up.",
            safety_notes: null,
          },
        ],
      },
    ],
  }
}

function clientModel() {
  return {
    userId: "client-1",
    fullName: "Dana",
    phone: null,
    age: null,
    ageRange: null,
    goal: "strength",
    fitnessLevel: "intermediate",
    limitations: null,
    availableDays: ["monday"],
    preferredLocation: "gym",
    equipment: [],
    notes: null,
    onboardedAt: "2026-06-01T00:00:00.000Z",
    createdAt: "",
    updatedAt: "",
  }
}

const input = {
  clientId: "client-1",
  triggeredBy: "client-1",
  localeTag: "en-US" as const,
  reason: "Goals changed",
}

beforeEach(() => {
  vi.clearAllMocks()
  getClient.mockResolvedValue(clientModel())
})

describe("regeneratePlanForClient", () => {
  it("archives the old active plan and creates a new active plan on valid output", async () => {
    generateWorkoutPlan.mockResolvedValue({ ok: true, plan: validPlan() })
    saveGeneratedPlan.mockResolvedValue({
      plan: { id: "plan-new", client_id: "client-1", status: "active" },
      workoutCount: 1,
      exerciseCount: 1,
    })

    const result = await regeneratePlanForClient(input, vi.fn())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.id).toBe("plan-new")

    // History is preserved by archiving (not deleting) the prior plan, and the
    // new plan is written through the shared never-save-a-partial path, stamped
    // as a regeneration.
    expect(saveGeneratedPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        source: "regeneration",
        archivePrevious: true,
        localeTag: "en-US",
      })
    )
    expect(recordGenerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        triggeredBy: "client-1",
        source: "regeneration",
        status: "succeeded",
        planId: "plan-new",
        reason: "Goals changed",
      })
    )
  })

  it("does not replace the current active plan when AI output is invalid", async () => {
    // generateWorkoutPlan returns a typed failure for invalid output; the
    // orchestration must not archive or write anything.
    generateWorkoutPlan.mockResolvedValue({
      ok: false,
      reason: "invalid_output",
      issues: ["workouts: too few"],
    })

    const result = await regeneratePlanForClient(input, vi.fn())

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe("ai_error")
    // The crux of task 6: nothing is saved, so the old active plan stands.
    expect(saveGeneratedPlan).not.toHaveBeenCalled()
    // The failure is still audited, with the reason, for the trainer's history.
    expect(recordGenerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "regeneration",
        status: "failed",
        reason: "Goals changed",
      })
    )
  })

  it("reports save_error and audits a failure when persistence throws", async () => {
    generateWorkoutPlan.mockResolvedValue({ ok: true, plan: validPlan() })
    saveGeneratedPlan.mockRejectedValue(new Error("db down"))

    const result = await regeneratePlanForClient(input, vi.fn())

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe("save_error")
    expect(recordGenerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", reason: "Goals changed" })
    )
  })

  it("fails with no_client when the client profile is missing", async () => {
    getClient.mockResolvedValue(null)

    const result = await regeneratePlanForClient(input, vi.fn())

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe("no_client")
    expect(generateWorkoutPlan).not.toHaveBeenCalled()
    expect(saveGeneratedPlan).not.toHaveBeenCalled()
  })
})
