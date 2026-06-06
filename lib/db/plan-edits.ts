import { createClient } from "@/lib/supabase/server"
import type { ExerciseRow, WorkoutRow } from "@/lib/db/types"

/**
 * Server-only WRITE data access for editing a client's live assigned plan in
 * place: narrow updates, inserts, and deletes over the `workouts` and
 * `exercises` tables. Every call uses the request-scoped Supabase client, so the
 * "Trainer admin manages app data" RLS policy applies (the secret/admin client
 * is never used here). The reads needed to support safe writes
 * ({@link listWorkoutExercises}, {@link getWorkoutOwnerClient}) are colocated
 * here so the editor actions have a single write-oriented module.
 *
 * CRITICAL CASCADE HAZARD: `workout_logs.workout_id` is `ON DELETE CASCADE`
 * (migration `0002_app_schema.sql`), so hard-deleting a workout SILENTLY deletes
 * that workout's completion logs and corrupts the client's progress history.
 * {@link deleteWorkout} therefore counts referencing logs first and refuses when
 * any exist. Exercises are NOT referenced by logs, so {@link deleteExercise} is
 * always safe; editing workout metadata never touches logs.
 *
 * These functions write only the explicitly listed columns. They do not
 * re-validate plan shape or the per-client safety rule; the server actions in
 * `lib/trainer/plan-edit-actions.ts` own that pre-write validation.
 */

/** Editable exercise columns. Identity, ordering parent, and timestamps excluded. */
export interface ExerciseEditFields {
  name: string
  sets: number | null
  reps: string | null
  duration: string | null
  rest: string | null
  instructions: string | null
  safety_notes: string | null
}

/** Editable workout columns. `plan_id` and timestamps are not editable here. */
export interface WorkoutEditFields {
  title: string
  focus: string | null
  day_of_week: string | null
  notes: string | null
}

/** A typed failure returned when a delete is refused to protect data integrity. */
export type DeleteOutcome =
  | { ok: true }
  | { ok: false; reason: "has_logs"; logCount: number }

/**
 * Lists a workout's exercises in stored `position` order. The editor actions
 * call this to compute the post-edit exercise set for the per-client safety
 * re-validation before any write. Throws on a database error.
 *
 * @param workoutId - The workout whose exercises to load.
 * @returns The workout's exercises, ordered by `position`.
 */
export async function listWorkoutExercises(
  workoutId: string
): Promise<ExerciseRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("workout_id", workoutId)
    .order("position", { ascending: true })

  if (error) {
    throw new Error(`Failed to load workout exercises: ${error.message}`)
  }
  return (data as ExerciseRow[]) ?? []
}

/**
 * Resolves the owning client's auth user id for a workout, by walking
 * `workouts -> workout_plans.client_id`. The editor actions use this to load the
 * client's limitations for the safety rule. Returns `null` when the workout is
 * not visible (RLS) or does not exist. Throws on a database error.
 *
 * @param workoutId - The workout to resolve ownership for.
 * @returns The owning client's id, or `null`.
 */
export async function getWorkoutOwnerClient(
  workoutId: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workouts")
    .select("id, workout_plans!inner(client_id)")
    .eq("id", workoutId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to resolve workout owner: ${error.message}`)
  }
  if (!data) return null
  // The embedded relation comes back either as an object or a single-element
  // array depending on the driver; normalise both shapes.
  const plan = (data as { workout_plans: unknown }).workout_plans
  const row = Array.isArray(plan) ? plan[0] : plan
  return (row as { client_id?: string } | null)?.client_id ?? null
}

/**
 * Resolves the owning client's auth user id for a plan. Used when adding a new
 * workout to a plan, so the safety rule can read the client's limitations.
 * Returns `null` when the plan is not visible or does not exist. Throws on a
 * database error.
 *
 * @param planId - The plan to resolve ownership for.
 * @returns The owning client's id, or `null`.
 */
export async function getPlanOwnerClient(
  planId: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workout_plans")
    .select("client_id")
    .eq("id", planId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to resolve plan owner: ${error.message}`)
  }
  return (data as { client_id?: string } | null)?.client_id ?? null
}

/**
 * Counts the `workout_logs` rows referencing a workout. {@link deleteWorkout}
 * uses this as the guard against the cascade hazard; the editor also surfaces a
 * non-zero count so the trainer understands why a delete is blocked. Throws on a
 * database error.
 *
 * @param workoutId - The workout to count logs for.
 * @returns The number of completion logs referencing the workout.
 */
export async function countWorkoutLogs(workoutId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("workout_logs")
    .select("id", { count: "exact", head: true })
    .eq("workout_id", workoutId)

  if (error) {
    throw new Error(`Failed to count workout logs: ${error.message}`)
  }
  return count ?? 0
}

