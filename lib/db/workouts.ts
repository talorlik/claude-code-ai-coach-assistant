import { createClient } from "@/lib/supabase/server"
import type {
  ExerciseRow,
  WorkoutLogRow,
  WorkoutPlanRow,
  WorkoutRow,
} from "@/lib/db/types"

/**
 * Server-only data access for a client's active plan, its sessions, and their
 * completion logs. Uses the request-scoped Supabase client, so RLS scopes every
 * read to the owning client (or the trainer admin). Ordering is normalised here
 * so callers receive workouts and exercises already in their stored `position`
 * order; the plan view does not have to re-sort.
 */

/** A workout session with its ordered exercises, ready to render. */
export interface WorkoutWithExercises extends WorkoutRow {
  /** Exercises in `position` order. */
  exercises: ExerciseRow[]
}

/** A client's active plan with its sessions, exercises, and completion logs. */
export interface ActivePlanDetail {
  /** The active plan row. */
  plan: WorkoutPlanRow
  /** Sessions in `position` order, each with ordered exercises. */
  workouts: WorkoutWithExercises[]
  /** All completion logs for this plan's workouts, for progress and badges. */
  logs: WorkoutLogRow[]
}

/**
 * Loads a client's single active plan together with its workouts (ordered),
 * each workout's exercises (ordered), and every completion log for those
 * workouts. Returns `null` when the client has no active plan, which the page
 * renders as the empty state.
 *
 * The reads are issued as a small number of queries (plan, workouts,
 * exercises-by-workout, logs-by-workout) rather than one deep join so each table
 * stays under its own RLS policy and the shapes map cleanly to the typed rows.
 * Throws a descriptive `Error` on any database failure.
 *
 * @param clientId - The owning client's auth user id.
 * @returns The active plan detail, or `null` if no active plan exists.
 */
export async function getActivePlanDetail(
  clientId: string
): Promise<ActivePlanDetail | null> {
  const supabase = await createClient()

  const { data: planData, error: planError } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle()

  if (planError) {
    throw new Error(`Failed to load active plan: ${planError.message}`)
  }
  if (!planData) return null

  const plan = planData as WorkoutPlanRow

  const { data: workoutData, error: workoutError } = await supabase
    .from("workouts")
    .select("*")
    .eq("plan_id", plan.id)
    .order("position", { ascending: true })

  if (workoutError) {
    throw new Error(`Failed to load workouts: ${workoutError.message}`)
  }

  const workoutRows = (workoutData as WorkoutRow[]) ?? []
  const workoutIds = workoutRows.map((w) => w.id)

  // No sessions: return an empty-but-valid detail so the page can still show the
  // plan header and an "empty plan" hint without extra round-trips.
  if (workoutIds.length === 0) {
    return { plan, workouts: [], logs: [] }
  }

  const { data: exerciseData, error: exerciseError } = await supabase
    .from("exercises")
    .select("*")
    .in("workout_id", workoutIds)
    .order("position", { ascending: true })

  if (exerciseError) {
    throw new Error(`Failed to load exercises: ${exerciseError.message}`)
  }

  const { data: logData, error: logError } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("client_id", clientId)
    .in("workout_id", workoutIds)

  if (logError) {
    throw new Error(`Failed to load workout logs: ${logError.message}`)
  }

  const exercisesByWorkout = new Map<string, ExerciseRow[]>()
  for (const exercise of (exerciseData as ExerciseRow[]) ?? []) {
    const list = exercisesByWorkout.get(exercise.workout_id) ?? []
    list.push(exercise)
    exercisesByWorkout.set(exercise.workout_id, list)
  }

  const workouts: WorkoutWithExercises[] = workoutRows.map((workout) => ({
    ...workout,
    exercises: exercisesByWorkout.get(workout.id) ?? [],
  }))

  return { plan, workouts, logs: (logData as WorkoutLogRow[]) ?? [] }
}

/**
 * Confirms that a workout belongs to a plan owned by the given client. The
 * completion server action calls this before inserting a log so a client cannot
 * log a completion against another client's workout id (RLS would also block
 * the insert, but this returns a clean validation error instead of a write
 * failure). Throws on a database error; returns `false` when no such workout is
 * visible to the caller.
 *
 * @param clientId - The owning client's auth user id.
 * @param workoutId - The workout the client is attempting to complete.
 * @returns `true` when the workout belongs to one of the client's plans.
 */
export async function clientOwnsWorkout(
  clientId: string,
  workoutId: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workouts")
    .select("id, workout_plans!inner(client_id)")
    .eq("id", workoutId)
    .eq("workout_plans.client_id", clientId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to verify workout ownership: ${error.message}`)
  }
  return data != null
}
