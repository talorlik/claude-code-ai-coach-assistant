import { createClient } from "@/lib/supabase/server"
import type { WorkoutLogRow } from "@/lib/db/types"

/**
 * Server-only data access for workout completion logs. Request-scoped Supabase
 * client, so RLS scopes reads/writes to the owning client (or the trainer
 * admin). The `unique (client_id, workout_id, planned_date)` constraint is the
 * ultimate guard against duplicate completions; this module also offers a
 * read-side check so the action can reject duplicates with a friendly message.
 */

/** Fields a client supplies when logging a completed workout. */
export interface WorkoutLogInput {
  /** The owning client's auth user id. */
  clientId: string
  /** The completed workout's id. */
  workoutId: string
  /** The planned calendar date (`YYYY-MM-DD`), or `null` if undated. */
  plannedDate: string | null
  /** Optional self-reported difficulty (e.g. "easy" | "ok" | "hard"). */
  difficulty: string | null
  /** Optional self-reported energy level (e.g. "low" | "medium" | "high"). */
  energyLevel: string | null
  /** Optional free-text notes. */
  notes: string | null
}

/**
 * Loads the completion logs the given client has recorded for a set of workout
 * ids. Used to detect duplicates and compute progress without re-reading the
 * whole plan. Returns an empty array when none match. Throws on a DB error.
 *
 * @param clientId - The owning client's auth user id.
 * @param workoutIds - Workout ids to fetch logs for; empty yields `[]`.
 * @returns The matching workout logs.
 */
export async function listLogsForWorkouts(
  clientId: string,
  workoutIds: readonly string[]
): Promise<WorkoutLogRow[]> {
  if (workoutIds.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("client_id", clientId)
    .in("workout_id", [...workoutIds])

  if (error) throw new Error(`Failed to load workout logs: ${error.message}`)
  return (data as WorkoutLogRow[]) ?? []
}

/**
 * Inserts a workout completion log and returns the new row. The database's
 * unique constraint rejects an exact duplicate (same client, workout, planned
 * date); callers should pre-check with {@link isDuplicateCompletion} for a
 * friendly message, but this surfaces the constraint error too so a race that
 * slips past the pre-check still cannot write a duplicate.
 *
 * @param input - The completion details.
 * @returns The inserted log row.
 */
export async function insertWorkoutLog(
  input: WorkoutLogInput
): Promise<WorkoutLogRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workout_logs")
    .insert({
      client_id: input.clientId,
      workout_id: input.workoutId,
      planned_date: input.plannedDate,
      difficulty: input.difficulty,
      energy_level: input.energyLevel,
      notes: input.notes,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to save workout log: ${error?.message ?? "no row returned"}`
    )
  }
  return data as WorkoutLogRow
}
