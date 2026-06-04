import { describe, expect, it } from "vitest"

import {
  validateGeneratedPlan,
  workoutPlanSchema,
  type GeneratedPlan,
} from "@/lib/ai/schemas"

/**
 * Unit tests for the AI plan schema and validator: a well-formed plan is
 * accepted, malformed output is rejected, and the limitations-driven safety
 * rule is enforced. These guard the "never save partial/invalid output"
 * contract at the validation boundary.
 */

/** A minimal, fully valid plan; tests clone and mutate it. */
function validPlan(): GeneratedPlan {
  return {
    title: "Beginner Full-Body Plan",
    summary: "A gentle three-day starting plan.",
    safety_notes:
      "This plan is general guidance, not medical advice. Stop and consult a professional if you feel pain.",
    workouts: [
      {
        day_of_week: "monday",
        title: "Full body A",
        focus: "strength",
        notes: null,
        exercises: [
          {
            name: "Bodyweight squat",
            sets: 3,
            reps: "10-12",
            duration: null,
            rest: "60s",
            instructions: "Keep your chest up and knees tracking over toes.",
            safety_notes: "Stop if you feel knee pain.",
          },
        ],
      },
    ],
  }
}

describe("workoutPlanSchema", () => {
  it("accepts a valid plan", () => {
    const result = validateGeneratedPlan(validPlan(), false)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.title).toBe("Beginner Full-Body Plan")
      expect(result.plan.workouts).toHaveLength(1)
      expect(result.plan.workouts[0].exercises[0].name).toBe("Bodyweight squat")
    }
  })

  it("rejects a plan with no workouts", () => {
    const plan = { ...validPlan(), workouts: [] }
    const result = validateGeneratedPlan(plan, false)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.startsWith("workouts"))).toBe(true)
    }
  })

  it("rejects a plan missing the plan-level safety note", () => {
    const plan = { ...validPlan() } as Record<string, unknown>
    delete plan.safety_notes
    const result = validateGeneratedPlan(plan, false)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.includes("safety_notes"))).toBe(true)
    }
  })

  it("rejects a workout with no exercises", () => {
    const plan = validPlan()
    plan.workouts[0].exercises = []
    const result = validateGeneratedPlan(plan, false)
    expect(result.ok).toBe(false)
  })

  it("rejects entirely malformed output", () => {
    expect(validateGeneratedPlan(null, false).ok).toBe(false)
    expect(validateGeneratedPlan("not a plan", false).ok).toBe(false)
    expect(validateGeneratedPlan({ title: 123 }, false).ok).toBe(false)
  })

  it("requires per-exercise safety notes when the client has limitations", () => {
    const plan = validPlan()
    plan.workouts[0].exercises[0].safety_notes = null
    // Without limitations the null safety note is fine.
    expect(validateGeneratedPlan(plan, false).ok).toBe(true)
    // With limitations it must be rejected.
    const result = validateGeneratedPlan(plan, true)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(
        result.issues.some((i) => i.includes("safety_notes"))
      ).toBe(true)
    }
  })

  it("accepts a limitations plan when every exercise has safety notes", () => {
    const result = validateGeneratedPlan(validPlan(), true)
    expect(result.ok).toBe(true)
  })

  it("treats a blank safety note as missing under limitations", () => {
    const plan = validPlan()
    plan.workouts[0].exercises[0].safety_notes = "   "
    expect(validateGeneratedPlan(plan, true).ok).toBe(false)
  })

  it("exposes the raw schema for the generator to pass to the SDK", () => {
    // The generator hands workoutPlanSchema to generateObject; assert it parses.
    expect(workoutPlanSchema.safeParse(validPlan()).success).toBe(true)
  })
})
