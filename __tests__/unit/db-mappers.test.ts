import { describe, expect, it } from "vitest"

import { fromClientRow, toClientUpsertRow } from "@/lib/db/mappers"
import type { ClientRow } from "@/lib/db/types"

/**
 * Unit tests for the pure client row mappers: camelCase input -> snake_case
 * upsert payload, and snake_case row -> camelCase domain model.
 */

describe("toClientUpsertRow", () => {
  it("always includes user_id and maps provided camelCase fields", () => {
    const row = toClientUpsertRow({
      userId: "user-1",
      fullName: "Dana Levi",
      ageRange: "30-39",
      fitnessLevel: "intermediate",
      availableDays: ["mon", "wed"],
      preferredLocation: "home",
      equipment: ["dumbbells"],
    })

    expect(row).toEqual({
      user_id: "user-1",
      full_name: "Dana Levi",
      age_range: "30-39",
      fitness_level: "intermediate",
      available_days: ["mon", "wed"],
      preferred_location: "home",
      equipment: ["dumbbells"],
    })
  })

  it("maps goals to the goals column", () => {
    const row = toClientUpsertRow({ userId: "user-1", goals: ["strength"] })
    expect(row).toEqual({ user_id: "user-1", goals: ["strength"] })
    expect("phone" in row).toBe(false)
    expect("equipment" in row).toBe(false)
  })

  it("preserves an explicit null to clear a column", () => {
    const row = toClientUpsertRow({ userId: "user-1", phone: null })
    expect(row).toEqual({ user_id: "user-1", phone: null })
  })
})

describe("fromClientRow", () => {
  const baseRow: ClientRow = {
    user_id: "user-1",
    full_name: "Dana Levi",
    phone: "0501234567",
    age: 34,
    age_range: "30-39",
    goals: ["strength"],
    fitness_level: "intermediate",
    limitations: null,
    available_days: ["mon", "wed"],
    preferred_location: "home",
    equipment: ["dumbbells"],
    notes: null,
    onboarded_at: "2026-06-01T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-02T00:00:00.000Z",
  }

  it("maps every column to its camelCase field", () => {
    const client = fromClientRow(baseRow)
    expect(client).toEqual({
      userId: "user-1",
      fullName: "Dana Levi",
      phone: "0501234567",
      age: 34,
      ageRange: "30-39",
      goals: ["strength"],
      fitnessLevel: "intermediate",
      limitations: null,
      availableDays: ["mon", "wed"],
      preferredLocation: "home",
      equipment: ["dumbbells"],
      notes: null,
      onboardedAt: "2026-06-01T00:00:00.000Z",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    })
  })

  it("defaults null array columns to empty arrays", () => {
    const row = {
      ...baseRow,
      available_days: null as unknown as string[],
      equipment: null as unknown as string[],
    }
    const client = fromClientRow(row)
    expect(client.availableDays).toEqual([])
    expect(client.equipment).toEqual([])
  })
})
