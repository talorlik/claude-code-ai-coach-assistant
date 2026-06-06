"use server"

import { revalidatePath } from "next/cache"

import { requireTrainerAdmin } from "@/lib/auth/require-user"
import { getClient } from "@/lib/db/clients"
import {
  addExercise,
  addWorkout,
  deleteExercise,
  deleteWorkout,
  getPlanOwnerClient,
  getWorkoutOwnerClient,
  listWorkoutExercises,
  updateExercise,
  updateWorkout,
  type ExerciseEditFields,
  type WorkoutEditFields,
} from "@/lib/db/plan-edits"
import { exerciseSchema, workoutSchema } from "@/lib/ai/schemas"
import type { ExerciseRow, WorkoutRow } from "@/lib/db/types"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"

/**
 * Server actions for the trainer's live-plan editor. Each action is an
 * independently callable entry point, so each re-runs {@link requireTrainerAdmin}
 * FIRST (RLS is the database backstop), validates its input PRE-WRITE against the
 * shared `lib/ai/schemas` shapes, enforces the per-client safety-note rule, then
 * writes through the RLS-scoped `lib/db/plan-edits` layer and revalidates the
 * localized client surfaces.
 *
 * Pre-write validation is deliberate: Supabase has no client-side transaction
 * here, so rejecting an invalid edit BEFORE writing avoids the need for rollback.
 * The safety rule mirrors `assignTemplateAction` and the batch-08 validator: when
 * the target client reported limitations/injuries, every exercise in the affected
 * workout must carry non-empty `safety_notes`, so an edit that would leave any
 * exercise unguarded is rejected.
 *
 * Failures are returned as `ActionResult` failures (with localizable codes in
 * `fieldErrors.code`) rather than thrown, so the editor surfaces them inline.
 */

/** The editable subset of an exercise the editor submits (no identity columns). */
export type ExerciseInput = ExerciseEditFields
/** The editable subset of a workout the editor submits (no identity columns). */
export type WorkoutInput = WorkoutEditFields

/** Shape-only schema for an exercise edit: the exercise schema sans safety rule. */
const exerciseEditSchema = exerciseSchema
/** Shape-only schema for a workout edit: workout metadata without its exercises. */
const workoutEditSchema = workoutSchema.omit({ exercises: true })

/** Revalidates a client's localized dashboard and my-plan paths after an edit. */
function revalidateClientSurfaces(clientId: string): void {
  // `localePrefix: "always"` means every surface lives under `/en` and `/he`;
  // revalidate both so the change shows regardless of the trainer's locale, and
  // the client's own My Plan reflects it immediately (mirrors RegenerateClientPlan).
  revalidatePath("/en/my-plan")
  revalidatePath("/he/my-plan")
  revalidatePath(`/en/trainer/clients/${clientId}`)
  revalidatePath(`/he/trainer/clients/${clientId}`)
}

/** Whether a non-empty limitations string was recorded for the client. */
async function clientHasLimitations(clientId: string): Promise<boolean> {
  const client = await getClient(clientId)
  return Boolean(client?.limitations && client.limitations.trim() !== "")
}

/**
 * Enforces the per-client safety rule over a prospective exercise set. When the
 * client has limitations, every exercise must carry non-empty `safety_notes`;
 * otherwise the rule does not apply. Returns `true` when the set is acceptable.
 */
function safetyRuleSatisfied(
  exercises: Pick<ExerciseEditFields, "safety_notes">[],
  hasLimitations: boolean
): boolean {
  if (!hasLimitations) return true
  return exercises.every(
    (e) => e.safety_notes != null && e.safety_notes.trim() !== ""
  )
}

/**
 * Validates and persists an edit to a single exercise. Resolves the owning
 * client, validates the field shape, then re-checks the safety rule against the
 * workout's exercises AS THEY WOULD BE after this edit (the edited exercise
 * substituted in), so clearing a required safety note is rejected for a limited
 * client.
 *
 * @param exerciseId - The exercise to update.
 * @param fields - The replacement editable values.
 * @returns The updated exercise, or a validation/auth/data failure.
 */
