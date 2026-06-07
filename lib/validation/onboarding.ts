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

/** Training goals a client may select one or more of. */
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
export const MIN_AGE = 13
export const MAX_AGE = 100

/**
 * Full-name rules. The charset allows Latin and Hebrew letters plus spaces,
 * dots, and hyphens (e.g. "Anne-Marie O.", "ישראל ישראלי"); digits and other
 * symbols are rejected. Exported so the client-side step gate and the server
 * validator share one definition and can never drift.
 */
export const NAME_MIN = 2
export const NAME_MAX = 30
export const NAME_RE = /^[a-zA-Zא-ת .-]+$/

/**
 * Phone rules. The number is required and validated in its normalized form
 * (separators stripped, a single leading `+` kept). `PHONE_RE` is the E.164
 * shape: an optional `+`, a non-zero leading digit, then up to 14 more digits.
 * Length is counted on the normalized value, so a leading `+` consumes one slot.
 */
export const PHONE_MIN = 8
export const PHONE_MAX = 15
export const PHONE_RE = /^\+?[1-9]\d{1,14}$/

/**
 * Which onboarding fields each wizard step owns. The single source of truth for
 * step ownership: the client form gates and saves per step against this map,
 * and {@link validateOnboardingStep} validates only the named fields. Mirrors
 * the field groupings rendered by the three sub-step components in the form.
 */
export const STEP_FIELDS = {
  0: ["fullName", "phone", "age", "ageRange"],
  1: ["goals", "fitnessLevel", "preferredLocation"],
  2: ["availableDays", "equipment", "limitations", "notes"],
} as const

/** A wizard step index. */
export type OnboardingStep = keyof typeof STEP_FIELDS

