import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the trainer template server actions, focused on the
 * orchestration the data-layer tests do not cover:
 *
 * - Assigning a template materializes a concrete active plan for the client
 *   (via the shared `saveGeneratedPlan` path) and records a generation event.
 * - The per-client safety rule is re-enforced at assignment: a template missing
 *   safety notes is rejected for a client who declared limitations.
 * - Admin-only access: when `requireTrainerAdmin` redirects (throws, as Next's
 *   redirect does), the action does not perform any write.
 *
 * The auth guard, data access, AI generation, and persistence are all mocked so
 * the test asserts behavior without a database or network.
 */

const requireTrainerAdmin = vi.fn<() => Promise<string>>()
const getTemplate = vi.fn()
const getClient = vi.fn()
const saveGeneratedPlan = vi.fn()
const recordGenerationEvent = vi.fn()
const createTemplate = vi.fn()
const generateWorkoutPlan = vi.fn()

vi.mock("@/lib/auth/require-user", () => ({
  requireTrainerAdmin: () => requireTrainerAdmin(),
}))

vi.mock("@/lib/db/plan-templates", () => ({
  getTemplate: (...args: unknown[]) => getTemplate(...args),
  createTemplate: (...args: unknown[]) => createTemplate(...args),
  updateTemplate: vi.fn(),
  duplicateTemplate: vi.fn(),
}))

vi.mock("@/lib/db/clients", () => ({
  getClient: (...args: unknown[]) => getClient(...args),
}))

vi.mock("@/lib/db/plan-persistence", () => ({
  saveGeneratedPlan: (...args: unknown[]) => saveGeneratedPlan(...args),
  recordGenerationEvent: (...args: unknown[]) => recordGenerationEvent(...args),
}))

vi.mock("@/lib/ai/generate-plan", () => ({
  generateWorkoutPlan: (...args: unknown[]) => generateWorkoutPlan(...args),
}))

// next/cache is a no-op in this environment.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import {
  assignTemplateAction,
  createAiTemplateAction,
} from "@/lib/trainer/template-actions"

/** A valid plan body satisfying the workout-plan schema. */
function validPlan(withSafety = false) {
  return {
    title: "Plan",
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
            safety_notes: withSafety ? "Avoid deep range if knees hurt." : null,
          },
        ],
      },
    ],
  }
}

function templateRow(payload: unknown) {
  return {
    id: "t1",
    created_by: "admin-1",
    title: "Leg day",
    description: null,
    locale: "en-US",
    payload,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
  }
}

function clientModel(limitations: string | null) {
  return {
    userId: "client-1",
    fullName: "Dana",
    phone: null,
    age: null,
    ageRange: null,
    goal: null,
    fitnessLevel: null,
    limitations,
    availableDays: [],
    preferredLocation: null,
    equipment: [],
    notes: null,
    onboardedAt: null,
    createdAt: "",
    updatedAt: "",
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  requireTrainerAdmin.mockResolvedValue("admin-1")
})

describe("assignTemplateAction", () => {
  it("materializes a concrete plan and records a generation event", async () => {
    getTemplate.mockResolvedValue(templateRow(validPlan()))
    getClient.mockResolvedValue(clientModel(null))
    saveGeneratedPlan.mockResolvedValue({
      plan: { id: "plan-9", client_id: "client-1" },
      workoutCount: 1,
      exerciseCount: 1,
    })

    const result = await assignTemplateAction("t1", "client-1")

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.plan.id).toBe("plan-9")
    expect(result.data.workoutCount).toBe(1)

    // The plan is written through the shared never-save-a-partial path, stamped
    // as a template assignment and archiving the previous active plan.
    expect(saveGeneratedPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        source: "template",
        archivePrevious: true,
        localeTag: "en-US",
      })
    )
    expect(recordGenerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        triggeredBy: "admin-1",
        source: "template",
        status: "succeeded",
        planId: "plan-9",
      })
    )
  })

  it("rejects a template missing safety notes for a client with limitations", async () => {
    // The template body has no per-exercise safety notes; the client declared a
    // knee injury, so the per-client safety rule must block the assignment.
    getTemplate.mockResolvedValue(templateRow(validPlan(false)))
    getClient.mockResolvedValue(clientModel("Left knee injury"))

    const result = await assignTemplateAction("t1", "client-1")

    expect(result.ok).toBe(false)
    expect(saveGeneratedPlan).not.toHaveBeenCalled()
  })

  it("assigns when safety notes are present for a client with limitations", async () => {
    getTemplate.mockResolvedValue(templateRow(validPlan(true)))
    getClient.mockResolvedValue(clientModel("Left knee injury"))
    saveGeneratedPlan.mockResolvedValue({
      plan: { id: "plan-10" },
      workoutCount: 1,
      exerciseCount: 1,
    })

    const result = await assignTemplateAction("t1", "client-1")
    expect(result.ok).toBe(true)
    expect(saveGeneratedPlan).toHaveBeenCalledOnce()
  })

  it("fails cleanly when the template no longer exists", async () => {
    getTemplate.mockResolvedValue(null)
    getClient.mockResolvedValue(clientModel(null))

    const result = await assignTemplateAction("t1", "client-1")
    expect(result.ok).toBe(false)
    expect(saveGeneratedPlan).not.toHaveBeenCalled()
  })
})

describe("admin-only access", () => {
  it("does not write when requireTrainerAdmin redirects (throws)", async () => {
    // Next's redirect throws to halt rendering; the guard rejecting must abort
    // the action before any data access.
    requireTrainerAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"))

    await expect(assignTemplateAction("t1", "client-1")).rejects.toThrow()
    expect(getTemplate).not.toHaveBeenCalled()
    expect(saveGeneratedPlan).not.toHaveBeenCalled()
  })
})

describe("createAiTemplateAction", () => {
  it("saves a template from validated AI output via the generate seam", async () => {
    generateWorkoutPlan.mockResolvedValue({ ok: true, plan: validPlan() })
    createTemplate.mockResolvedValue(templateRow(validPlan()))

    const fakeGenerate = vi.fn()
    const result = await createAiTemplateAction(
      { title: "AI plan", locale: "en", goal: "strength" },
      fakeGenerate
    )

    expect(result.ok).toBe(true)
    expect(generateWorkoutPlan).toHaveBeenCalledOnce()
    expect(createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "admin-1", locale: "en-US" })
    )
  })

  it("saves nothing when AI generation fails", async () => {
    generateWorkoutPlan.mockResolvedValue({ ok: false, reason: "ai_error" })

    const result = await createAiTemplateAction(
      { title: "AI plan", locale: "en" },
      vi.fn()
    )

    expect(result.ok).toBe(false)
    expect(createTemplate).not.toHaveBeenCalled()
  })
})
