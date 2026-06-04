import type { ClientRow } from "@/lib/db/types"

/**
 * Pure mappers between database rows and the shapes the application writes.
 * Kept free of any Supabase or request dependency so they are trivially
 * unit-testable and reusable from both server actions and tests.
 */

/** Fields accepted when upserting a client onboarding row. */
export interface ClientUpsertInput {
  userId: string
  fullName?: string | null
  phone?: string | null
  age?: number | null
  ageRange?: string | null
  goal?: string | null
  fitnessLevel?: string | null
  limitations?: string | null
  availableDays?: string[]
  preferredLocation?: string | null
  equipment?: string[]
  notes?: string | null
  onboardedAt?: string | null
}

/**
 * Builds the snake_case row payload for a `clients` upsert from camelCase
 * input. Omits `undefined` fields so a partial update does not clobber existing
 * columns with nulls; array fields default to empty arrays to match the NOT
 * NULL DEFAULT '{}' columns when explicitly provided.
 */
export function toClientUpsertRow(
  input: ClientUpsertInput
): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: input.userId }

  if (input.fullName !== undefined) row.full_name = input.fullName
  if (input.phone !== undefined) row.phone = input.phone
  if (input.age !== undefined) row.age = input.age
  if (input.ageRange !== undefined) row.age_range = input.ageRange
  if (input.goal !== undefined) row.goal = input.goal
  if (input.fitnessLevel !== undefined) row.fitness_level = input.fitnessLevel
  if (input.limitations !== undefined) row.limitations = input.limitations
  if (input.availableDays !== undefined)
    row.available_days = input.availableDays
  if (input.preferredLocation !== undefined)
    row.preferred_location = input.preferredLocation
  if (input.equipment !== undefined) row.equipment = input.equipment
  if (input.notes !== undefined) row.notes = input.notes
  if (input.onboardedAt !== undefined) row.onboarded_at = input.onboardedAt

  return row
}

/** Domain view of a client onboarding profile (camelCase). */
export interface Client {
  userId: string
  fullName: string | null
  phone: string | null
  age: number | null
  ageRange: string | null
  goal: string | null
  fitnessLevel: string | null
  limitations: string | null
  availableDays: string[]
  preferredLocation: string | null
  equipment: string[]
  notes: string | null
  onboardedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Maps a `clients` row to its camelCase domain model. */
export function fromClientRow(row: ClientRow): Client {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    phone: row.phone,
    age: row.age,
    ageRange: row.age_range,
    goal: row.goal,
    fitnessLevel: row.fitness_level,
    limitations: row.limitations,
    availableDays: row.available_days ?? [],
    preferredLocation: row.preferred_location,
    equipment: row.equipment ?? [],
    notes: row.notes,
    onboardedAt: row.onboarded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
