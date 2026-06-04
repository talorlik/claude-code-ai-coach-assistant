import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Integration tests for the AI virtual-trainer chat route. No network or AI
 * Gateway is touched: `ai`'s `streamText`/`convertToModelMessages`, the Supabase
 * auth client, the chat-message data access, and the context loader are all
 * mocked. The tests assert the per-turn contract:
 *
 * - unauthenticated requests are rejected with 401 and never write or call AI;
 * - the user's message is persisted before the model is called;
 * - the system prompt is built locale-aware from the loaded context;
 * - the assistant's answer is persisted on stream finish;
 * - a blank assistant answer is never persisted.
 */

// --- Auth seam ----------------------------------------------------------------
let currentUser: { id: string } | null

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser } }),
    },
  }),
}))

// --- Persistence seam ---------------------------------------------------------
const inserted: Array<{ clientId: string; role: string; content: string }> = []
let storedHistory: Array<{
  id: string
  client_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}>

vi.mock("@/lib/db/chat-messages", () => ({
  CHAT_HISTORY_LIMIT: 50,
  insertChatMessage: vi.fn(async (clientId: string, role: string, content: string) => {
    if (content.trim() === "") throw new Error("Refusing to store an empty chat message")
    inserted.push({ clientId, role, content })
    return { id: `new-${inserted.length}`, client_id: clientId, role, content, created_at: "2026-06-04T00:00:00.000Z" }
  }),
  listChatMessages: vi.fn(async () => storedHistory),
}))

// --- Context loader seam ------------------------------------------------------
vi.mock("@/lib/chat/load-chat-context", () => ({
  loadChatContext: vi.fn(async () => ({
    client: null,
    activePlan: null,
    recentLogs: [],
    recentHistory: [],
  })),
}))

// --- Prompt builder: real module, asserted via captured `system` --------------

// --- AI SDK seam --------------------------------------------------------------
let capturedStreamArgs: { model: string; system: string; messages: unknown } | null
let capturedOnFinish:
  | ((event: { responseMessage: unknown }) => Promise<void> | void)
  | null
let assistantAnswer: string

vi.mock("ai", () => ({
  convertToModelMessages: async (messages: unknown) => messages,
  streamText: (args: { model: string; system: string; messages: unknown }) => {
    capturedStreamArgs = args
    return {
      consumeStream: () => {},
      toUIMessageStreamResponse: (opts: {
        onFinish: (event: { responseMessage: unknown }) => Promise<void> | void
      }) => {
        capturedOnFinish = opts.onFinish
        return new Response("stream", { status: 200 })
      },
    }
  },
}))

import { POST } from "@/app/api/chat/route"

function uiMessage(text: string) {
  return { id: "u1", role: "user" as const, parts: [{ type: "text", text }] }
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

/** Drives the captured onFinish with a one-text-part assistant message. */
async function finishWith(text: string): Promise<void> {
  await capturedOnFinish?.({
    responseMessage: { id: "a1", role: "assistant", parts: [{ type: "text", text }] },
  })
}

beforeEach(() => {
  currentUser = { id: "client-1" }
  inserted.length = 0
  storedHistory = []
  capturedStreamArgs = null
  capturedOnFinish = null
  assistantAnswer = "Do 3 sets of squats. Stop if you feel knee pain."
})

describe("chat route - authentication", () => {
  it("rejects an unauthenticated request with 401 and writes nothing", async () => {
    currentUser = null
    const res = await POST(request({ messages: [uiMessage("hi")] }))
    expect(res.status).toBe(401)
    expect(inserted).toHaveLength(0)
    expect(capturedStreamArgs).toBeNull()
  })
})

describe("chat route - input validation", () => {
  it("rejects an empty message with 400 and never calls the model", async () => {
    const res = await POST(request({ messages: [uiMessage("   ")] }))
    expect(res.status).toBe(400)
    expect(capturedStreamArgs).toBeNull()
  })
})

describe("chat route - persistence and context", () => {
  it("saves the user message before calling the model", async () => {
    await POST(request({ messages: [uiMessage("How many sets?")], locale: "en" }))
    expect(inserted[0]).toEqual({
      clientId: "client-1",
      role: "user",
      content: "How many sets?",
    })
    expect(capturedStreamArgs).not.toBeNull()
  })

  it("builds a locale-aware, safety-bound system prompt from the loaded context", async () => {
    await POST(request({ messages: [uiMessage("Hi")], locale: "he" }))
    expect(capturedStreamArgs!.system).toMatch(/not a doctor/i)
    expect(capturedStreamArgs!.system).toContain("Answer in Hebrew")
  })

  it("defaults to English when the locale is missing or unsupported", async () => {
    await POST(request({ messages: [uiMessage("Hi")] }))
    expect(capturedStreamArgs!.system).toContain("Answer in English")
  })

  it("persists the assistant answer on stream finish", async () => {
    await POST(request({ messages: [uiMessage("Hi")], locale: "en" }))
    await finishWith(assistantAnswer)
    const assistant = inserted.find((m) => m.role === "assistant")
    expect(assistant?.content).toBe(assistantAnswer)
  })

  it("never persists a blank assistant answer", async () => {
    await POST(request({ messages: [uiMessage("Hi")], locale: "en" }))
    await finishWith("   ")
    expect(inserted.some((m) => m.role === "assistant")).toBe(false)
  })
})
