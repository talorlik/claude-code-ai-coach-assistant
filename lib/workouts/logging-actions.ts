"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { clientOwnsWorkout } from "@/lib/db/workouts"
import {
  insertWorkoutLog,
  listLogsForWorkouts,
} from "@/lib/db/workout-logs"
import { isDuplicateCompletion } from "@/lib/progress/progress"
import type { WorkoutLogRow } from "@/lib/db/types"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"

/**
 * Allowed self-reported difficulty values. Kept as a const tuple so the action
 * can validate the form input and the message catalog can key off the same set.
 */
export const DIFFICULTY_LEVELS = ["easy", "ok", "hard"] as const
/** Allowed self-reported energy values. */
export const ENERGY_LEVELS = ["low", "medium", "high"] as const

/** A self-reported difficulty value. */
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]
/** A self-reported energy value. */
export type EnergyLevel = (typeof ENERGY_LEVELS)[number]

/** Raw feedback payload submitted from the completion form. */
export interface CompleteWorkoutInput {
  /** The completed workout's id. */
  workoutId: string
  /**
   * The planned calendar date (`YYYY-MM-DD`). Optional; omit/empty for an
   * undated completion ("I did this session" without tying it to a date).
   */
  plannedDate?: string | null
  /** Optional difficulty; must be one of {@link DIFFICULTY_LEVELS} if present. */
  difficulty?: string | null
  /** Optional energy level; must be one of {@link ENERGY_LEVELS} if present. */
  energyLevel?: string | null
  /** Optional free-text notes (trimmed; capped to keep rows small). */
  notes?: string | null
}

/** What a successful completion returns to the client form. */
export interface CompleteWorkoutResult {
  /** The newly inserted log row. */
  log: WorkoutLogRow
}

const MAX_NOTES_LENGTH = 2000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Normalises an optional string to a trimmed value or `null`. */
function clean(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

/**
 * Records a client's completion of a workout, with optional difficulty, energy,
 * and notes feedback. This is the single write path for `workout_logs` from the
 * plan view.
 *
 * Guarantees, in order:
 *
 * 1. Authenticated session required (the action re-checks even though the page
 *    guards, because a server action is an independently callable entry point).
 * 2. Input is validated server-side: the workout id and any planned date,
 *    difficulty, and energy values must be well-formed; notes are trimmed and
 *    length-capped.
 * 3. The workout must belong to one of the caller's own plans
 *    ({@link clientOwnsWorkout}); otherwise a not-found error is returned rather
 *    than leaking another client's data through a write attempt.
 * 4. Duplicate completions are rejected: a friendly `duplicate` error is
 *    returned when a log already exists for the same workout and planned date,
 *    matching the DB's unique constraint, which is the ultimate backstop.
 *
 * On success the affected plan view caches are revalidated so progress updates.
 * Error strings are stable, localizable codes, never raw DB messages.
 *
 * @param input - The completion and feedback payload from the form.
 * @returns The inserted log on success, or a localizable error code.
 */
export async function completeWorkout(
  input: CompleteWorkoutInput
): Promise<ActionResult<CompleteWorkoutResult>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("signedOut")

  const workoutId = clean(input.workoutId)
  if (!workoutId) return fail("invalidWorkout")

  const plannedDate = clean(input.plannedDate)
  if (plannedDate && !DATE_RE.test(plannedDate)) {
    return fail("invalidDate")
  }

  const difficulty = clean(input.difficulty)
  if (
    difficulty &&
    !(DIFFICULTY_LEVELS as readonly string[]).includes(difficulty)
  ) {
    return fail("invalidDifficulty")
  }

  const energyLevel = clean(input.energyLevel)
  if (
    energyLevel &&
    !(ENERGY_LEVELS as readonly string[]).includes(energyLevel)
  ) {
    return fail("invalidEnergy")
  }

  const notes = clean(input.notes)
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return fail("notesTooLong")
  }

  // Authorization: the workout must belong to one of this client's plans.
  let owns: boolean
  try {
    owns = await clientOwnsWorkout(user.id, workoutId)
  } catch {
    return fail("saveFailed")
  }
  if (!owns) return fail("invalidWorkout")

  // Duplicate pre-check for a friendly message. The DB unique constraint is the
  // backstop for a race that slips past this read.
  try {
    const existing = await listLogsForWorkouts(user.id, [workoutId])
    if (isDuplicateCompletion(existing, { workoutId, plannedDate })) {
      return fail("duplicate")
    }
  } catch {
    return fail("saveFailed")
  }

  let log: WorkoutLogRow
  try {
    log = await insertWorkoutLog({
      clientId: user.id,
      workoutId,
      plannedDate,
      difficulty,
      energyLevel,
      notes,
    })
  } catch (error) {
    // A unique-violation here means a concurrent insert beat us; treat it as a
    // duplicate rather than a generic failure so the message stays accurate.
    const message = error instanceof Error ? error.message : ""
    if (message.includes("duplicate") || message.includes("unique")) {
      return fail("duplicate")
    }
    return fail("saveFailed")
  }

  // Progress changed: refresh the plan view's cached render in every locale.
  revalidatePath("/[locale]/my-plan", "page")

  return ok({ log })
}
