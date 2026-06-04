import { convertToModelMessages, streamText, type UIMessage } from "ai"

import { createClient } from "@/lib/supabase/server"
import { insertChatMessage, listChatMessages } from "@/lib/db/chat-messages"
import { loadChatContext } from "@/lib/chat/load-chat-context"
import { buildChatSystemPrompt } from "@/lib/ai/chat-context"
import { localeTag, routing, type Locale } from "@/i18n/routing"

/**
 * Server-side route handler for the AI virtual-trainer chat. This is the real
 * trust boundary for the chat feature: it authenticates the caller, loads their
 * context, persists messages, and runs the model. The browser never holds an AI
 * key - the model call is routed through the Vercel AI Gateway here on the
 * server, exactly like plan generation.
 *
 * Per-turn contract:
 *
 * 1. Reject unauthenticated requests (the page guard is not sufficient; a route
 *    is an independently callable entry point).
 * 2. Persist the client's newest message before the model is called, so the
 *    conversation is durable even if generation fails midway.
 * 3. Build a locale-aware, safety-bound system prompt from the client's profile,
 *    active plan, and recent activity, and replay stored history as the model's
 *    conversation so the answer is grounded and consistent across turns.
 * 4. Stream the answer, and persist the assistant's reply on completion via
 *    `onFinish`. An empty/blank answer is never stored (the insert rejects it).
 */

/** Allow streaming responses up to 30 seconds, matching plan generation. */
export const maxDuration = 30

/** Model used for chat, routed through the AI Gateway by `provider/model`. */
export const CHAT_MODEL = "anthropic/claude-sonnet-4-6"

/** Request body shape: the UI message list plus the active locale prefix. */
interface ChatRequestBody {
  messages: UIMessage[]
  locale?: string
}

/** Extracts the concatenated, trimmed text of a UI message's text parts. */
function messageText(message: UIMessage | undefined): string {
  if (!message) return ""
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim()
}

/** Narrows an arbitrary string to a supported locale, defaulting to `en`. */
function resolveLocale(value: string | undefined): Locale {
  return (routing.locales as readonly string[]).includes(value ?? "")
    ? (value as Locale)
    : routing.defaultLocale
}

/**
 * Handles a chat turn. See the module doc for the full contract. Returns a
 * 401 JSON response for an unauthenticated caller, a 400 for an empty message,
 * and a streaming UI-message response otherwise.
 */
export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const body = (await req.json()) as ChatRequestBody
  const incoming = messageText(body.messages?.at(-1))
  if (incoming === "") {
    return new Response(JSON.stringify({ error: "emptyMessage" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  // Persist the user's message before calling the model so the turn is durable.
  await insertChatMessage(user.id, "user", incoming)

  const locale = resolveLocale(body.locale)
  const context = await loadChatContext(user.id)
  const system = buildChatSystemPrompt(context, localeTag(locale))

  // Replay stored history as the model conversation. The persisted history is
  // the source of truth (it includes the message just saved), so the model sees
  // a consistent transcript regardless of what the client posted.
  const history = await listChatMessages(user.id)
  const conversation: UIMessage[] = history.map((row) => ({
    id: row.id,
    role: row.role,
    parts: [{ type: "text", text: row.content }],
  }))

  const result = streamText({
    model: CHAT_MODEL,
    system,
    messages: await convertToModelMessages(conversation),
  })

  // Ensure the stream runs to completion (and onFinish fires) even if the client
  // disconnects mid-answer, so the assistant reply is still persisted.
  result.consumeStream()

  return result.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage }) => {
      const answer = messageText(responseMessage)
      if (answer === "") return // never persist an empty/partial answer
      try {
        await insertChatMessage(user.id, "assistant", answer)
      } catch (error) {
        // Persistence failure must not corrupt the streamed answer the client
        // already received; log and move on.
        console.error("Failed to persist assistant chat message", error)
      }
    },
  })
}
