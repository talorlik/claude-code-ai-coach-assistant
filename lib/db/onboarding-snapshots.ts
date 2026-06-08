import { createClient } from "@/lib/supabase/server"
import {
  fromSnapshotRow,
  toSnapshotRow,
  type Client,
  type OnboardingSnapshot,
} from "@/lib/db/mappers"
import type { OnboardingSnapshotRow } from "@/lib/db/types"

/**
 * Server-only data access for `onboarding_snapshots`, the immutable history of
 * the onboarding details used to generate each plan. All calls go through the
 * request-scoped Supabase client, so RLS applies: a client reads/inserts only
 * their own snapshots; the trainer admin's session resolves the trainer-admin
 * policy and may read/insert for any client.
 */

/** Arguments for {@link recordOnboardingSnapshot}. */
export interface RecordOnboardingSnapshotInput {
  /** The client the plan was generated for. */
  client: Client
  /** The plan produced from these details. */
  planId: string
  /** The plan's output locale tag (e.g. `en-US`), stored for the history view. */
  localeTag: string | null
}

/**
 * Records one immutable snapshot of a client's onboarding details, FK'd to the
 * plan they produced. Called only in a generation's success branch, after the
 * plan id exists, so a failed generation never orphans a snapshot. Throws on a
 * database error so callers can decide whether the failure is fatal.
 *
 * @param input - The client, the produced plan id, and the locale tag.
 */
export async function recordOnboardingSnapshot(
  input: RecordOnboardingSnapshotInput
): Promise<void> {
  const supabase = await createClient()
  const row = toSnapshotRow({
    clientId: input.client.userId,
    planId: input.planId,
    client: input.client,
    locale: input.localeTag,
  })

  const { error } = await supabase.from("onboarding_snapshots").insert(row)
  if (error) {
    throw new Error(`Failed to record onboarding snapshot: ${error.message}`)
  }
}

/**
 * Lists a client's onboarding snapshots, newest first. RLS returns only the
 * caller's own rows unless the caller is the trainer admin. Throws on a
 * database error.
 *
 * @param clientId - The client (auth user id) whose history to load.
 */
export async function listOnboardingSnapshots(
  clientId: string
): Promise<OnboardingSnapshot[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("onboarding_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to list onboarding snapshots: ${error.message}`)
  }
  return (data as OnboardingSnapshotRow[]).map(fromSnapshotRow)
}
