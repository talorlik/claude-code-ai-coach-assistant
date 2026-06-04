import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"
import { normalizePhone } from "@/lib/auth/validation"

/**
 * Onboarding domain vocabulary. Each list is the closed set of values a client
 * may submit for that field. The values are stable, locale-independent keys
 * (never shown to the user directly): UI labels and helper text come from the
 * `Onboarding` message namespace, keyed by these same strings, so the catalog
 * and the validator never drift. Persisted verbatim into `clients` so later
 * batches (AI plan generation) can branch on them without re-parsing free text.
 */

/** Training goals a client can pick exactly one of. */
export const GOALS = [
  "lose_weight",
  "build_muscle",
  "general_fitness",
  "improve_endurance",
  "increase_strength",
] as const

/** Self-reported experience levels. */
export const FITNESS_LEVELS = ["beginner", "intermediate", "advanced"] as const

/**
 * Coarse age brackets. A client supplies either an exact `age` or an
 * `ageRange`; the bracket is the fallback for clients who prefer not to give a
 * precise number, and is enough for the AI plan to reason about.
 */
export const AGE_RANGES = [
  "under_18",
  "18_29",
  "30_39",
  "40_49",
  "50_59",
  "60_plus",
] as const

/** Where the client will train; drives equipment assumptions downstream. */
export const LOCATIONS = ["home", "gym", "outdoor", "hybrid"] as const

/** Weekday keys for available training days (multi-select, at least one). */
export const WORKOUT_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

/** Equipment the client has access to (multi-select, may be empty). */
export const EQUIPMENT = [
  "none",
  "dumbbells",
  "barbell",
  "kettlebell",
  "resistance_bands",
  "pull_up_bar",
  "bench",
  "cardio_machine",
  "full_gym",
] as const

export type Goal = (typeof GOALS)[number]
export type FitnessLevel = (typeof FITNESS_LEVELS)[number]
export type AgeRange = (typeof AGE_RANGES)[number]
export type WorkoutLocation = (typeof LOCATIONS)[number]
export type WorkoutDay = (typeof WORKOUT_DAYS)[number]
export type Equipment = (typeof EQUIPMENT)[number]

/** Lower/upper bounds for an exact age, when given instead of a range. */
const MIN_AGE = 13
const MAX_AGE = 100

/** Raw, untrusted onboarding payload as it arrives from the client form. */
export interface OnboardingInput {
  fullName: string
  phone?: string
  age?: string | number | null
  ageRange?: string | null
  goal?: string | null
  fitnessLevel?: string | null
  limitations?: string | null
  availableDays?: string[]
  preferredLocation?: string | null
  equipment?: string[]
  notes?: string | null
}

/**
 * Cleaned, type-narrowed onboarding data ready to persist. `age` and `ageRange`
 * are mutually optional but at least one is guaranteed present; every enum field
 * is a member of its closed vocabulary; `availableDays` has at least one entry.
 */
export interface ValidatedOnboarding {
  fullName: string
  phone: string
  age: number | null
  ageRange: AgeRange | null
  goal: Goal
  fitnessLevel: FitnessLevel
  limitations: string | null
  availableDays: WorkoutDay[]
  preferredLocation: WorkoutLocation
  equipment: Equipment[]
  notes: string | null
}

/** Field-keyed error code map. Codes resolve to localized strings in the UI. */
type FieldErrors = Record<string, string>

function isMember<T extends readonly string[]>(
  set: T,
  value: unknown
): value is T[number] {
  return typeof value === "string" && (set as readonly string[]).includes(value)
}

/**
 * Validates and normalizes a raw onboarding payload. Returns a discriminated
 * {@link ActionResult}: on success the cleaned {@link ValidatedOnboarding};
 * on failure a generic message plus per-field error codes. The error codes are
 * stable keys (e.g. `"required"`, `"invalid"`), not user-facing prose, so the
 * caller can localize them.
 *
 * Rules:
 * - `fullName` is required, 2-120 characters after trimming.
 * - At least one of `age` (a number in 13-100) or `ageRange` (a known bracket)
 *   must be present; both may be supplied.
 * - `goal` and `fitnessLevel` are required and must be known values.
 * - `availableDays` must contain at least one known weekday; unknown or
 *   duplicate days are rejected.
 * - `preferredLocation` is required and must be a known location.
 * - `equipment` may be empty; every entry must be known and unique.
 * - `phone`, `limitations`, and `notes` are optional and trimmed; phone, when
 *   present, must normalize to 7-20 digits.
 *
 * @param input - The raw payload from the onboarding form.
 * @returns A validated, normalized result or a field-keyed error result.
 */
