"use server"

import { revalidatePath } from "next/cache"

import { requireTrainerAdmin } from "@/lib/auth/require-user"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"

/**
 * Server actions backing the trainer client list's row actions. Each action is
 * an independently callable entry point, so it re-runs the authoritative
 * `requireTrainerAdmin` guard before any write (RLS is the database backstop).
 * Results are returned as `ActionResult` with localizable message keys rather
 * than thrown, so the client component can toast them; the guard itself still
 * throws (redirects) for unauthenticated/non-admin callers, which is the
 * intended hard stop.
 */

/** Revalidates the trainer client list for both locales after a change. */
function revalidateTrainerList(): void {
  // `localePrefix: "always"` puts the page under `/en` and `/he`; revalidate
  // both so a change is reflected if the trainer switches locale.
  revalidatePath("/en/trainer")
  revalidatePath("/he/trainer")
}

/**
 * Toggles a client's plan between active and archived from the trainer list.
 *
 * Deactivating archives the client's current active plan. Activating restores
 * their most-recently-archived plan (by `archived_at`), first archiving any
 * other active plan to keep a single active plan in the normal single-actor
 * (trainer-admin) path. The writes are non-transactional and the supporting DB
 * index is non-unique, so this is best-effort under the single admin actor, not
 * a hard concurrency guarantee. When the client has no plan to activate, the
 * action returns the localizable `plan.noPlanToActivate` code; the list normally
 * disables the toggle in that state, so this is a backstop rather than an
 * expected path.
 *
 * @param clientId - The client's user id (their `clients.user_id`).
 * @param active - The desired plan state: `true` to activate, `false` to archive.
 * @returns An `ActionResult` whose data is `{ hasActivePlan }` reflecting the new
 * state, or a localizable failure (`plan.updateError` / `plan.noPlanToActivate`).
 */
export async function setPlanActiveAction(
  clientId: string,
  active: boolean
): Promise<ActionResult<{ hasActivePlan: boolean }>> {
  await requireTrainerAdmin()

  const supabase = await createClient()

  try {
    if (!active) {
      const { error } = await supabase
        .from("workout_plans")
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("client_id", clientId)
        .eq("status", "active")
      // A zero-row match (the client has no active plan) is an intentional
      // successful no-op, not an error: the desired end state is already met.
      if (error) return fail("plan.updateError")
      revalidateTrainerList()
      return ok({ hasActivePlan: false })
    }

    // Activate: find the most-recently-archived plan for this client.
    const { data: candidate, error: findError } = await supabase
      .from("workout_plans")
      .select("id")
      .eq("client_id", clientId)
      .eq("status", "archived")
      .order("archived_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) return fail("plan.updateError")
    if (!candidate) return fail("plan.noPlanToActivate")

    // Archive any currently-active plan first to keep a single active plan.
    // These two writes (archive-active, then activate-candidate) are not in a
    // single transaction. A failure between them leaves the client with no active
    // plan; the caller surfaces plan.updateError and a retry recovers. Acceptable
    // for this single-actor trainer-admin action. See TECH_DEBT for the durable
    // (transactional RPC / partial-unique-index) fix.
    const { error: archiveError } = await supabase
      .from("workout_plans")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("client_id", clientId)
      .eq("status", "active")
    if (archiveError) return fail("plan.updateError")

    const { error: activateError } = await supabase
      .from("workout_plans")
      .update({ status: "active", archived_at: null })
      .eq("id", (candidate as { id: string }).id)
    if (activateError) return fail("plan.updateError")

    revalidateTrainerList()
    return ok({ hasActivePlan: true })
  } catch {
    return fail("plan.updateError")
  }
}

/**
 * Permanently deletes a client from the trainer list.
 *
 * Deletes the `clients` row via the admin client (bypassing RLS); the database
 * FK `on delete cascade` removes the client's plans, workouts, logs, and notes.
 * Then deletes the client's Supabase auth user so their email can re-register.
 * Data is deleted before the auth user: if the auth-user delete fails, the row
 * is already gone (the client is effectively removed), so the action returns the
 * localizable `delete.error` code to prompt the admin to retry the auth cleanup
 * rather than implying the client still exists.
 *
 * @param clientId - The client's user id (their `clients.user_id` and auth id).
 * @returns An `ActionResult` that is `ok(null)` on full success, or
 *   `fail("delete.error")` if the data or auth-user delete fails.
 */
export async function deleteClientAction(
  clientId: string
): Promise<ActionResult<null>> {
  await requireTrainerAdmin()

  const admin = await createAdminClient()

  try {
    const { error: dataError } = await admin
      .from("clients")
      .delete()
      .eq("user_id", clientId)
    if (dataError) {
      console.error("deleteClientAction: failed to delete client data", dataError)
      return fail("delete.error")
    }

    const { error: authError } = await admin.auth.admin.deleteUser(clientId)
    if (authError) {
      console.error("deleteClientAction: failed to delete auth user", authError)
      return fail("delete.error")
    }

    revalidateTrainerList()
    return ok(null)
  } catch {
    return fail("delete.error")
  }
}
