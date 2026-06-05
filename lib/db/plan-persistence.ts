import { createClient } from "@/lib/supabase/server"
import type { GeneratedPlan } from "@/lib/ai/schemas"
import type {
  GenerationSource,
  GenerationStatus,
  PlanSource,
  WorkoutPlanRow,
} from "@/lib/db/types"

/**
 * Server-only persistence for a validated, AI-generated workout plan. Writes
 * the plan and its nested workouts and exercises as structured rows through the
 * request-scoped Supabase client, so RLS scopes every write to the owning
 * client (or the trainer admin). Only call this with a plan that has already
 * passed `validateGeneratedPlan`; this module does not re-validate shape.
 *
 * Supabase has no client-side multi-statement transaction, so the inserts run
 * in dependency order (plan, then workouts, then their exercises). If any step
 * fails, the partially written plan row is deleted; its `on delete cascade`
 * foreign keys remove any child workouts/exercises, leaving nothing partial
 * visible to the client. The batch contract is "never save a partial plan".
 */

/** Options controlling how a generated plan is persisted. */
export interface SavePlanOptions {
  /** The auth user id of the owning client. */
  clientId: string
  /** The validated plan to persist. */
  plan: GeneratedPlan
  /** Locale tag stamped on the plan row (drives later localized rendering). */
  localeTag: string
  /**
   * When true, the client's current `active` plan is archived (status
   * `archived`, `archived_at` set) before the new plan is inserted, preserving
   * history. Onboarding's first generation passes `false` (there is no prior
   * plan); regeneration passes `true`. Archiving only when regenerating matches
   * task 8 of the batch.
   */
  archivePrevious?: boolean
  /** Provenance of the plan; defaults to `ai`. See {@link PlanSource}. */
  source?: PlanSource
}

/** A persisted plan with its database id and the row metadata. */
export interface SavedPlan {
  /** The inserted `workout_plans` row. */
  plan: WorkoutPlanRow
  /** Number of workout sessions written. */
  workoutCount: number
  /** Total exercises written across all sessions. */
  exerciseCount: number
}

/**
 * Persists a validated plan and its workouts/exercises, optionally archiving
 * the client's previous active plan first. Returns the saved plan row plus
 * counts. Throws a descriptive `Error` on any database failure, after attempting
 * to remove a partially written plan so the client never sees half a plan.
 *
 * @param options - Client id, validated plan, locale, and archive/source flags.
 * @returns The saved plan row and child counts.
 */
export async function saveGeneratedPlan(
  options: SavePlanOptions
): Promise<SavedPlan> {
  const {
    clientId,
    plan,
    localeTag,
    archivePrevious = false,
    source = "ai",
  } = options

  const supabase = await createClient()

  // Archive the prior active plan first, but only when regenerating. Done
  // before insert so the "exactly one active plan" expectation holds even if
  // the insert below briefly overlaps.
  if (archivePrevious) {
    const { error: archiveError } = await supabase
      .from("workout_plans")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("client_id", clientId)
      .eq("status", "active")
    if (archiveError) {
      throw new Error(`Failed to archive previous plan: ${archiveError.message}`)
    }
  }

  // Insert the plan row. The validated plan is preserved verbatim in
  // source_payload so later batches (regeneration, audit) can inspect exactly
  // what was generated.
  const { data: planRow, error: planError } = await supabase
    .from("workout_plans")
    .insert({
      client_id: clientId,
      title: plan.title,
      status: "active",
      locale: localeTag,
      source,
      source_payload: plan,
    })
    .select("*")
    .single()

  if (planError || !planRow) {
    throw new Error(
      `Failed to save workout plan: ${planError?.message ?? "no row returned"}`
    )
  }

  const saved = planRow as WorkoutPlanRow

  try {
    let exerciseCount = 0

    // Insert workouts in plan order, then each session's exercises in order.
    // `position` is set explicitly from array index so ordering survives reads.
    for (let wi = 0; wi < plan.workouts.length; wi++) {
      const workout = plan.workouts[wi]
      const { data: workoutRow, error: workoutError } = await supabase
        .from("workouts")
        .insert({
          plan_id: saved.id,
          day_of_week: workout.day_of_week,
          title: workout.title,
          focus: workout.focus,
          notes: workout.notes,
          position: wi,
        })
        .select("id")
        .single()

      if (workoutError || !workoutRow) {
        throw new Error(
          `Failed to save workout ${wi}: ${
            workoutError?.message ?? "no row returned"
          }`
        )
      }

      const workoutId = (workoutRow as { id: string }).id
      const exerciseRows = workout.exercises.map((exercise, ei) => ({
        workout_id: workoutId,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        duration: exercise.duration,
        rest: exercise.rest,
        instructions: exercise.instructions,
        safety_notes: exercise.safety_notes,
        position: ei,
      }))

      const { error: exercisesError } = await supabase
        .from("exercises")
        .insert(exerciseRows)
      if (exercisesError) {
        throw new Error(
          `Failed to save exercises for workout ${wi}: ${exercisesError.message}`
        )
      }
      exerciseCount += exerciseRows.length
    }

    return { plan: saved, workoutCount: plan.workouts.length, exerciseCount }
  } catch (error) {
    // Roll back the partial write: deleting the plan cascades to workouts and
    // exercises, so nothing half-written remains. A cleanup failure is logged
    // but the original error is what the caller must see.
    const { error: cleanupError } = await supabase
      .from("workout_plans")
      .delete()
      .eq("id", saved.id)
    if (cleanupError) {
      console.error(
        `Failed to clean up partial plan ${saved.id}: ${cleanupError.message}`
      )
    }
    throw error instanceof Error ? error : new Error(String(error))
  }
}

/** Inputs for recording a plan-generation audit event. */
export interface RecordGenerationEventInput {
  /** The owning client's auth user id. */
  clientId: string
  /** The user who triggered generation (the client themselves at onboarding). */
  triggeredBy: string | null
  /** Why generation fired. */
  source: GenerationSource
  /** Outcome of the attempt. */
  status: GenerationStatus
  /** The resulting plan id on success; null on failure. */
  planId?: string | null
  /** Optional free-text reason (used by regeneration in a later batch). */
  reason?: string | null
}

/**
 * Records a `plan_generation_events` audit row for both successful and failed
 * generations, preserving the generation history the trainer dashboard and
 * regeneration flow rely on. Failures here are swallowed (logged, not thrown):
 * a missing audit row must never mask a successfully saved plan or turn a
 * handled generation failure into a crash.
 *
 * @param input - Client, trigger, source, status, and resulting plan id.
 */
export async function recordGenerationEvent(
  input: RecordGenerationEventInput
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("plan_generation_events").insert({
    client_id: input.clientId,
    plan_id: input.planId ?? null,
    triggered_by: input.triggeredBy,
    source: input.source,
    status: input.status,
    reason: input.reason ?? null,
  })
  if (error) {
    console.error(`Failed to record generation event: ${error.message}`)
  }
}
