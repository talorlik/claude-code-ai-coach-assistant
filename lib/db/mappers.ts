import type {
  Availability,
  ClientRow,
  OnboardingSnapshotRow,
} from "@/lib/db/types"

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
  countryIso2?: string | null
  age?: number | null
  ageRange?: string | null
  goals?: string[]
  fitnessLevel?: string | null
  limitations?: string | null
  availableDays?: string[]
  availability?: Availability
  sessionDurationMinutes?: number | null
  preferredLocation?: string | null
  equipment?: string[]
  equipmentOther?: string[]
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
  if (input.countryIso2 !== undefined) row.country_iso2 = input.countryIso2
  if (input.age !== undefined) row.age = input.age
  if (input.ageRange !== undefined) row.age_range = input.ageRange
  if (input.goals !== undefined) row.goals = input.goals
  if (input.fitnessLevel !== undefined) row.fitness_level = input.fitnessLevel
  if (input.limitations !== undefined) row.limitations = input.limitations
  if (input.availableDays !== undefined)
    row.available_days = input.availableDays
  if (input.availability !== undefined) row.availability = input.availability
  if (input.sessionDurationMinutes !== undefined)
    row.session_duration_minutes = input.sessionDurationMinutes
  if (input.preferredLocation !== undefined)
    row.preferred_location = input.preferredLocation
  if (input.equipment !== undefined) row.equipment = input.equipment
  if (input.equipmentOther !== undefined)
    row.equipment_other = input.equipmentOther
  if (input.notes !== undefined) row.notes = input.notes
  if (input.onboardedAt !== undefined) row.onboarded_at = input.onboardedAt

  return row
}

/** Domain view of a client onboarding profile (camelCase). */
export interface Client {
  userId: string
  fullName: string | null
  phone: string | null
  countryIso2: string | null
  age: number | null
  ageRange: string | null
  goals: string[]
  fitnessLevel: string | null
  limitations: string | null
  availableDays: string[]
  availability: Availability
  sessionDurationMinutes: number | null
  preferredLocation: string | null
  equipment: string[]
  equipmentOther: string[]
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
    countryIso2: row.country_iso2,
    age: row.age,
    ageRange: row.age_range,
    goals: row.goals ?? [],
    fitnessLevel: row.fitness_level,
    limitations: row.limitations,
    availableDays: row.available_days ?? [],
    availability: row.availability ?? {},
    sessionDurationMinutes: row.session_duration_minutes,
    preferredLocation: row.preferred_location,
    equipment: row.equipment ?? [],
    equipmentOther: row.equipment_other ?? [],
    notes: row.notes,
    onboardedAt: row.onboarded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Domain view of an immutable onboarding snapshot (camelCase): the details used
 * to generate {@link planId}, plus the output locale and capture timestamp.
 */
export interface OnboardingSnapshot {
  id: string
  clientId: string
  planId: string | null
  fullName: string | null
  phone: string | null
  countryIso2: string | null
  age: number | null
  ageRange: string | null
  goals: string[]
  fitnessLevel: string | null
  limitations: string | null
  availableDays: string[]
  availability: Availability
  sessionDurationMinutes: number | null
  preferredLocation: string | null
  equipment: string[]
  equipmentOther: string[]
  notes: string | null
  locale: string | null
  createdAt: string
}

/** Fields accepted when inserting an onboarding snapshot row. */
export interface OnboardingSnapshotInput {
  clientId: string
  planId: string | null
  client: Client
  locale: string | null
}

/**
 * Builds the snake_case insert payload for an `onboarding_snapshots` row from a
 * live {@link Client} plus the produced plan id and locale. Copies the client's
 * current onboarding fields verbatim so the row is a faithful point-in-time
 * record, independent of any later edit to the `clients` row.
 */
export function toSnapshotRow(
  input: OnboardingSnapshotInput
): Record<string, unknown> {
  const c = input.client
  return {
    client_id: input.clientId,
    plan_id: input.planId,
    full_name: c.fullName,
    phone: c.phone,
    country_iso2: c.countryIso2,
    age: c.age,
    age_range: c.ageRange,
    goals: c.goals,
    fitness_level: c.fitnessLevel,
    limitations: c.limitations,
    available_days: c.availableDays,
    availability: c.availability,
    session_duration_minutes: c.sessionDurationMinutes,
    preferred_location: c.preferredLocation,
    equipment: c.equipment,
    equipment_other: c.equipmentOther,
    notes: c.notes,
    locale: input.locale,
  }
}

/** Maps an `onboarding_snapshots` row to its camelCase domain model. */
export function fromSnapshotRow(row: OnboardingSnapshotRow): OnboardingSnapshot {
  return {
    id: row.id,
    clientId: row.client_id,
    planId: row.plan_id,
    fullName: row.full_name,
    phone: row.phone,
    countryIso2: row.country_iso2,
    age: row.age,
    ageRange: row.age_range,
    goals: row.goals ?? [],
    fitnessLevel: row.fitness_level,
    limitations: row.limitations,
    availableDays: row.available_days ?? [],
    availability: row.availability ?? {},
    sessionDurationMinutes: row.session_duration_minutes,
    preferredLocation: row.preferred_location,
    equipment: row.equipment ?? [],
    equipmentOther: row.equipment_other ?? [],
    notes: row.notes,
    locale: row.locale,
    createdAt: row.created_at,
  }
}
