import { getClient } from "@/lib/db/clients"
import { getActivePlanDetail, type ActivePlanDetail } from "@/lib/db/workouts"
import { listChatMessages } from "@/lib/db/chat-messages"
import { listTrainerNotes } from "@/lib/db/trainer-notes"
import { listClientLogsSince } from "@/lib/db/workout-logs"
import {
  getClientPushStatus,
  type ClientPushStatus,
} from "@/lib/db/push-subscriptions"
import type { Client } from "@/lib/db/mappers"
import type {
  ChatMessageRow,
  TrainerNoteRow,
  WorkoutLogRow,
} from "@/lib/db/types"

/**
 * Server-only aggregate loader for the trainer client dashboard. Composes the
 * already-RLS-scoped, individually-tested data functions into the single bundle
 * the dashboard page renders, so the page itself stays declarative. Every
 * underlying read runs under the trainer-admin RLS policies; the page's
 * `requireTrainerAdmin` guard is the primary authorization check and RLS is the
 * database backstop.
 */

/** How far back the dashboard's progress charts and history reach, in days. */
export const DASHBOARD_HISTORY_DAYS = 180

/** Everything the trainer client dashboard renders for one client. */
export interface TrainerClientDetail {
  /** The client's onboarding profile, or `null` if not yet onboarded. */
  client: Client
  /** The client's active plan with workouts, exercises, and its logs, or `null`. */
  activePlan: ActivePlanDetail | null
  /** Recent completion logs (last {@link DASHBOARD_HISTORY_DAYS} days) for charts. */
  recentLogs: WorkoutLogRow[]
  /** The client's chat history with the AI trainer, oldest first. */
  chatMessages: ChatMessageRow[]
  /** Private trainer notes about the client, newest first. */
  notes: TrainerNoteRow[]
  /** The client's push-reminder readiness (enabled / disabled / unavailable). */
  pushStatus: ClientPushStatus
}

/**
 * Loads the full dashboard bundle for one client, or `null` when the client has
 * no onboarding profile (the page renders a "not found" state in that case).
 * The chart/history window is anchored to `reference` minus
 * {@link DASHBOARD_HISTORY_DAYS} days; `reference` is injectable for
 * deterministic tests. Throws if any underlying read fails, so the page can
 * render a single localized error state rather than a partial dashboard.
 *
 * @param clientId - The client's auth user id (the dashboard route segment).
 * @param reference - The "now" anchoring the history window; defaults to now.
 * @returns The dashboard detail, or `null` when the client does not exist.
 */
export async function getTrainerClientDetail(
  clientId: string,
  reference: Date = new Date()
): Promise<TrainerClientDetail | null> {
  const client = await getClient(clientId)
  if (!client) return null

  const since = new Date(reference)
  since.setUTCDate(since.getUTCDate() - DASHBOARD_HISTORY_DAYS)

  const [activePlan, recentLogs, chatMessages, notes, pushStatus] =
    await Promise.all([
      getActivePlanDetail(clientId),
      listClientLogsSince(clientId, since),
      listChatMessages(clientId),
      listTrainerNotes(clientId),
      getClientPushStatus(clientId),
    ])

  return { client, activePlan, recentLogs, chatMessages, notes, pushStatus }
}