/**
 * Updates only the editable columns of one exercise and returns the saved row.
 * `position` is updatable so the editor can reorder; identity, parent, and
 * timestamps are not. RLS restricts this to the trainer admin (and the owning
 * client, who has no editor UI). Throws on a database error.
 *
 * @param exerciseId - The exercise to update.
 * @param fields - The replacement editable values.
 * @returns The updated exercise row.
 */
export async function updateExercise(
  exerciseId: string,
  fields: ExerciseEditFields & { position?: number }
): Promise<ExerciseRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("exercises")
    .update({
      name: fields.name,
      sets: fields.sets,
      reps: fields.reps,
      duration: fields.duration,
      rest: fields.rest,
      instructions: fields.instructions,
      safety_notes: fields.safety_notes,
      ...(fields.position != null ? { position: fields.position } : {}),
    })
    .eq("id", exerciseId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to update exercise: ${error?.message ?? "no row returned"}`
    )
  }
  return data as ExerciseRow
}

/**
 * Updates only the editable metadata columns of one workout and returns the
 * saved row. Crucially this never touches `workout_logs`, so a client's
 * completion history is preserved across metadata edits. Throws on a database
 * error.
 *
 * @param workoutId - The workout to update.
 * @param fields - The replacement editable values.
 * @returns The updated workout row.
 */
export async function updateWorkout(
  workoutId: string,
  fields: WorkoutEditFields & { position?: number }
): Promise<WorkoutRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workouts")
    .update({
      title: fields.title,
      focus: fields.focus,
      day_of_week: fields.day_of_week,
      notes: fields.notes,
      ...(fields.position != null ? { position: fields.position } : {}),
    })
    .eq("id", workoutId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to update workout: ${error?.message ?? "no row returned"}`
    )
  }
  return data as WorkoutRow
}

/**
 * Inserts a new exercise into a workout and returns the saved row. The caller
 * computes `position` (appended at the end by the action). Throws on a database
 * error.
 *
 * @param workoutId - The parent workout.
 * @param fields - The new exercise values, including its `position`.
 * @returns The inserted exercise row.
 */
export async function addExercise(
  workoutId: string,
  fields: ExerciseEditFields & { position: number }
): Promise<ExerciseRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      workout_id: workoutId,
      name: fields.name,
      sets: fields.sets,
      reps: fields.reps,
      duration: fields.duration,
      rest: fields.rest,
      instructions: fields.instructions,
      safety_notes: fields.safety_notes,
      position: fields.position,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to add exercise: ${error?.message ?? "no row returned"}`
    )
  }
  return data as ExerciseRow
}

/**
 * Inserts a new (empty) workout into a plan and returns the saved row. The
 * action computes `position` (appended at the end). A workout with no exercises
 * is a valid rest day in the renderer; the trainer adds exercises afterward.
 * Throws on a database error.
 *
 * @param planId - The parent plan.
 * @param fields - The new workout metadata, including its `position`.
 * @returns The inserted workout row.
 */
export async function addWorkout(
  planId: string,
  fields: WorkoutEditFields & { position: number }
): Promise<WorkoutRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workouts")
    .insert({
      plan_id: planId,
      title: fields.title,
      focus: fields.focus,
      day_of_week: fields.day_of_week,
      notes: fields.notes,
      position: fields.position,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to add workout: ${error?.message ?? "no row returned"}`
    )
  }
  return data as WorkoutRow
}

/**
 * Deletes one exercise. Safe with respect to history: `workout_logs` reference
 * workouts, not exercises, so removing an exercise never cascades to a log.
 * Throws on a database error.
 *
 * @param exerciseId - The exercise to delete.
 */
export async function deleteExercise(exerciseId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", exerciseId)

  if (error) {
    throw new Error(`Failed to delete exercise: ${error.message}`)
  }
}

/**
 * Deletes a workout ONLY when no completion logs reference it. Because
 * `workout_logs.workout_id` cascades on delete, removing a workout with logs
 * would silently destroy the client's history; this counts referencing logs
 * first and returns a typed `has_logs` failure (with the count) instead of
 * deleting. Wholesale plan changes go through regeneration, which archives the
 * old plan rather than mutating it. Throws only on an unexpected database error
 * (a refusal is a normal, non-throwing outcome).
 *
 * @param workoutId - The workout to delete.
 * @returns `{ ok: true }` on deletion, or a typed `has_logs` refusal.
 */
export async function deleteWorkout(workoutId: string): Promise<DeleteOutcome> {
  const logCount = await countWorkoutLogs(workoutId)
  if (logCount > 0) {
    return { ok: false, reason: "has_logs", logCount }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("workouts").delete().eq("id", workoutId)

  if (error) {
    throw new Error(`Failed to delete workout: ${error.message}`)
  }
  return { ok: true }
}