export function validateOnboarding(
  input: OnboardingInput
): ActionResult<ValidatedOnboarding> {
  const fieldErrors: FieldErrors = {}

  const fullName = (input.fullName ?? "").trim()
  if (fullName.length < 2 || fullName.length > 120) {
    fieldErrors.fullName = "invalid"
  }

  // Age: accept an exact number or a bracket; require at least one.
  let age: number | null = null
  let ageRange: AgeRange | null = null

  const rawAge =
    input.age === "" || input.age === null || input.age === undefined
      ? null
      : Number(input.age)
  if (rawAge !== null) {
    if (!Number.isInteger(rawAge) || rawAge < MIN_AGE || rawAge > MAX_AGE) {
      fieldErrors.age = "invalid"
    } else {
      age = rawAge
    }
  }

  if (input.ageRange) {
    if (isMember(AGE_RANGES, input.ageRange)) {
      ageRange = input.ageRange
    } else {
      fieldErrors.ageRange = "invalid"
    }
  }

  if (age === null && ageRange === null && !fieldErrors.age) {
    // Neither given and the age field wasn't itself malformed: flag age as the
    // field to fix, since the exact-age input is the primary control.
    fieldErrors.age = "required"
  }

  let goal: Goal | null = null
  if (!input.goal) {
    fieldErrors.goal = "required"
  } else if (isMember(GOALS, input.goal)) {
    goal = input.goal
  } else {
    fieldErrors.goal = "invalid"
  }

  let fitnessLevel: FitnessLevel | null = null
  if (!input.fitnessLevel) {
    fieldErrors.fitnessLevel = "required"
  } else if (isMember(FITNESS_LEVELS, input.fitnessLevel)) {
    fitnessLevel = input.fitnessLevel
  } else {
    fieldErrors.fitnessLevel = "invalid"
  }

  const days = input.availableDays ?? []
  let availableDays: WorkoutDay[] = []
  if (days.length === 0) {
    fieldErrors.availableDays = "required"
  } else if (
    days.some((d) => !isMember(WORKOUT_DAYS, d)) ||
    new Set(days).size !== days.length
  ) {
    fieldErrors.availableDays = "invalid"
  } else {
    availableDays = days as WorkoutDay[]
  }

  let preferredLocation: WorkoutLocation | null = null
  if (!input.preferredLocation) {
    fieldErrors.preferredLocation = "required"
  } else if (isMember(LOCATIONS, input.preferredLocation)) {
    preferredLocation = input.preferredLocation
  } else {
    fieldErrors.preferredLocation = "invalid"
  }

  const equip = input.equipment ?? []
  let equipment: Equipment[] = []
  if (
    equip.some((e) => !isMember(EQUIPMENT, e)) ||
    new Set(equip).size !== equip.length
  ) {
    fieldErrors.equipment = "invalid"
  } else {
    equipment = equip as Equipment[]
  }

  const phone = normalizePhone(input.phone ?? "")
  const digits = phone.replace(/\D/g, "")
  if (phone && (digits.length < 7 || digits.length > 20)) {
    fieldErrors.phone = "invalid"
  }

  const limitations = (input.limitations ?? "").trim() || null
  const notes = (input.notes ?? "").trim() || null

  if (Object.keys(fieldErrors).length > 0) {
    return fail("invalid", fieldErrors)
  }

  return ok({
    fullName,
    phone,
    age,
    ageRange,
    // Non-null assertions are safe: a failing check would have populated
    // fieldErrors and returned above before reaching here.
    goal: goal!,
    fitnessLevel: fitnessLevel!,
    limitations,
    availableDays,
    preferredLocation: preferredLocation!,
    equipment,
    notes,
  })
}
