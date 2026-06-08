import { describe, expect, it } from "vitest"

import {
  fromClientRow,
  fromSnapshotRow,
  toClientUpsertRow,
  toSnapshotRow,
  type Client,
} from "@/lib/db/mappers"
import type { ClientRow, OnboardingSnapshotRow } from "@/lib/db/types"

/**
 * Unit tests for the pure client and snapshot row mappers: camelCase input ->
 * snake_case upsert payload, snake_case row -> camelCase domain model, and the
 * onboarding-snapshot insert/read mappers.
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
    country_iso2: null,
    age: 34,
    age_range: "30-39",
    goals: ["strength"],
    fitness_level: "intermediate",
    limitations: null,
    available_days: ["mon", "wed"],
    availability: { mon: [{ start: "06:00", end: "07:00" }] },
    session_duration_minutes: 45,
    preferred_location: "home",
    equipment: ["dumbbells"],
    equipment_other: ["sled"],
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
      countryIso2: null,
      age: 34,
      ageRange: "30-39",
      goals: ["strength"],
      fitnessLevel: "intermediate",
      limitations: null,
      availableDays: ["mon", "wed"],
      availability: { mon: [{ start: "06:00", end: "07:00" }] },
      sessionDurationMinutes: 45,
      preferredLocation: "home",
      equipment: ["dumbbells"],
      equipmentOther: ["sled"],
      notes: null,
      onboardedAt: "2026-06-01T00:00:00.000Z",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    })
  })

  it("defaults null array and jsonb columns to empty values", () => {
    const row = {
      ...baseRow,
      available_days: null as unknown as string[],
      equipment: null as unknown as string[],
      availability: null,
      equipment_other: null,
    }
    const client = fromClientRow(row)
    expect(client.availableDays).toEqual([])
    expect(client.equipment).toEqual([])
    expect(client.availability).toEqual({})
    expect(client.equipmentOther).toEqual([])
  })
})

describe("onboarding snapshot mappers", () => {
  const client: Client = {
    userId: "user-1",
    fullName: "Dana Levi",
    phone: "+972541234567",
    countryIso2: "IL",
    age: 32,
    ageRange: null,
    goals: ["build_muscle"],
    fitnessLevel: "intermediate",
    limitations: null,
    availableDays: ["monday"],
    availability: { monday: [{ start: "06:00", end: "08:00" }] },
    sessionDurationMinutes: 45,
    preferredLocation: "gym",
    equipment: ["dumbbells"],
    equipmentOther: ["sled"],
    notes: null,
    onboardedAt: "2026-06-04T00:00:00.000Z",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
  }

  it("copies the client's onboarding fields verbatim into the insert row", () => {
    const row = toSnapshotRow({
      clientId: client.userId,
      planId: "plan-1",
      client,
      locale: "en-US",
    })
    expect(row).toMatchObject({
      client_id: "user-1",
      plan_id: "plan-1",
      full_name: "Dana Levi",
      goals: ["build_muscle"],
      available_days: ["monday"],
      availability: { monday: [{ start: "06:00", end: "08:00" }] },
      session_duration_minutes: 45,
      equipment: ["dumbbells"],
      equipment_other: ["sled"],
      locale: "en-US",
    })
    // The snapshot is independent of the live row; it carries no client
    // timestamps or onboarded_at.
    expect("onboarded_at" in row).toBe(false)
    expect("created_at" in row).toBe(false)
  })

  it("maps a snapshot row back to its camelCase domain model", () => {
    const snapRow: OnboardingSnapshotRow = {
      id: "snap-1",
      client_id: "user-1",
      plan_id: "plan-1",
      full_name: "Dana Levi",
      phone: "+972541234567",
      country_iso2: "IL",
      age: 32,
      age_range: null,
      goals: ["build_muscle"],
      fitness_level: "intermediate",
      limitations: null,
      available_days: ["monday"],
      availability: { monday: [{ start: "06:00", end: "08:00" }] },
      session_duration_minutes: 45,
      preferred_location: "gym",
      equipment: ["dumbbells"],
      equipment_other: ["sled"],
      notes: null,
      locale: "en-US",
      created_at: "2026-06-08T00:00:00.000Z",
    }
    const snap = fromSnapshotRow(snapRow)
    expect(snap).toMatchObject({
      id: "snap-1",
      clientId: "user-1",
      planId: "plan-1",
      sessionDurationMinutes: 45,
      equipmentOther: ["sled"],
      locale: "en-US",
      createdAt: "2026-06-08T00:00:00.000Z",
    })
  })

  it("defaults null array and jsonb snapshot columns", () => {
    const snapRow = {
      id: "snap-1",
      client_id: "user-1",
      plan_id: null,
      full_name: null,
      phone: null,
      country_iso2: null,
      age: null,
      age_range: null,
      goals: null,
      fitness_level: null,
      limitations: null,
      available_days: null as unknown as string[],
      availability: null,
      session_duration_minutes: null,
      preferred_location: null,
      equipment: null as unknown as string[],
      equipment_other: null,
      notes: null,
      locale: null,
      created_at: "2026-06-08T00:00:00.000Z",
    }
    const snap = fromSnapshotRow(snapRow)
    expect(snap.goals).toEqual([])
    expect(snap.availableDays).toEqual([])
    expect(snap.availability).toEqual({})
    expect(snap.equipment).toEqual([])
    expect(snap.equipmentOther).toEqual([])
  })
})
