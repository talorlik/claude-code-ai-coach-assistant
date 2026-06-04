import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the trainer-notes data access. A fake Supabase client
 * models the `trainer_notes` table behind its RLS policy
 * ("Trainer admin manages notes" - trainer-admin only). The fake records the
 * operation issued (select/insert/update/delete) and the filters applied, and
 * returns canned rows scoped the way RLS would scope them:
 *
 * - Trainer admin: reads/writes succeed and rows are returned.
 * - Non-admin client: RLS exposes no rows, so a list returns `[]`. This is the
 *   "client cannot read trainer notes" case at the data layer; the page guard
 *   (`requireTrainerAdmin`) is the primary block and RLS is the backstop.
 */

interface Op {
  type: "select" | "insert" | "update" | "delete"
  filters: Record<string, string>
  payload?: Record<string, unknown>
}

let rows: Record<string, unknown>[]
let rlsHidesRows: boolean
let lastOp: Op | null
let forcedError: { message: string } | null

function makeBuilder() {
  const op: Op = { type: "select", filters: {} }
  lastOp = op
  const builder: Record<string, unknown> = {}
  const visible = () => (rlsHidesRows ? [] : rows)

  builder.select = () => builder
  builder.eq = (col: string, val: string) => {
    op.filters[col] = val
    return builder
  }
  builder.order = () => builder
  builder.insert = (payload: Record<string, unknown>) => {
    op.type = "insert"
    op.payload = payload
    return builder
  }
  builder.update = (payload: Record<string, unknown>) => {
    op.type = "update"
    op.payload = payload
    return builder
  }
  builder.delete = () => {
    op.type = "delete"
    return builder
  }
  builder.single = async () => ({
    data: forcedError ? null : (visible()[0] ?? null),
    error: forcedError,
  })
  // For list reads the builder is awaited directly (thenable).
  builder.then = (
    resolve: (value: { data: unknown; error: unknown }) => unknown
  ) => resolve({ data: forcedError ? null : visible(), error: forcedError })
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from() {
      return makeBuilder()
    },
  }),
}))

import {
  listTrainerNotes,
  createTrainerNote,
  updateTrainerNote,
  deleteTrainerNote,
} from "@/lib/db/trainer-notes"

function noteRow(id: string, body: string) {
  return {
    id,
    client_id: "client-1",
    author_id: "admin-1",
    body,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
  }
}

beforeEach(() => {
  rows = []
  rlsHidesRows = false
  lastOp = null
  forcedError = null
})

describe("listTrainerNotes (trainer-admin access)", () => {
  it("returns the client's notes filtered by client_id", async () => {
    rows = [noteRow("n1", "First note"), noteRow("n2", "Second note")]
    const result = await listTrainerNotes("client-1")
    expect(result).toHaveLength(2)
    expect(lastOp?.type).toBe("select")
    expect(lastOp?.filters.client_id).toBe("client-1")
  })

  it("throws loudly on a database error", async () => {
    forcedError = { message: "boom" }
    await expect(listTrainerNotes("client-1")).rejects.toThrow(
      /Failed to load trainer notes/
    )
  })
})

describe("listTrainerNotes (client cannot read)", () => {
  it("returns an empty list when RLS hides the trainer notes from a non-admin", async () => {
    rows = [noteRow("n1", "Secret")]
    rlsHidesRows = true // RLS denies a non-admin any rows.
    const result = await listTrainerNotes("client-1")
    expect(result).toEqual([])
  })
})

describe("createTrainerNote", () => {
  it("inserts a note with the client, author, and validated body", async () => {
    rows = [noteRow("n1", "Focus on form")]
    const result = await createTrainerNote("client-1", "admin-1", "Focus on form")
    expect(result.body).toBe("Focus on form")
    expect(lastOp?.type).toBe("insert")
    expect(lastOp?.payload).toMatchObject({
      client_id: "client-1",
      author_id: "admin-1",
      body: "Focus on form",
    })
  })

  it("rejects an empty body before hitting the database", async () => {
    await expect(
      createTrainerNote("client-1", "admin-1", "   ")
    ).rejects.toThrow(/empty/)
  })
})

describe("updateTrainerNote", () => {
  it("updates the note body filtered by note id", async () => {
    rows = [noteRow("n1", "Updated body")]
    const result = await updateTrainerNote("n1", "Updated body")
    expect(result.body).toBe("Updated body")
    expect(lastOp?.type).toBe("update")
    expect(lastOp?.filters.id).toBe("n1")
    expect(lastOp?.payload).toMatchObject({ body: "Updated body" })
  })
})

describe("deleteTrainerNote", () => {
  it("issues a delete filtered by note id", async () => {
    rows = [noteRow("n1", "x")]
    await deleteTrainerNote("n1")
    expect(lastOp?.type).toBe("delete")
    expect(lastOp?.filters.id).toBe("n1")
  })

  it("throws loudly on a database error", async () => {
    forcedError = { message: "boom" }
    await expect(deleteTrainerNote("n1")).rejects.toThrow(
      /Failed to delete trainer note/
    )
  })
})
