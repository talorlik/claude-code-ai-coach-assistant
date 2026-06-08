import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"
import { normalizePhone } from "@/lib/auth/validation"
import { countryByIso2 } from "@/lib/phone/countries"

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

/**
 * Equipment the client has access to (multi-select, may be empty). The closed
 * set covers common home and gym kit; anything not listed is captured as free
 * text via the UI's "Other" field and stored separately in `equipmentOther`
 * (see {@link parseEquipmentOther}). `"other"` is therefore NOT a member here -
 * it is a UI-only toggle, never a stored equipment value.
 */
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
  "jump_rope",
  "medicine_ball",
  "yoga_mat",
  "stability_ball",
  "foam_roller",
  "trx",
  "squat_rack",
  "treadmill",
  "stationary_bike",
  "rowing_machine",
] as const

export type Goal = (typeof GOALS)[number]
export type FitnessLevel = (typeof FITNESS_LEVELS)[number]
export type AgeRange = (typeof AGE_RANGES)[number]
export type WorkoutLocation = (typeof LOCATIONS)[number]
export type WorkoutDay = (typeof WORKOUT_DAYS)[number]
export type Equipment = (typeof EQUIPMENT)[number]

/**
 * Availability rules. Each selected training day must carry at least one time
 * window; windows are 24h `HH:MM` strings with `start < end` and must not
 * overlap within a day. {@link MAX_RANGES_PER_DAY} caps how many windows a day
 * may hold, keeping the editor and the AI prompt bounded.
 */
export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
export const MAX_RANGES_PER_DAY = 4

/** A single training window within a day (24h `HH:MM`). */
export interface TimeRange {
  start: string
  end: string
}

/** Per-day training windows, keyed by weekday (a subset of `availableDays`). */
export type Availability = Record<string, TimeRange[]>

/**
 * Session-duration rules. The client picks a single desired session length that
 * applies to every training day, in {@link DURATION_STEP}-minute increments
 * between {@link MIN_DURATION} and {@link MAX_DURATION}.
 */
export const DURATION_STEP = 15
export const MIN_DURATION = 15
export const MAX_DURATION = 180

/**
 * Free-text "Other" equipment rules. The raw comma-separated string is parsed
 * into a deduplicated list; each item is length-capped and the list is
 * count-capped so a tampered or runaway input cannot bloat the row or prompt.
 */
export const EQUIPMENT_OTHER_MAX_ITEMS = 10
export const EQUIPMENT_OTHER_ITEM_MAX = 40

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
 * Phone rules. The selector always prepends a country dial code, so the stored
 * value is full E.164: a leading `+`, a non-zero country digit, then 7-14 more
 * digits (8-15 digits total after the `+`). `PHONE_RE` enforces that exact
 * shape on the normalized value. This single rule is shared by onboarding and
 * profile so the two never diverge.
 */
export const PHONE_RE = /^\+[1-9]\d{7,14}$/

/**
 * Which onboarding fields each wizard step owns. The single source of truth for
 * step ownership: the client form gates and saves per step against this map,
 * and {@link validateOnboardingStep} validates only the named fields. Mirrors
 * the field groupings rendered by the three sub-step components in the form.
 */
export const STEP_FIELDS = {
  0: ["fullName", "phone", "countryIso2", "age", "ageRange"],
  1: ["goals", "fitnessLevel", "preferredLocation"],
  2: [
    "availableDays",
    "availability",
    "sessionDurationMinutes",
    "equipment",
    "equipmentOther",
    "limitations",
    "notes",
  ],
} as const

/** A wizard step index. */
export type OnboardingStep = keyof typeof STEP_FIELDS

