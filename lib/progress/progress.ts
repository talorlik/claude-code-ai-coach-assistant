import type { WorkoutLogRow } from "@/lib/db/types"

/**
 * Pure, dependency-free helpers for workout-plan progress and completion logic.
 * Kept free of any Supabase or request dependency so they are trivially
 * unit-testable and reusable from server actions, the plan page, and tests.
 *
 * "Completion" is per (workout, planned date): a client completes one session
 * on one calendar day, recorded as a `workout_logs` row. Progress is the share
 * of a plan's distinct workouts that have at least one completion log.
 */

/** Identifies a single completion: a workout on a specific planned date. */
export interface CompletionKey {
  /** The workout session id. */
  workoutId: string
  /**
   * The planned calendar date (`YYYY-MM-DD`) the session was completed for, or
   * `null` for an undated completion. `null` is treated as its own distinct key
   * so a dateless log never collides with a dated one.
   */
  plannedDate: string | null
}

/**
 * Computes the completion percentage of a plan: the share of its distinct
 * workouts that have at least one completion log, as an integer 0-100.
 *
 * Counting distinct *workouts* (not raw log rows) means logging the same
 * session twice on different dates does not push progress past 100, and a plan
 * with no workouts is defined as 0 rather than dividing by zero.
 *
 * @param totalWorkouts - Number of workout sessions in the plan.
 * @param completedWorkoutIds - Ids of workouts with at least one log. Duplicates
 *   are de-duplicated internally, so callers may pass a raw list.
 * @returns An integer percentage in the range 0-100.
 */
export function completionPercentage(
  totalWorkouts: number,
  completedWorkoutIds: readonly string[]
): number {
  if (totalWorkouts <= 0) return 0
  const distinctCompleted = new Set(completedWorkoutIds).size
  // A plan can report more completed ids than it has workouts only if stale ids
  // are passed; clamp so the bar never exceeds 100.
  const ratio = Math.min(distinctCompleted / totalWorkouts, 1)
  return Math.round(ratio * 100)
}

/**
 * Returns the set of distinct completed workout ids from a list of logs. A
 * workout counts as completed if it has any log, regardless of date. Used to
 * drive both the progress bar and per-workout "completed" badges.
 *
 * @param logs - The client's workout logs for the plan.
 * @returns A set of workout ids that have at least one log.
 */
export function completedWorkoutIds(
  logs: readonly Pick<WorkoutLogRow, "workout_id">[]
): Set<string> {
  return new Set(logs.map((log) => log.workout_id))
}

/**
 * Decides whether a new completion would duplicate an existing one. A duplicate
 * is a log with the same workout id AND the same planned date (including the
 * `null` "undated" case). This mirrors the database's
 * `unique (client_id, workout_id, planned_date)` constraint, letting the server
 * action reject duplicates with a friendly message before hitting the DB.
 *
 * @param existing - The client's existing logs (any subset is fine; typically
 *   the plan's logs).
 * @param candidate - The completion being attempted.
 * @returns `true` when an existing log already covers the candidate key.
 */
export function isDuplicateCompletion(
  existing: readonly Pick<WorkoutLogRow, "workout_id" | "planned_date">[],
  candidate: CompletionKey
): boolean {
  return existing.some(
    (log) =>
      log.workout_id === candidate.workoutId &&
      (log.planned_date ?? null) === candidate.plannedDate
  )
}

/**
 * Boundaries of an "activity period" (a rolling window ending today) used to
 * summarise recent training. Dates are `YYYY-MM-DD` strings so they compare
 * directly against `workout_logs.planned_date` without timezone drift.
 */
export interface ActivityPeriod {
  /** Inclusive start date, `YYYY-MM-DD`. */
  start: string
  /** Inclusive end date (the reference day), `YYYY-MM-DD`. */
  end: string
}

/**
 * Formats a `Date` as a `YYYY-MM-DD` calendar date in UTC. UTC is used so the
 * same instant yields the same string regardless of the server's local zone,
 * matching how a Postgres `date` column stores a bare calendar date.
 *
 * @param date - The date to format.
 * @returns The `YYYY-MM-DD` representation.
 */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Computes the inclusive activity period ending on `reference` and spanning
 * `days` calendar days (so `days = 7` yields a 7-day window: today plus the six
 * prior days). Used to scope "this week" / recent-activity summaries on the plan
 * page and, later, reminders.
 *
 * @param reference - The day the window ends on (typically "now").
 * @param days - Window length in days; values below 1 are treated as 1.
 * @returns The inclusive `{ start, end }` date-key boundaries.
 */
export function activityPeriod(reference: Date, days: number): ActivityPeriod {
  const span = Math.max(1, Math.floor(days))
  const end = toDateKey(reference)
  const startDate = new Date(reference)
  // Inclusive window: subtract span - 1 so a 7-day window covers 7 calendar
  // days including the reference day.
  startDate.setUTCDate(startDate.getUTCDate() - (span - 1))
  return { start: toDateKey(startDate), end }
}

/**
 * Computes the inclusive calendar-month window containing `reference`, as
 * `YYYY-MM-DD` date keys in UTC. Used by the trainer client list to scope
 * completion to "this month" so a client's recent engagement, not their
 * all-time history, drives the activity indicator.
 *
 * @param reference - Any instant within the target month (typically "now").
 * @returns The inclusive `{ start, end }` boundaries of that calendar month.
 */
export function currentMonthPeriod(reference: Date): ActivityPeriod {
  const year = reference.getUTCFullYear()
  const month = reference.getUTCMonth()
  const start = new Date(Date.UTC(year, month, 1))
  // Day 0 of the next month is the last day of this month.
  const end = new Date(Date.UTC(year, month + 1, 0))
  return { start: toDateKey(start), end: toDateKey(end) }
}

/**
 * Filters completion logs to those completed within an inclusive month window.
 * A log with no parseable timestamp is excluded. The comparison is on the log's
 * `completed_at` UTC date key, so a completion at any time on the final day of
 * the window still counts.
 *
 * Completion is scoped by *when the workout was completed* (`completed_at`), not
 * the `planned_date`, so logging a missed earlier session today still counts
 * toward this month's engagement.
 *
 * @param logs - Completion logs to filter.
 * @param period - The inclusive month window from {@link currentMonthPeriod}.
 * @returns The subset of logs completed within the window.
 */
export function logsInPeriod<T extends Pick<WorkoutLogRow, "completed_at">>(
  logs: readonly T[],
  period: ActivityPeriod
): T[] {
  return logs.filter((log) => {
    if (!log.completed_at) return false
    const key = toDateKey(new Date(log.completed_at))
    return key >= period.start && key <= period.end
  })
}
