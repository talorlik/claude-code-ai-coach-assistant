import type { WorkoutLogRow } from "@/lib/db/types"

/**
 * Workout-logging vocabulary and payload shapes, kept in a plain (non
 * `"use server"`) module so they can be imported by both the server action
 * ({@link import("./logging-actions").completeWorkout}) and client components.
 *
 * A `"use server"` file may export only async functions; a client component
 * that imports a value from one throws at runtime. The plan view's completion
 * form needs the {@link DIFFICULTY_LEVELS}/{@link ENERGY_LEVELS} tuples to
 * render its selects, so those consts live here, away from the action boundary.
 */

/**
 * Allowed self-reported difficulty values. A const tuple so the action can
 * validate the form input and the message catalog can key off the same set.
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
