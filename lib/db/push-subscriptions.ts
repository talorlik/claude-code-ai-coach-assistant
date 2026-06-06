import { createClient } from "@/lib/supabase/server"
import type { PushSubscriptionRow } from "@/lib/db/types"
import type { NormalizedPushSubscription } from "@/lib/push/validation"

/**
 * Server-only data access for the `push_subscriptions` table. Every call goes
 * through the request-scoped Supabase client, so the "Clients manage own push
 * subscriptions" RLS policy applies: a client can only read/write rows whose
 * `client_id` is their own auth id (the trainer admin has full access for firing
 * reminders). The secret/admin client is never used here, so an accidental call
 * from a wrong context returns no rows rather than leaking another client's
 * endpoints.
 */

/**
 * Saves (upserts) a browser push subscription for a client and returns the
 * persisted row. Conflicts on the unique `endpoint` are resolved by updating the
 * existing row and re-enabling it, so re-subscribing the same device is
 * idempotent rather than a duplicate-key error. RLS enforces that a client may
 * only write their own subscription.
 *
 * @param clientId - The owning client's auth user id.
 * @param subscription - The validated, normalized subscription fields.
 * @returns The persisted push subscription row.
 */
export async function savePushSubscription(
  clientId: string,
  subscription: NormalizedPushSubscription
): Promise<PushSubscriptionRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        client_id: clientId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        enabled: true,
      },
      { onConflict: "endpoint" }
    )
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to save push subscription: ${error?.message ?? "no row returned"}`
    )
  }
  return data as PushSubscriptionRow
}

/**
 * Disables a client's push subscription by endpoint. Soft-disables (sets
 * `enabled = false`) rather than deleting so the reminder trigger skips it while
 * a re-subscribe can re-enable the same row. RLS restricts the update to the
 * owning client. Throws loudly on a database error.
 *
 * @param clientId - The owning client's auth user id.
 * @param endpoint - The push endpoint to disable.
 */
export async function disablePushSubscription(
  clientId: string,
  endpoint: string
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ enabled: false })
    .eq("client_id", clientId)
    .eq("endpoint", endpoint)

  if (error) {
    throw new Error(`Failed to disable push subscription: ${error.message}`)
  }
}

/**
 * Lists a client's enabled push subscriptions (one per device). Returns an empty
 * array when the client has none or when RLS hides them from a non-owner caller.
 * Used by reminder delivery to fan a single reminder out to every active device.
 *
 * @param clientId - The owning client's auth user id.
 * @returns The client's enabled subscription rows.
 */
export async function listEnabledSubscriptions(
  clientId: string
): Promise<PushSubscriptionRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("client_id", clientId)
    .eq("enabled", true)

  if (error) {
    throw new Error(`Failed to load push subscriptions: ${error.message}`)
  }
  return (data as PushSubscriptionRow[]) ?? []
}

/**
 * The trainer-facing readiness of a client's workout reminders, derived from
 * their `push_subscriptions` rows:
 *
 * - `enabled` - at least one subscription exists and is enabled (reminders fire).
 * - `disabled` - subscriptions exist but every one is disabled (the client
 *   subscribed then turned reminders off; re-enabling re-activates a row).
 * - `unavailable` - no subscription rows at all (the client never opted in, or
 *   their browser does not support push).
 */
export type ClientPushStatus = "enabled" | "disabled" | "unavailable"

/**
 * Reports a client's push-reminder readiness for the trainer dashboard. Reads
 * ALL of the client's subscription rows (enabled and disabled) through the
 * request-scoped Supabase client, so the trainer-admin RLS grant on
 * `push_subscriptions` applies; a non-admin, non-owner caller sees no rows and
 * the status collapses to `unavailable`. Maps the rows to a single status:
 * `enabled` when any row is enabled, `disabled` when rows exist but none are
 * enabled, `unavailable` when there are none. Throws loudly on a database error
 * so the dashboard renders its error state rather than a misleading status.
 *
 * @param clientId - The client's auth user id.
 * @returns The client's reminder readiness as a {@link ClientPushStatus}.
 */
export async function getClientPushStatus(
  clientId: string
): Promise<ClientPushStatus> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("enabled")
    .eq("client_id", clientId)

  if (error) {
    throw new Error(`Failed to load push status: ${error.message}`)
  }

  const subscriptions = (data as Pick<PushSubscriptionRow, "enabled">[]) ?? []
  if (subscriptions.length === 0) return "unavailable"
  return subscriptions.some((row) => row.enabled) ? "enabled" : "disabled"
}

/**
 * Lists every enabled push subscription across all clients, for the reminder
 * trigger. RLS scopes this to the trainer admin (a client caller would see only
 * their own rows); the reminder route additionally guards with
 * `requireTrainerAdmin`. Returns an empty array when none exist.
 *
 * @returns All enabled subscription rows the caller is permitted to see.
 */
export async function listAllEnabledSubscriptions(): Promise<
  PushSubscriptionRow[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("enabled", true)

  if (error) {
    throw new Error(`Failed to load push subscriptions: ${error.message}`)
  }
  return (data as PushSubscriptionRow[]) ?? []
}