/** Raw, untrusted onboarding payload as it arrives from the client form. */
export interface OnboardingInput {
  fullName: string
  phone?: string
  age?: string | number | null
  ageRange?: string | null
  goals?: string[]
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
  goals: Goal[]
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
 * Per-field validation helpers. Each returns the cleaned value plus an optional
 * error code, so both {@link validateOnboarding} (all fields) and
 * {@link validateOnboardingStep} (a subset) evaluate identical rules with no
 * duplicated logic. Codes are stable keys (`"required"`, `"invalid"`,
 * `"length"`, `"chars"`), localized by the caller.
 */

/** Name: required, 2-30 chars, Latin/Hebrew letters + space/dot/hyphen. */
function checkFullName(input: OnboardingInput): {
  value: string
  error?: string
} {
  const value = (input.fullName ?? "").trim()
  if (value.length === 0) return { value, error: "required" }
  if (value.length < NAME_MIN || value.length > NAME_MAX) {
    return { value, error: "length" }
  }
  if (!NAME_RE.test(value)) return { value, error: "chars" }
  return { value }
}

/** Phone: required; normalized form must match E.164 and be 8-15 chars. */
function checkPhone(input: OnboardingInput): {
  value: string
  error?: string
} {
  const value = normalizePhone(input.phone ?? "")
  if (value.length === 0) return { value, error: "required" }
  if (
    value.length < PHONE_MIN ||
    value.length > PHONE_MAX ||
    !PHONE_RE.test(value)
  ) {
    return { value, error: "invalid" }
  }
  return { value }
}

/**
 * Age / age range: at least one of an exact age (13-100) or a known bracket.
 * Returns both normalized values and, on failure, the field that should carry
 * the error (`age` is the primary control, so a missing pair flags `age`).
 */
function checkAge(input: OnboardingInput): {
  age: number | null
  ageRange: AgeRange | null
  errors: FieldErrors
} {
  const errors: FieldErrors = {}
  let age: number | null = null
  let ageRange: AgeRange | null = null

  const rawAge =
    input.age === "" || input.age === null || input.age === undefined
      ? null
      : Number(input.age)
  if (rawAge !== null) {
    if (!Number.isInteger(rawAge) || rawAge < MIN_AGE || rawAge > MAX_AGE) {
      errors.age = "invalid"
    } else {
      age = rawAge
    }
  }

  if (input.ageRange) {
    if (isMember(AGE_RANGES, input.ageRange)) {
      ageRange = input.ageRange
    } else {
      errors.ageRange = "invalid"
    }
  }

  if (age === null && ageRange === null && !errors.age) {
    errors.age = "required"
  }

  return { age, ageRange, errors }
}

/** Goals: at least one known goal; no unknowns or duplicates. */
function checkGoals(input: OnboardingInput): {
  value: Goal[]
  error?: string
} {
  const raw = input.goals ?? []
  if (raw.length === 0) return { value: [], error: "required" }
  if (raw.some((g) => !isMember(GOALS, g)) || new Set(raw).size !== raw.length) {
    return { value: [], error: "invalid" }
  }
  return { value: raw as Goal[] }
}

/** Fitness level: required, a known value. */
function checkFitnessLevel(input: OnboardingInput): {
  value: FitnessLevel | null
  error?: string
} {
  if (!input.fitnessLevel) return { value: null, error: "required" }
  if (isMember(FITNESS_LEVELS, input.fitnessLevel)) {
    return { value: input.fitnessLevel }
  }
  return { value: null, error: "invalid" }
}

/** Preferred location: required, a known value. */
function checkPreferredLocation(input: OnboardingInput): {
  value: WorkoutLocation | null
  error?: string
} {
  if (!input.preferredLocation) return { value: null, error: "required" }
  if (isMember(LOCATIONS, input.preferredLocation)) {
    return { value: input.preferredLocation }
  }
  return { value: null, error: "invalid" }
}

/** Available days: at least one known weekday; no unknowns or duplicates. */
function checkAvailableDays(input: OnboardingInput): {
  value: WorkoutDay[]
  error?: string
} {
  const days = input.availableDays ?? []
  if (days.length === 0) return { value: [], error: "required" }
  if (
    days.some((d) => !isMember(WORKOUT_DAYS, d)) ||
    new Set(days).size !== days.length
  ) {
    return { value: [], error: "invalid" }
  }
  return { value: days as WorkoutDay[] }
}

/** Equipment: optional; every entry must be known and unique. */
function checkEquipment(input: OnboardingInput): {
  value: Equipment[]
  error?: string
} {
  const equip = input.equipment ?? []
  if (
    equip.some((e) => !isMember(EQUIPMENT, e)) ||
    new Set(equip).size !== equip.length
  ) {
    return { value: [], error: "invalid" }
  }
  return { value: equip as Equipment[] }
}

/**
 * Validates the fields owned by a single wizard step and returns a field-keyed
 * error map (empty when the step is valid). The client form calls this to gate
 * "Next" and before a per-step save, so the user is stopped on the same step
 * rather than bounced after a full-form submit. It reuses the exact per-field
 * helpers that {@link validateOnboarding} uses, so client gating and server
 * validation never diverge.
 *
 * @param step - The wizard step index (0-2) to validate.
 * @param input - The raw payload; only this step's fields are inspected.
 * @returns A map of field name to error code; `{}` when the step passes.
 */
export function validateOnboardingStep(
  step: OnboardingStep,
  input: OnboardingInput
): FieldErrors {
  const errors: FieldErrors = {}

  if (step === 0) {
    const name = checkFullName(input)
    if (name.error) errors.fullName = name.error
    const phone = checkPhone(input)
    if (phone.error) errors.phone = phone.error
    Object.assign(errors, checkAge(input).errors)
  } else if (step === 1) {
    const goals = checkGoals(input)
    if (goals.error) errors.goals = goals.error
    const fitness = checkFitnessLevel(input)
    if (fitness.error) errors.fitnessLevel = fitness.error
    const location = checkPreferredLocation(input)
    if (location.error) errors.preferredLocation = location.error
  } else {
    const days = checkAvailableDays(input)
    if (days.error) errors.availableDays = days.error
    const equip = checkEquipment(input)
    if (equip.error) errors.equipment = equip.error
  }

  return errors
}

/**
 * Validates and normalizes a raw onboarding payload. Returns a discriminated
 * {@link ActionResult}: on success the cleaned {@link ValidatedOnboarding};
 * on failure a generic message plus per-field error codes. The error codes are
 * stable keys (e.g. `"required"`, `"invalid"`, `"length"`, `"chars"`), not
 * user-facing prose, so the caller can localize them.
 *
 * Rules:
 * - `fullName` is required, {@link NAME_MIN}-{@link NAME_MAX} characters after
 *   trimming, and matches {@link NAME_RE} (Latin/Hebrew letters, space, dot,
 *   hyphen).
 * - `phone` is required; its normalized form must match {@link PHONE_RE} and be
 *   {@link PHONE_MIN}-{@link PHONE_MAX} characters.
 * - At least one of `age` (a number in {@link MIN_AGE}-{@link MAX_AGE}) or
 *   `ageRange` (a known bracket) must be present; both may be supplied.
 * - `fitnessLevel` is required and must be a known value.
 * - `goals` must contain at least one known goal; unknown or duplicate goals are
 *   rejected.
 * - `availableDays` must contain at least one known weekday; unknown or
 *   duplicate days are rejected.
 * - `preferredLocation` is required and must be a known location.
 * - `equipment` may be empty; every entry must be known and unique.
 * - `limitations` and `notes` are optional and trimmed.
 *
 * @param input - The raw payload from the onboarding form.
 * @returns A validated, normalized result or a field-keyed error result.
 */
export function validateOnboarding(
  input: OnboardingInput
): ActionResult<ValidatedOnboarding> {
  const fieldErrors: FieldErrors = {}

  const name = checkFullName(input)
  if (name.error) fieldErrors.fullName = name.error

  const phone = checkPhone(input)
  if (phone.error) fieldErrors.phone = phone.error

  const ageResult = checkAge(input)
  Object.assign(fieldErrors, ageResult.errors)

  const goalsResult = checkGoals(input)
  if (goalsResult.error) fieldErrors.goals = goalsResult.error

  const fitnessResult = checkFitnessLevel(input)
  if (fitnessResult.error) fieldErrors.fitnessLevel = fitnessResult.error

  const daysResult = checkAvailableDays(input)
  if (daysResult.error) fieldErrors.availableDays = daysResult.error

  const locationResult = checkPreferredLocation(input)
  if (locationResult.error) {
    fieldErrors.preferredLocation = locationResult.error
  }

  const equipmentResult = checkEquipment(input)
  if (equipmentResult.error) fieldErrors.equipment = equipmentResult.error

  const limitations = (input.limitations ?? "").trim() || null
  const notes = (input.notes ?? "").trim() || null

  if (Object.keys(fieldErrors).length > 0) {
    return fail("invalid", fieldErrors)
  }

  return ok({
    fullName: name.value,
    phone: phone.value,
    age: ageResult.age,
    ageRange: ageResult.ageRange,
    goals: goalsResult.value,
    // Non-null assertions are safe: a failing check would have populated
    // fieldErrors and returned above before reaching here.
    fitnessLevel: fitnessResult.value!,
    limitations,
    availableDays: daysResult.value,
    preferredLocation: locationResult.value!,
    equipment: equipmentResult.value,
    notes,
  })
}
