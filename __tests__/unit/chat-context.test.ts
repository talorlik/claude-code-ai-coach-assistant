import { describe, expect, it } from "vitest"

import {
  buildChatSystemPrompt,
  type ChatContext,
} from "@/lib/ai/chat-context"
import type { Client } from "@/lib/db/mappers"
import type {
  WorkoutLogRow,
  WorkoutPlanRow,
} from "@/lib/db/types"

/**
 * Unit tests for the pure chat-context prompt builder. No Supabase or AI runtime
 * is touched: the builder is a pure function over plain data, so the tests assert
 * exactly what the model is told - the mandatory safety posture, the injected
 * client context, and the answer-language instruction.
 */

function client(overrides: Partial<Client> = {}): Client {
  return {
    userId: "user-1",
    fullName: "Dana Levi",
    phone: null,
    countryIso2: null,
    age: 32,
    ageRange: null,
    goals: ["build_muscle"],
    fitnessLevel: "intermediate",
    limitations: null,
    availableDays: ["monday", "wednesday"],
    availability: {
      monday: [{ start: "06:00", end: "08:00" }],
      wednesday: [{ start: "06:00", end: "08:00" }],
    },
    sessionDurationMinutes: 45,
    preferredLocation: "gym",
    equipment: ["dumbbells"],
    equipmentOther: [],
    notes: null,
    onboardedAt: "2026-06-04T00:00:00.000Z",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    ...overrides,
  }
}

function plan(overrides: Partial<WorkoutPlanRow> = {}): WorkoutPlanRow {
  return {
    id: "plan-1",
    client_id: "user-1",
    title: "Strength Builder",
    status: "active",
    locale: "en-US",
    source: "ai",
    source_payload: null,
    created_at: "2026-06-04T00:00:00.000Z",
    updated_at: "2026-06-04T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  }
}

function log(overrides: Partial<WorkoutLogRow> = {}): WorkoutLogRow {
  return {
    id: "log-1",
    client_id: "user-1",
    workout_id: "workout-1",
    planned_date: "2026-06-03",
    completed_at: "2026-06-03T10:00:00.000Z",
    difficulty: "ok",
    energy_level: "high",
    notes: null,
    created_at: "2026-06-03T10:00:00.000Z",
    ...overrides,
  }
}

function context(overrides: Partial<ChatContext> = {}): ChatContext {
  return {
    client: client(),
    activePlan: plan(),
    recentLogs: [log()],
    recentHistory: [],
    ...overrides,
  }
}

describe("buildChatSystemPrompt", () => {
  it("always includes the mandatory medical-safety posture", () => {
    const prompt = buildChatSystemPrompt(context(), "en-US")
    expect(prompt).toMatch(/not a doctor/i)
    expect(prompt).toMatch(/medical professional/i)
    expect(prompt).toMatch(/pain|injury/i)
  })

  it("injects the client's goal, level, and limitations", () => {
    const prompt = buildChatSystemPrompt(
      context({ client: client({ limitations: "left knee injury" }) }),
      "en-US"
    )
    expect(prompt).toContain("build_muscle")
    expect(prompt).toContain("intermediate")
    expect(prompt).toContain("left knee injury")
  })

  it("summarizes the active plan and recent activity", () => {
    const prompt = buildChatSystemPrompt(context(), "en-US")
    expect(prompt).toContain("Strength Builder")
    expect(prompt).toContain("2026-06-03")
    expect(prompt).toMatch(/difficulty ok/i)
  })

  it("notes absence explicitly when there is no plan or activity", () => {
    const prompt = buildChatSystemPrompt(
      context({ activePlan: null, recentLogs: [] }),
      "en-US"
    )
    expect(prompt).toMatch(/no active workout plan/i)
    expect(prompt).toMatch(/no workouts logged/i)
  })

  it("notes when the client has not onboarded", () => {
    const prompt = buildChatSystemPrompt(
      context({ client: null }),
      "en-US"
    )
    expect(prompt).toMatch(/not completed onboarding/i)
  })

  it("requests English for the en-US locale", () => {
    const prompt = buildChatSystemPrompt(context(), "en-US")
    expect(prompt).toContain("Answer in English")
  })

  it("requests Hebrew for the he-IL locale", () => {
    const prompt = buildChatSystemPrompt(context(), "he-IL")
    expect(prompt).toContain("Answer in Hebrew")
  })

  it("caps the recent-activity summary to the window", () => {
    const manyLogs = Array.from({ length: 12 }, (_, i) =>
      log({ id: `log-${i}`, planned_date: `2026-06-${String(i + 1).padStart(2, "0")}` })
    )
    const prompt = buildChatSystemPrompt(
      context({ recentLogs: manyLogs }),
      "en-US"
    )
    const lines = prompt
      .split("\n")
      .filter((line) => line.startsWith("- ") && line.includes("completed a workout"))
    expect(lines.length).toBeLessThanOrEqual(5)
  })
})