/** Raw, untrusted onboarding payload as it arrives from the client form. */
export interface OnboardingInput {
  fullName: string
  phone?: string
  countryIso2?: string | null
  age?: string | number | null
  ageRange?: string | null
  goals?: string[]
  fitnessLevel?: string | null
  limitations?: string | null
  availableDays?: string[]
  /** Per-day windows; keys should match {@link availableDays}. */
  availability?: Availability
  /** Desired session length in minutes; string from a form, number from code. */
  sessionDurationMinutes?: string | number | null
  preferredLocation?: string | null
  equipment?: string[]
  /** Whether the UI's "Other" equipment toggle is on (gates `equipmentOther`). */
  equipmentOtherSelected?: boolean
  /** Raw comma-separated "Other" equipment text, parsed by the validator. */
  equipmentOther?: string
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
  countryIso2: string
  age: number | null
  ageRange: AgeRange | null
  goals: Goal[]
  fitnessLevel: FitnessLevel
  limitations: string | null
  availableDays: WorkoutDay[]
  availability: Availability
  sessionDurationMinutes: number
  preferredLocation: WorkoutLocation
  equipment: Equipment[]
  equipmentOther: string[]
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

/** Phone: required; normalized form must match the E.164 shape PHONE_RE. */
function checkPhone(input: OnboardingInput): {
  value: string
  error?: string
} {
  const value = normalizePhone(input.phone ?? "")
  if (value.length === 0) return { value, error: "required" }
  if (!PHONE_RE.test(value)) return { value, error: "invalid" }
  return { value }
}

/**
 * Country: required and must be a known ISO2 in the bundled dataset. Guards
 * against tampered or no-JS posts carrying an unknown code. Returns the
 * uppercased code on success.
 */
function checkCountryIso2(input: OnboardingInput): {
  value: string
  error?: string
} {
  const raw = (input.countryIso2 ?? "").trim().toUpperCase()
  if (raw.length === 0) return { value: "", error: "required" }
  if (!countryByIso2(raw)) return { value: "", error: "invalid" }
  return { value: raw }
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
 * Per-day availability windows. Compulsory: every selected training day must
 * carry at least one valid, non-overlapping window. Validates against the
 * already-cleaned `availableDays` so the two stay consistent (a window for an
 * unselected day, or a missing window for a selected day, both fail).
 *
 * Error codes: `required` (a selected day has no window, or none given at all),
 * `invalid` (malformed `HH:MM`, `start >= end`, an extra/unknown day, or too
 * many windows), `overlap` (two windows on the same day intersect).
 *
 * @param input - The raw payload (reads `availability`).
 * @param days - The cleaned set of selected training days from
 *   {@link checkAvailableDays}; windows are validated against exactly this set.
 */
function checkAvailability(
  input: OnboardingInput,
  days: WorkoutDay[]
): { value: Availability; error?: string } {
  const raw = input.availability ?? {}
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { value: {}, error: "invalid" }
  }

  const daySet = new Set<string>(days)
  // A window keyed to a day the client did not select is a mismatch.
  for (const key of Object.keys(raw)) {
    if (!daySet.has(key)) return { value: {}, error: "invalid" }
  }

  const cleaned: Availability = {}
  for (const day of days) {
    const ranges = raw[day]
    if (!Array.isArray(ranges) || ranges.length === 0) {
      return { value: {}, error: "required" }
    }
    if (ranges.length > MAX_RANGES_PER_DAY) {
      return { value: {}, error: "invalid" }
    }

    const normalized: TimeRange[] = []
    for (const range of ranges) {
      const start = typeof range?.start === "string" ? range.start : ""
      const end = typeof range?.end === "string" ? range.end : ""
      if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
        return { value: {}, error: "invalid" }
      }
      // Zero-padded HH:MM compares correctly as strings.
      if (start >= end) return { value: {}, error: "invalid" }
      normalized.push({ start, end })
    }

    // Reject overlaps: sort by start, assert each window ends at or before the
    // next one begins.
    const sorted = [...normalized].sort((a, b) => a.start.localeCompare(b.start))
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end) {
        return { value: {}, error: "overlap" }
      }
    }

    cleaned[day] = sorted
  }

  return { value: cleaned }
}

/**
 * Desired session length. Compulsory: a single integer number of minutes that
 * is a multiple of {@link DURATION_STEP} within
 * {@link MIN_DURATION}-{@link MAX_DURATION}. Accepts a string (from a form) or a
 * number. Error codes: `required`, `invalid` (non-numeric or off-step),
 * `range` (out of bounds).
 */
function checkSessionDuration(input: OnboardingInput): {
  value: number | null
  error?: string
} {
  const raw = input.sessionDurationMinutes
  if (raw === "" || raw === null || raw === undefined) {
    return { value: null, error: "required" }
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value % DURATION_STEP !== 0) {
    return { value: null, error: "invalid" }
  }
  if (value < MIN_DURATION || value > MAX_DURATION) {
    return { value: null, error: "range" }
  }
  return { value }
}

