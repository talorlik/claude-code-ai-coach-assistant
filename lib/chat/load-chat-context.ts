import { getClient } from "@/lib/db/clients"
import { getActivePlan } from "@/lib/db/plans"
import { listChatMessages } from "@/lib/db/chat-messages"
import { listLogsForWorkouts } from "@/lib/db/workout-logs"
import { getActivePlanDetail } from "@/lib/db/workouts"
import {
  RECENT_HISTORY_LIMIT,
  RECENT_LOGS_LIMIT,
  type ChatContext,
} from "@/lib/ai/chat-context"
import type { WorkoutLogRow } from "@/lib/db/types"

/**
 * Server-only assembly of the {@link ChatContext} the virtual-trainer prompt is
 * built from. Reads run through the request-scoped Supabase client, so RLS scopes
 * every query to the calling client (or the trainer admin). This is the seam
 * between the database and the pure {@link buildChatSystemPrompt} builder: it
 * gathers the client profile, active plan, recent completion logs, and recent
 * chat history, all of which the model needs to answer in context.
 *
 * Each read is independent and failure-isolated only at the call site; an
 * unexpected DB error propagates so the route can surface a clean, localizable
 * error rather than answering with a silently empty context.
 *
 * @param clientId - The authenticated client's auth user id.
 * @returns The assembled chat context for this client.
 */
export async function loadChatContext(
  clientId: string
): Promise<ChatContext> {
  const [client, activePlan, recentHistory] = await Promise.all([
    getClient(clientId),
    getActivePlan(clientId),
    listChatMessages(clientId, RECENT_HISTORY_LIMIT),
  ])

  const recentLogs = await loadRecentLogs(clientId)

  return { client, activePlan, recentLogs, recentHistory }
}

/**
 * Loads the client's most recent completion logs across their active plan's
 * workouts, newest first, capped to the context window. Returns an empty array
 * when the client has no active plan or no logged workouts; the empty case is a
 * normal state the prompt summarizes explicitly, not an error.
 */
async function loadRecentLogs(clientId: string): Promise<WorkoutLogRow[]> {
  const detail = await getActivePlanDetail(clientId)
  if (!detail || detail.workouts.length === 0) return []

  const workoutIds = detail.workouts.map((workout) => workout.id)
  const logs = await listLogsForWorkouts(clientId, workoutIds)

  // Newest first so the prompt's "most recent first" summary is accurate; the
  // builder still slices to RECENT_LOGS_LIMIT as a defensive cap.
  return logs
    .slice()
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at))
    .slice(0, RECENT_LOGS_LIMIT)
}
