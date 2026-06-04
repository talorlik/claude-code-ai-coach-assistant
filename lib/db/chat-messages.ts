import { createClient } from "@/lib/supabase/server"
import type { ChatMessageRow, ChatRole } from "@/lib/db/types"

/**
 * Server-only data access for the `chat_messages` table. Every call goes through
 * the request-scoped Supabase client, so RLS applies: a client reads and writes
 * only their own messages, while the trainer admin's session resolves the
 * trainer-admin policy. The secret/admin client is never used here.
 */

/** How many recent messages the chat history load returns by default. */
export const CHAT_HISTORY_LIMIT = 50

/**
 * Loads a client's chat history in chronological order (oldest first), capped to
 * the most recent {@link CHAT_HISTORY_LIMIT} messages so a long history does not
 * bloat the page payload or the model context. The cap is applied to the newest
 * rows (descending fetch) and then re-ordered to chronological for display.
 *
 * Returns an empty array when the client has no history or RLS hides it. Throws
 * on an unexpected database error so callers fail loudly.
 *
 * @param clientId - The owning client's auth user id.
 * @param limit - Maximum messages to return; defaults to {@link CHAT_HISTORY_LIMIT}.
 * @returns The client's recent chat messages, oldest first.
 */
export async function listChatMessages(
  clientId: string,
  limit: number = CHAT_HISTORY_LIMIT
): Promise<ChatMessageRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to load chat messages: ${error.message}`)
  }

  // Fetched newest-first for the cap; reverse to chronological for display and
  // for replay into the model as conversation order.
  return ((data as ChatMessageRow[]) ?? []).slice().reverse()
}

/**
 * Inserts a single chat message and returns the persisted row. Used twice per
 * turn: once to record the client's message before the model is called, and
 * once to record the assistant's answer after it streams. Content is trimmed and
 * must be non-empty; an empty insert is rejected before hitting the database so
 * a partial/blank AI answer is never stored.
 *
 * RLS enforces that `client_id` matches the caller (or that the caller is the
 * trainer admin). Throws on a database error or empty content.
 *
 * @param clientId - The owning client's auth user id.
 * @param role - Who authored the message (`user` or `assistant`).
 * @param content - The message text; trimmed, must be non-empty.
 * @returns The inserted chat message row.
 */
export async function insertChatMessage(
  clientId: string,
  role: ChatRole,
  content: string
): Promise<ChatMessageRow> {
  const trimmed = content.trim()
  if (trimmed === "") {
    throw new Error("Refusing to store an empty chat message")
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ client_id: clientId, role, content: trimmed })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to save chat message: ${error?.message ?? "no row returned"}`
    )
  }
  return data as ChatMessageRow
}