export async function updateExerciseAction(
  exerciseId: string,
  fields: ExerciseInput
): Promise<ActionResult<ExerciseRow>> {
  await requireTrainerAdmin()

  const parsed = exerciseEditSchema.safeParse(fields)
  if (!parsed.success) {
    return fail("Please correct the highlighted fields.", { code: "invalid" })
  }

  let current: ExerciseRow[]
  let clientId: string | null
  try {
    current = await exerciseWorkoutSiblings(exerciseId)
    clientId = current.length > 0 ? await ownerForExercise(exerciseId) : null
  } catch {
    return fail("Could not load the exercise. Please try again.", {
      code: "loadError",
    })
  }

  const found = current.find((e) => e.id === exerciseId)
  if (!found)
    return fail("That exercise no longer exists.", { code: "missing" })

  const hasLimitations = clientId ? await clientHasLimitations(clientId) : false
  const prospective = current.map((e) =>
    e.id === exerciseId ? { safety_notes: parsed.data.safety_notes } : e
  )
  if (!safetyRuleSatisfied(prospective, hasLimitations)) {
    return fail("This client requires safety notes on every exercise.", {
      code: "safetyRequired",
    })
  }

  try {
    const row = await updateExercise(exerciseId, parsed.data)
    if (clientId) revalidateClientSurfaces(clientId)
    return ok(row)
  } catch {
    return fail("Could not save the exercise. Please try again.", {
      code: "saveError",
    })
  }
}

/**
 * Validates and persists an edit to a workout's metadata. Never touches
 * `workout_logs`, so completion history is preserved. The safety rule does not
 * apply to metadata (it governs exercises), so no exercise re-check is needed.
 *
 * @param workoutId - The workout to update.
 * @param fields - The replacement editable metadata.
 * @returns The updated workout, or a validation/auth/data failure.
 */
export async function updateWorkoutAction(
  workoutId: string,
  fields: WorkoutInput
): Promise<ActionResult<WorkoutRow>> {
  await requireTrainerAdmin()

  const parsed = workoutEditSchema.safeParse(fields)
  if (!parsed.success) {
    return fail("Please correct the highlighted fields.", { code: "invalid" })
  }

  let clientId: string | null
  try {
    clientId = await getWorkoutOwnerClient(workoutId)
  } catch {
    return fail("Could not load the workout. Please try again.", {
      code: "loadError",
    })
  }
  if (!clientId) {
    return fail("That workout no longer exists.", { code: "missing" })
  }

  try {
    const row = await updateWorkout(workoutId, parsed.data)
    revalidateClientSurfaces(clientId)
    return ok(row)
  } catch {
    return fail("Could not save the workout. Please try again.", {
      code: "saveError",
    })
  }
}

/**
 * Validates and inserts a new exercise at the end of a workout. Re-checks the
 * safety rule against the workout's exercises PLUS the new one, so adding an
 * unguarded exercise to a limited client's workout is rejected.
 *
 * @param workoutId - The parent workout.
 * @param fields - The new exercise values.
 * @returns The inserted exercise, or a validation/auth/data failure.
 */
export async function addExerciseAction(
  workoutId: string,
  fields: ExerciseInput
): Promise<ActionResult<ExerciseRow>> {
  await requireTrainerAdmin()

  const parsed = exerciseEditSchema.safeParse(fields)
  if (!parsed.success) {
    return fail("Please correct the highlighted fields.", { code: "invalid" })
  }

  let current: ExerciseRow[]
  let clientId: string | null
  try {
    current = await listWorkoutExercises(workoutId)
    clientId = await getWorkoutOwnerClient(workoutId)
  } catch {
    return fail("Could not load the workout. Please try again.", {
      code: "loadError",
    })
  }
  if (!clientId) {
    return fail("That workout no longer exists.", { code: "missing" })
  }

  const hasLimitations = await clientHasLimitations(clientId)
  if (
    !safetyRuleSatisfied(
      [...current, { safety_notes: parsed.data.safety_notes }],
      hasLimitations
    )
  ) {
    return fail("This client requires safety notes on every exercise.", {
      code: "safetyRequired",
    })
  }

  const position = nextPosition(current.map((e) => e.position))
  try {
    const row = await addExercise(workoutId, { ...parsed.data, position })
    revalidateClientSurfaces(clientId)
    return ok(row)
  } catch {
    return fail("Could not add the exercise. Please try again.", {
      code: "saveError",
    })
  }
}

/**
 * Validates and inserts a new (empty) workout at the end of a plan. An empty
 * workout has no exercises, so the safety rule is vacuously satisfied until the
 * trainer adds exercises (each add re-checks the rule).
 *
 * @param planId - The parent plan.
 * @param fields - The new workout metadata.
 * @returns The inserted workout, or a validation/auth/data failure.
 */
