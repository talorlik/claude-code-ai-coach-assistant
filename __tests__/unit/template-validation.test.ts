import { describe, expect, it } from "vitest"

import {
  validateTemplate,
  TEMPLATE_TITLE_MAX_LENGTH,
  TEMPLATE_DESCRIPTION_MAX_LENGTH,
} from "@/lib/trainer/template-validation"

/**
 * Unit tests for the pure template payload validation. A template wraps
 * trainer metadata around a structured plan body that must satisfy the shared
 * plan schema. These tests pin the metadata rules (title required/length,
 * optional description length, locale allow-list) and that the plan body is
 * validated, with field-error codes the form localizes.
 */

/** A minimal valid plan body matching the workout-plan schema. */
function validPayload() {
  return {
    title: "Starter strength",
    summary: "A simple full-body plan.",
    safety_notes: "Not medical advice. Stop if you feel pain.",
    workouts: [
      {
        day_of_week: "monday",
        title: "Full body",
        focus: "strength",
        notes: null,
        exercises: [
          {
            name: "Goblet squat",
            sets: 3,
            reps: "8-12",
            duration: null,
            rest: "60-90s",
            instructions: "Keep your chest up.",
            safety_notes: null,
          },
        ],
      },
    ],
  }
}

describe("validateTemplate", () => {
  it("accepts a valid template and normalizes fields", () => {
    const result = validateTemplate({
      title: "  Beginner plan  ",
      description: "  Two days a week  ",
      locale: "en-US",
      payload: validPayload(),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.title).toBe("Beginner plan")
    expect(result.data.description).toBe("Two days a week")
    expect(result.data.locale).toBe("en-US")
    expect(result.data.payload.workouts).toHaveLength(1)
  })

  it("treats an empty description and locale as omitted (null)", () => {
    const result = validateTemplate({
      title: "Plan",
      description: "   ",
      locale: "",
      payload: validPayload(),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.description).toBeNull()
    expect(result.data.locale).toBeNull()
  })

  it("rejects an empty title with a required field code", () => {
    const result = validateTemplate({
      title: "   ",
      payload: validPayload(),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.title).toBe("required")
  })

  it("rejects a title over the length limit", () => {
    const result = validateTemplate({
      title: "x".repeat(TEMPLATE_TITLE_MAX_LENGTH + 1),
      payload: validPayload(),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.title).toBe("tooLong")
  })

  it("rejects a description over the length limit", () => {
    const result = validateTemplate({
      title: "Plan",
      description: "x".repeat(TEMPLATE_DESCRIPTION_MAX_LENGTH + 1),
      payload: validPayload(),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.description).toBe("tooLong")
  })

  it("rejects an unsupported locale", () => {
    const result = validateTemplate({
      title: "Plan",
      locale: "fr-FR",
      payload: validPayload(),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.locale).toBe("invalid")
  })

  it("rejects an invalid plan body with a payload field code", () => {
    const result = validateTemplate({
      title: "Plan",
      payload: { title: "Broken", workouts: [] },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.payload).toBe("invalid")
  })

  it("does not require per-exercise safety notes (templates are generic)", () => {
    // A template body without safety_notes is valid here; the per-client
    // limitations rule is enforced at assignment time, not at template time.
    const payload = validPayload()
    payload.workouts[0].exercises[0].safety_notes = null
    const result = validateTemplate({ title: "Plan", payload })
    expect(result.ok).toBe(true)
  })
})
