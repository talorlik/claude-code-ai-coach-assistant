import { describe, expect, it } from "vitest"

import { generateWorkoutPlan, type ObjectGenerator } from "@/lib/ai/generate-plan"
import type { GeneratedPlan } from "@/lib/ai/schemas"
import type { Client } from "@/lib/db/mappers"

/**
 * Integration test for the AI generation flow with a mocked object generator.
 * No network or AI Gateway is touched: the generator seam is injected. Covers
 * the three outcomes the flow must distinguish - valid plan, model error, and
 * structurally-invalid model output - so persistence only ever sees valid data.
 */

function client(overrides: Partial<Client> = {}): Client {
  return {
    userId: "user-1",
    fullName: "Dana Levi",
    phone: null,
    age: 32,
    ageRange: null,
    goal: "build_muscle",
    fitnessLevel: "intermediate",
    limitations: null,
    availableDays: ["monday", "wednesday"],
    preferredLocation: "gym",
    equipment: ["dumbbells"],
    notes: null,
    onboardedAt: "2026-06-04T00:00:00.000Z",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    ...overrides,
  }
}

function validPlan(): GeneratedPlan {
  return {
    title: "Plan",
    summary: null,
    safety_notes: "Stop if you feel pain; this is not medical advice.",
    workouts: [
      {
        day_of_week: "monday",
        title: "Day 1",
        focus: "strength",
        notes: null,
        exercises: [
          {
            name: "Squat",
            sets: 3,
            reps: "10",
            duration: null,
            rest: "60s",
            instructions: "Brace your core.",
            safety_notes: "Keep a neutral spine.",
          },
        ],
      },
    ],
  }
}

/** A generator that returns a fixed object. */
function fixedGenerator(object: unknown): ObjectGenerator {
  return async () => ({ object })
}

describe("generateWorkoutPlan", () => {
  it("returns a validated plan on valid model output", async () => {
    const result = await generateWorkoutPlan(
      client(),
      "en-US",
      fixedGenerator(validPlan())
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.title).toBe("Plan")
  })

  it("passes the schema, system prompt, and built user prompt to the generator", async () => {
    let seen: Parameters<ObjectGenerator>[0] | null = null
    const spy: ObjectGenerator = async (args) => {
      seen = args
      return { object: validPlan() }
    }
    await generateWorkoutPlan(client(), "he-IL", spy)
    expect(seen).not.toBeNull()
    expect(seen!.system).toMatch(/not a doctor/i)
    expect(seen!.prompt).toContain("build_muscle")
    expect(seen!.prompt).toContain("Hebrew")
    expect(seen!.schema).toBeDefined()
  })

  it("reports ai_error when the model call throws", async () => {
    const throwing: ObjectGenerator = async () => {
      throw new Error("gateway timeout")
    }
    const result = await generateWorkoutPlan(client(), "en-US", throwing)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("ai_error")
  })

  it("reports invalid_output when the model returns a malformed object", async () => {
    const result = await generateWorkoutPlan(
      client(),
      "en-US",
      fixedGenerator({ title: "x", workouts: [] })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("invalid_output")
      expect(result.issues?.length).toBeGreaterThan(0)
    }
  })

  it("rejects output that lacks per-exercise safety notes when limitations exist", async () => {
    const plan = validPlan()
    plan.workouts[0].exercises[0].safety_notes = null
    const result = await generateWorkoutPlan(
      client({ limitations: "knee injury" }),
      "en-US",
      fixedGenerator(plan)
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("invalid_output")
  })
})
