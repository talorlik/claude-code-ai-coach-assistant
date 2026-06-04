import { createClient } from "@/lib/supabase/server"
import { fromClientRow, type Client } from "@/lib/db/mappers"
import type {
  ClientRow,
  WorkoutLogRow,
  WorkoutPlanRow,
  WorkoutRow,
} from "@/lib/db/types"
import {
  completionPercentage,
  currentMonthPeriod,
  logsInPeriod,
} from "@/lib/progress/progress"

/**
 * Server-only data access for the trainer-admin client overview. Every read
 * goes through the request-scoped Supabase client, so RLS applies: only the
 * trainer admin's session sees other clients' rows (a non-admin sees just their
 * own). The secret/admin client is never used here, so an accidental call from
 * a non-admin context returns just that caller's data rather than leaking.
 */

/** A client row augmented with their active-plan and current-month engagement. */
export interface ClientWithActivity {
  /** The client's onboarding profile. */
  client: Client
  /** Whether the client has an active workout plan. */
  hasActivePlan: boolean
  /** The active plan's title, or `null` when there is no active plan. */
  activePlanTitle: string | null
  /**
   * Share of the active plan's workouts completed in the current calendar
   * month, as an integer 0-100. `0` when there is no active plan or no plan
   * workouts; this also drives the activity indicator.
   */
  monthCompletionPercent: number
}

/**
 * Loads every client visible to the caller together with their active-plan
 * status and current-month completion percentage, newest-updated first. Built
 * for the trainer-admin landing page.
 *
 * The reads are issued as a small number of set-based queries rather than one
 * query per client, so the page scales to many clients without an N+1: one
 * query each for clients, their active plans, those plans' workouts, and this
 * month's completion logs. Each stays under its own RLS policy. Completion is
 * computed in memory from the fetched rows via the pure progress helpers, so
 * the threshold logic has a single tested definition.
 *
 * @param reference - The instant defining "this month" (typically now);
 *   injectable so tests are deterministic.
 * @returns Clients with their activity summary, ordered by most recently
 *   updated.
 */
export async function listClientsWithActivity(
  reference: Date = new Date()
): Promise<ClientWithActivity[]> {
  const supabase = await createClient()

  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .order("updated_at", { ascending: false })

  if (clientError) {
    throw new Error(`Failed to list clients: ${clientError.message}`)
  }

  const clients = ((clientData as ClientRow[]) ?? []).map(fromClientRow)
  if (clients.length === 0) return []

  const clientIds = clients.map((c) => c.userId)

  // Active plans for the listed clients (at most one per client).
  const { data: planData, error: planError } = await supabase
    .from("workout_plans")
    .select("id, client_id, title")
    .in("client_id", clientIds)
    .eq("status", "active")

  if (planError) {
    throw new Error(`Failed to load active plans: ${planError.message}`)
  }

  const activePlans = (planData as Pick<
    WorkoutPlanRow,
    "id" | "client_id" | "title"
  >[]) ?? []
  const planByClient = new Map(activePlans.map((p) => [p.client_id, p]))
  const planIds = activePlans.map((p) => p.id)

  // Workout ids per active plan, to count plan size and map logs back to a plan.
  const workoutsByPlan = new Map<string, string[]>()
  const planByWorkout = new Map<string, string>()
  if (planIds.length > 0) {
    const { data: workoutData, error: workoutError } = await supabase
      .from("workouts")
      .select("id, plan_id")
      .in("plan_id", planIds)

    if (workoutError) {
      throw new Error(`Failed to load workouts: ${workoutError.message}`)
    }

    for (const w of (workoutData as Pick<WorkoutRow, "id" | "plan_id">[]) ??
      []) {
      const list = workoutsByPlan.get(w.plan_id) ?? []
      list.push(w.id)
      workoutsByPlan.set(w.plan_id, list)
      planByWorkout.set(w.id, w.plan_id)
    }
  }

  // This month's completion logs for the listed clients. Scoping the date range
  // in SQL keeps the payload small; the precise month boundary is re-applied in
  // memory via logsInPeriod so the same tested logic governs both.
  const period = currentMonthPeriod(reference)
  const logsByPlan = new Map<string, WorkoutLogRow[]>()
  if (planByWorkout.size > 0) {
    const { data: logData, error: logError } = await supabase
      .from("workout_logs")
      .select("workout_id, completed_at")
      .in("client_id", clientIds)
      .gte("completed_at", `${period.start}T00:00:00.000Z`)
      .lte("completed_at", `${period.end}T23:59:59.999Z`)

    if (logError) {
      throw new Error(`Failed to load workout logs: ${logError.message}`)
    }

    const monthLogs = logsInPeriod(
      (logData as Pick<WorkoutLogRow, "workout_id" | "completed_at">[]) ?? [],
      period
    )
    for (const log of monthLogs) {
      const planId = planByWorkout.get(log.workout_id)
      if (!planId) continue
      const list = logsByPlan.get(planId) ?? []
      list.push(log as WorkoutLogRow)
      logsByPlan.set(planId, list)
    }
  }

  return clients.map((client) => {
    const plan = planByClient.get(client.userId) ?? null
    if (!plan) {
      return {
        client,
        hasActivePlan: false,
        activePlanTitle: null,
        monthCompletionPercent: 0,
      }
    }

    const workoutIds = workoutsByPlan.get(plan.id) ?? []
    const completedIds = (logsByPlan.get(plan.id) ?? []).map(
      (log) => log.workout_id
    )

    return {
      client,
      hasActivePlan: true,
      activePlanTitle: plan.title,
      monthCompletionPercent: completionPercentage(
        workoutIds.length,
        completedIds
      ),
    }
  })
}
