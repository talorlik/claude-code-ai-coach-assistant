import { describe, expect, it } from "vitest"

import {
  PLAN_SYSTEM_PROMPT,
  buildPlanUserPrompt,
  clientHasLimitations,
} from "@/lib/ai/prompts"
import type { Client } from "@/lib/db/mappers"

/**
 * Unit tests for the plan prompt builder: the system prompt carries the
 * mandated safety posture, and the user prompt injects every required piece of
 * client context (goal, level, days, location, equipment, limitations, locale).
 */

/** A representative client; tests override fields. */
function client(overrides: Partial<Client> = {}): Client {
  return {
    userId: "user-1",
    fullName: "Dana Levi",
    phone: "0501234567",
    countryIso2: null,
    age: 32,
    ageRange: null,
    goals: ["build_muscle", "lose_weight"],
    fitnessLevel: "intermediate",
    limitations: null,
    availableDays: ["monday", "wednesday", "friday"],
    availability: {
      monday: [{ start: "06:00", end: "08:00" }],
      wednesday: [{ start: "06:00", end: "08:00" }],
      friday: [{ start: "18:00", end: "20:00" }],
    },
    sessionDurationMinutes: 45,
    preferredLocation: "gym",
    equipment: ["dumbbells", "bench"],
    equipmentOther: [],
    notes: null,
    onboardedAt: "2026-06-04T00:00:00.000Z",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    ...overrides,
  }
}

describe("PLAN_SYSTEM_PROMPT", () => {
  it("states the model is not a doctor and gives no diagnosis", () => {
    expect(PLAN_SYSTEM_PROMPT).toMatch(/not a doctor/i)
    expect(PLAN_SYSTEM_PROMPT).toMatch(/diagnos/i)
  })

  it("requires recommending a professional for pain/injury/medical concerns", () => {
    expect(PLAN_SYSTEM_PROMPT).toMatch(/professional/i)
    expect(PLAN_SYSTEM_PROMPT).toMatch(/pain|injury|medical/i)
  })

  it("requires respecting client limitations", () => {
    expect(PLAN_SYSTEM_PROMPT).toMatch(/limitation/i)
  })
})

describe("buildPlanUserPrompt", () => {
  it("includes goal, fitness level, days, location, and equipment", () => {
    const prompt = buildPlanUserPrompt(client(), "en-US")
    expect(prompt).toContain("Goal: build_muscle, lose_weight")
    expect(prompt).toContain("intermediate")
    expect(prompt).toContain("monday, wednesday, friday")
    expect(prompt).toContain("gym")
    expect(prompt).toContain("dumbbells, bench")
  })

  it("includes the exact age when given", () => {
    expect(buildPlanUserPrompt(client({ age: 45 }), "en-US")).toContain("45")
  })

  it("falls back to the age range when no exact age", () => {
    const prompt = buildPlanUserPrompt(
      client({ age: null, ageRange: "40_49" }),
      "en-US"
    )
    expect(prompt).toContain("40_49")
  })

  it("includes limitations text when present", () => {
    const prompt = buildPlanUserPrompt(
      client({ limitations: "left knee surgery" }),
      "en-US"
    )
    expect(prompt).toContain("left knee surgery")
  })

  it("renders no-equipment as none", () => {
    const prompt = buildPlanUserPrompt(client({ equipment: [] }), "en-US")
    expect(prompt).toMatch(/equipment: none/i)
  })

  it("renders per-day availability windows", () => {
    const prompt = buildPlanUserPrompt(client(), "en-US")
    expect(prompt).toContain("monday: 06:00-08:00")
    expect(prompt).toContain("friday: 18:00-20:00")
  })

  it("includes the target session length", () => {
    const prompt = buildPlanUserPrompt(
      client({ sessionDurationMinutes: 60 }),
      "en-US"
    )
    expect(prompt).toContain("60 minutes")
  })

  it("merges free-text Other equipment into the equipment line", () => {
    const prompt = buildPlanUserPrompt(
      client({ equipment: ["dumbbells"], equipmentOther: ["sled", "prowler"] }),
      "en-US"
    )
    expect(prompt).toContain("dumbbells, sled, prowler")
  })

  it("requests English for en-US and Hebrew for he-IL", () => {
    expect(buildPlanUserPrompt(client(), "en-US")).toContain("English")
    expect(buildPlanUserPrompt(client(), "he-IL")).toContain("Hebrew")
  })
})

describe("clientHasLimitations", () => {
  it("is false for null or blank limitations", () => {
    expect(clientHasLimitations(client({ limitations: null }))).toBe(false)
    expect(clientHasLimitations(client({ limitations: "   " }))).toBe(false)
  })

  it("is true for non-empty limitations", () => {
    expect(clientHasLimitations(client({ limitations: "bad shoulder" }))).toBe(
      true
    )
  })
})
