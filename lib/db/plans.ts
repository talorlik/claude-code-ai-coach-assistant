import { createClient } from "@/lib/supabase/server"
import type { WorkoutPlanRow } from "@/lib/db/types"

/**
 * Server-only data access for workout plans. Request-scoped Supabase client, so
 * RLS scopes reads/writes to the owning client or the trainer admin. Workout
 * and exercise persistence is added by the AI-generation batch (08); this
 * module provides the plan-level reads the plan view and regeneration depend
 * on.
 */

/**
 * Loads a client's single active plan, or `null` if they have none. Relies on
 * the partial index `workout_plans_active_idx`. Throws on a database error.
 */
export async function getActivePlan(
  clientId: string
): Promise<WorkoutPlanRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle()

  if (error) throw new Error(`Failed to load active plan: ${error.message}`)
  return (data as WorkoutPlanRow | null) ?? null
}

/**
 * Lists every plan for a client, newest first, including archived ones.
 * Regeneration preserves history by archiving rather than deleting, so this
 * surfaces the full timeline. Throws on a database error.
 */
export async function listPlans(clientId: string): Promise<WorkoutPlanRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`Failed to list plans: ${error.message}`)
  return data as WorkoutPlanRow[]
}
