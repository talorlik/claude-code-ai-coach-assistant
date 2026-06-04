import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration test for `listClientLogsSince`, the trainer-dashboard chart feed.
 * A fake Supabase client records the filters applied and returns canned rows the
 * way RLS would expose them to the trainer admin (all of the named client's
 * logs). The function scopes by `client_id` and a `completed_at` lower bound so
 * the charts only pull the window they render.
 */

let rows: Record<string, unknown>[]
let filters: Record<string, string>
let gteArg: string | null
let forcedError: { message: string } | null

function makeBuilder() {
  filters = {}
  gteArg = null
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = (col: string, val: string) => {
    filters[col] = val
    return builder
  }
  builder.gte = (_col: string, val: string) => {
    gteArg = val
    return builder
  }
  builder.order = () => builder
  builder.then = (
    resolve: (value: { data: unknown; error: unknown }) => unknown
  ) => resolve({ data: forcedError ? null : rows, error: forcedError })
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from() {
      return makeBuilder()
    },
  }),
}))

import { listClientLogsSince } from "@/lib/db/workout-logs"

beforeEach(() => {
  rows = []
  forcedError = null
})

describe("listClientLogsSince", () => {
  it("scopes by client_id and a completed_at lower bound", async () => {
    rows = [
      { workout_id: "w1", completed_at: "2026-06-10T08:00:00.000Z" },
      { workout_id: "w2", completed_at: "2026-06-12T08:00:00.000Z" },
    ]
    const since = new Date("2026-01-01T00:00:00.000Z")
    const result = await listClientLogsSince("client-1", since)

    expect(result).toHaveLength(2)
    expect(filters.client_id).toBe("client-1")
    expect(gteArg).toBe(since.toISOString())
  })

  it("throws loudly on a database error", async () => {
    forcedError = { message: "rls denied" }
    await expect(
      listClientLogsSince("client-1", new Date("2026-01-01T00:00:00.000Z"))
    ).rejects.toThrow(/Failed to load client logs/)
  })
})