/**
 * Parses the free-text "Other" equipment field into a cleaned list: split on
 * commas, trim, drop empties, and dedupe case-insensitively (keeping the first
 * casing seen). Rejects an item longer than {@link EQUIPMENT_OTHER_ITEM_MAX} or
 * a list longer than {@link EQUIPMENT_OTHER_MAX_ITEMS}. When the UI's "Other"
 * toggle is on ({@link OnboardingInput.equipmentOtherSelected}), the list must
 * be non-empty. Exported for reuse and direct unit testing.
 *
 * @param input - The raw payload (reads `equipmentOther` and the toggle).
 * @returns The cleaned list plus an optional error (`required`, `length`).
 */
export function parseEquipmentOther(input: OnboardingInput): {
  value: string[]
  error?: string
} {
  const raw = (input.equipmentOther ?? "").trim()
  const selected = input.equipmentOtherSelected === true

  if (raw.length === 0) {
    return selected ? { value: [], error: "required" } : { value: [] }
  }

  const seen = new Set<string>()
  const value: string[] = []
  for (const part of raw.split(",")) {
    const item = part.trim()
    if (item.length === 0) continue
    if (item.length > EQUIPMENT_OTHER_ITEM_MAX) {
      return { value: [], error: "length" }
    }
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    value.push(item)
  }

  if (value.length === 0) {
    // Only separators/spaces were supplied.
    return selected ? { value: [], error: "required" } : { value: [] }
  }
  if (value.length > EQUIPMENT_OTHER_MAX_ITEMS) {
    return { value: [], error: "length" }
  }
  return { value }
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
    const country = checkCountryIso2(input)
    if (country.error) errors.countryIso2 = country.error
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
    // Availability is validated against the cleaned day set; when days are
    // themselves invalid, validate against an empty set so the user fixes the
    // day selection first rather than seeing a confusing window error.
    const availability = checkAvailability(input, days.error ? [] : days.value)
    if (availability.error) errors.availability = availability.error
    const duration = checkSessionDuration(input)
    if (duration.error) errors.sessionDurationMinutes = duration.error
    const equip = checkEquipment(input)
    if (equip.error) errors.equipment = equip.error
    const equipOther = parseEquipmentOther(input)
    if (equipOther.error) errors.equipmentOther = equipOther.error
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
 * - `phone` is required; its normalized form must match the E.164 shape
 *   {@link PHONE_RE}.
 * - `countryIso2` is required and must be a known ISO 3166-1 alpha-2 code.
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

  const country = checkCountryIso2(input)
  if (country.error) fieldErrors.countryIso2 = country.error

  const ageResult = checkAge(input)
  Object.assign(fieldErrors, ageResult.errors)

  const goalsResult = checkGoals(input)
  if (goalsResult.error) fieldErrors.goals = goalsResult.error

  const fitnessResult = checkFitnessLevel(input)
  if (fitnessResult.error) fieldErrors.fitnessLevel = fitnessResult.error

  const daysResult = checkAvailableDays(input)
  if (daysResult.error) fieldErrors.availableDays = daysResult.error

  const availabilityResult = checkAvailability(
    input,
    daysResult.error ? [] : daysResult.value
  )
  if (availabilityResult.error) {
    fieldErrors.availability = availabilityResult.error
  }

  const durationResult = checkSessionDuration(input)
  if (durationResult.error) {
    fieldErrors.sessionDurationMinutes = durationResult.error
  }

  const locationResult = checkPreferredLocation(input)
  if (locationResult.error) {
    fieldErrors.preferredLocation = locationResult.error
  }

  const equipmentResult = checkEquipment(input)
  if (equipmentResult.error) fieldErrors.equipment = equipmentResult.error

  const equipmentOtherResult = parseEquipmentOther(input)
  if (equipmentOtherResult.error) {
    fieldErrors.equipmentOther = equipmentOtherResult.error
  }

  const limitations = (input.limitations ?? "").trim() || null
  const notes = (input.notes ?? "").trim() || null

  if (Object.keys(fieldErrors).length > 0) {
    return fail("invalid", fieldErrors)
  }

  return ok({
    fullName: name.value,
    phone: phone.value,
    countryIso2: country.value,
    age: ageResult.age,
    ageRange: ageResult.ageRange,
    goals: goalsResult.value,
    // Non-null assertions are safe: a failing check would have populated
    // fieldErrors and returned above before reaching here.
    fitnessLevel: fitnessResult.value!,
    limitations,
    availableDays: daysResult.value,
    availability: availabilityResult.value,
    sessionDurationMinutes: durationResult.value!,
    preferredLocation: locationResult.value!,
    equipment: equipmentResult.value,
    equipmentOther: equipmentOtherResult.value,
    notes,
  })
}
