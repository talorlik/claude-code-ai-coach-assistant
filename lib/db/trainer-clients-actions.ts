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
 * other active plan to keep a single active plan. The archive-then-activate is
 * performed atomically by the `set_plan_active` Postgres RPC (migration 0007):
 * its body is one transaction, so a mid-sequence failure rolls back and cannot
 * strand the client with zero active plans, and the partial UNIQUE index on
 * `(client_id) where status = 'active'` makes the database reject any second
 * active plan, so concurrent activates cannot produce two active rows. When the
 * client has no plan to activate, the RPC raises `no_data_found`, surfaced as
 * the localizable `plan.noPlanToActivate` code; the list normally disables the
 * toggle in that state, so this is a backstop rather than an expected path.
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
    // One atomic round-trip: the RPC archives any active plan and (when
    // activating) restores the latest archived plan inside a single transaction.
    const { data, error } = await supabase.rpc("set_plan_active", {
      target_client: clientId,
      make_active: active,
    })

    if (error) {
      // The RPC raises no_data_found (P0002) when activating a client with no
      // archived plan to restore; map it to the dedicated code, everything else
      // to the generic update failure.
      if (error.code === "P0002") return fail("plan.noPlanToActivate")
      return fail("plan.updateError")
    }

    revalidateTrainerList()
    return ok({ hasActivePlan: data === true })
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