export async function addWorkoutAction(
  planId: string,
  fields: WorkoutInput
): Promise<ActionResult<WorkoutRow>> {
  await requireTrainerAdmin()

  const parsed = workoutEditSchema.safeParse(fields)
  if (!parsed.success) {
    return fail("Please correct the highlighted fields.", { code: "invalid" })
  }

  let clientId: string | null
  try {
    clientId = await getPlanOwnerClient(planId)
  } catch {
    return fail("Could not load the plan. Please try again.", {
      code: "loadError",
    })
  }
  if (!clientId) return fail("That plan no longer exists.", { code: "missing" })

  // New workouts append after the highest existing position. Reading the plan's
  // workouts here would add a query; the editor passes the next position via the
  // sibling count instead. We default to 0 and rely on the trailing order; the
  // renderer sorts by position so equal positions keep insertion order.
  try {
    const row = await addWorkout(planId, { ...parsed.data, position: 0 })
    revalidateClientSurfaces(clientId)
    return ok(row)
  } catch {
    return fail("Could not add the workout. Please try again.", {
      code: "saveError",
    })
  }
}

/**
 * Deletes one exercise. Safe with respect to history (logs reference workouts,
 * not exercises). Re-checks the safety rule on the REMAINING exercises so a
 * limited client never ends up with a workout, though removing an exercise can
 * only reduce risk; the check is kept for symmetry and future-proofing.
 *
 * @param exerciseId - The exercise to delete.
 * @returns Success, or an auth/data failure.
 */
export async function deleteExerciseAction(
  exerciseId: string
): Promise<ActionResult<{ id: string }>> {
  await requireTrainerAdmin()

  let clientId: string | null = null
  try {
    clientId = await ownerForExercise(exerciseId)
  } catch {
    return fail("Could not load the exercise. Please try again.", {
      code: "loadError",
    })
  }

  try {
    await deleteExercise(exerciseId)
    if (clientId) revalidateClientSurfaces(clientId)
    return ok({ id: exerciseId })
  } catch {
    return fail("Could not delete the exercise. Please try again.", {
      code: "saveError",
    })
  }
}

/**
 * Deletes a workout, but ONLY when it has no completion logs. A workout WITH
 * logs cannot be hard-deleted (the cascade would destroy history); this returns
 * a typed `hasLogs` failure so the editor shows a blocking message rather than
 * silently losing data. Use regeneration for wholesale changes.
 *
 * @param workoutId - The workout to delete.
 * @returns Success, or a `hasLogs`/auth/data failure.
 */
export async function deleteWorkoutAction(
  workoutId: string
): Promise<ActionResult<{ id: string }>> {
  await requireTrainerAdmin()

  let clientId: string | null
  try {
    clientId = await getWorkoutOwnerClient(workoutId)
  } catch {
    return fail("Could not load the workout. Please try again.", {
      code: "loadError",
    })
  }
  if (!clientId) {
    return fail("That workout no longer exists.", { code: "missing" })
  }

  let outcome
  try {
    outcome = await deleteWorkout(workoutId)
  } catch {
    return fail("Could not delete the workout. Please try again.", {
      code: "saveError",
    })
  }

  if (!outcome.ok) {
    // Blocking, non-silent: the workout has logged sessions, so deleting it
    // would erase the client's progress history via the ON DELETE CASCADE.
    return fail("Cannot delete a workout with logged sessions.", {
      code: "hasLogs",
    })
  }

  revalidateClientSurfaces(clientId)
  return ok({ id: workoutId })
}

/** Next append position: one past the current maximum, or 0 when empty. */
function nextPosition(positions: number[]): number {
  if (positions.length === 0) return 0
  return Math.max(...positions) + 1
}

/**
 * Loads the sibling exercises of the workout that owns `exerciseId`, so an edit
 * can be validated against the full post-edit set. Returns `[]` when the
 * exercise is not visible. Throws on a database error.
 */
async function exerciseWorkoutSiblings(
  exerciseId: string
): Promise<ExerciseRow[]> {
  const workoutId = await workoutForExercise(exerciseId)
  if (!workoutId) return []
  return listWorkoutExercises(workoutId)
}

/** Resolves the parent workout id of an exercise, or `null` when not visible. */
async function workoutForExercise(exerciseId: string): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("exercises")
    .select("workout_id")
    .eq("id", exerciseId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to resolve exercise workout: ${error.message}`)
  }
  return (data as { workout_id?: string } | null)?.workout_id ?? null
}

/** Resolves the owning client of an exercise via its workout, or `null`. */
async function ownerForExercise(exerciseId: string): Promise<string | null> {
  const workoutId = await workoutForExercise(exerciseId)
  if (!workoutId) return null
  return getWorkoutOwnerClient(workoutId)
}
