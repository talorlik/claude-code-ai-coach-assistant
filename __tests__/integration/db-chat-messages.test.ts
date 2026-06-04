import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Integration tests for the `chat_messages` data-access module. The Supabase
 * client is faked with a thenable query builder that records the table, filters,
 * and insert payload, so the module's real query construction runs without a live
 * database. The fake stands in for RLS: the recorded `client_id` filter and the
 * row set returned model what a client-scoped policy would expose.
 */

interface QueryState {
  table: string | null
  filters: Record<string, unknown>
  insertRow: Record<string, unknown> | null
  order: { column: string; ascending: boolean } | null
  limit: number | null
}

let query: QueryState
let returnedRows: Record<string, unknown>[]
let returnedError: { message: string } | null

function makeBuilder() {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = (col: string, val: unknown) => {
    query.filters[col] = val
    return builder
  }
  builder.order = (column: string, opts: { ascending: boolean }) => {
    query.order = { column, ascending: opts.ascending }
    return builder
  }
  builder.limit = (n: number) => {
    query.limit = n
    return builder
  }
  builder.insert = (row: Record<string, unknown>) => {
    query.insertRow = row
    return builder
  }
  builder.single = async () => ({
    data: returnedRows[0] ?? null,
    error: returnedError,
  })
  // Awaitable for the list query (no terminal single()).
  builder.then = (
    resolve: (value: { data: unknown; error: unknown }) => unknown
  ) => resolve({ data: returnedRows, error: returnedError })
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(table: string) {
      query.table = table
      return makeBuilder()
    },
  }),
}))

import {
  insertChatMessage,
  listChatMessages,
  CHAT_HISTORY_LIMIT,
} from "@/lib/db/chat-messages"

beforeEach(() => {
  query = { table: null, filters: {}, insertRow: null, order: null, limit: null }
  returnedRows = []
  returnedError = null
})

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "msg-1",
  client_id: "client-1",
  role: "user",
  content: "How many sets today?",
  created_at: "2026-06-04T10:00:00.000Z",
  ...overrides,
})

describe("listChatMessages (client-owned read)", () => {
  it("queries chat_messages filtered by client_id, newest-first capped, returned chronological", async () => {
    // Fake returns newest-first (as the DB query would); module reverses it.
    returnedRows = [
      row({ id: "msg-2", created_at: "2026-06-04T10:05:00.000Z", content: "second" }),
      row({ id: "msg-1", created_at: "2026-06-04T10:00:00.000Z", content: "first" }),
    ]
    const messages = await listChatMessages("client-1")

    expect(query.table).toBe("chat_messages")
    expect(query.filters).toEqual({ client_id: "client-1" })
    expect(query.order).toEqual({ column: "created_at", ascending: false })
    expect(query.limit).toBe(CHAT_HISTORY_LIMIT)
    // Reversed to chronological (oldest first) for display/replay.
    expect(messages.map((m) => m.id)).toEqual(["msg-1", "msg-2"])
  })

  it("honors an explicit limit", async () => {
    returnedRows = []
    await listChatMessages("client-1", 10)
    expect(query.limit).toBe(10)
  })

  it("returns an empty array when RLS exposes no history", async () => {
    returnedRows = []
    expect(await listChatMessages("client-1")).toEqual([])
  })

  it("throws loudly on a database error", async () => {
    returnedError = { message: "boom" }
    await expect(listChatMessages("client-1")).rejects.toThrow(
      /Failed to load chat messages/
    )
  })
})

describe("insertChatMessage (client-owned write)", () => {
  it("inserts a trimmed row with client_id, role, and content", async () => {
    returnedRows = [row({ content: "trimmed" })]
    const saved = await insertChatMessage("client-1", "user", "  trimmed  ")

    expect(query.table).toBe("chat_messages")
    expect(query.insertRow).toEqual({
      client_id: "client-1",
      role: "user",
      content: "trimmed",
    })
    expect(saved.id).toBe("msg-1")
  })

  it("persists an assistant message", async () => {
    returnedRows = [row({ role: "assistant", content: "Do 3 sets." })]
    const saved = await insertChatMessage("client-1", "assistant", "Do 3 sets.")
    expect(query.insertRow).toMatchObject({ role: "assistant" })
    expect(saved.role).toBe("assistant")
  })

  it("refuses to store empty/whitespace content without touching the database", async () => {
    await expect(
      insertChatMessage("client-1", "assistant", "   ")
    ).rejects.toThrow(/empty chat message/)
    expect(query.table).toBeNull()
  })

  it("throws loudly on a database error", async () => {
    returnedError = { message: "constraint" }
    await expect(
      insertChatMessage("client-1", "user", "hi")
    ).rejects.toThrow(/Failed to save chat message/)
  })
})
