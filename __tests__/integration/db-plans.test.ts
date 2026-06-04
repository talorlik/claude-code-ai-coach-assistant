import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Integration tests for the workout-plans data-access module. Uses the same
 * faked thenable query builder as the clients tests: it records filters and the
 * row set the fake returns models what RLS would expose to the caller.
 */

interface QueryState {
  table: string | null
  filters: Record<string, unknown>
  order: { column: string; ascending: boolean } | null
}

let query: QueryState
let returnedRows: Record<string, unknown>[]
let returnedError: { message: string } | null

function makeBuilder() {
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = (col: string, val: unknown) => {
    query.filters[col] = val
    return builder
  }
  builder.order = (column: string, opts: { ascending: boolean }) => {
    query.order = { column, ascending: opts.ascending }
    return builder
  }
  builder.maybeSingle = async () => ({
    data: returnedRows[0] ?? null,
    error: returnedError,
  })
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

import { getActivePlan, listPlans } from "@/lib/db/plans"

beforeEach(() => {
  query = { table: null, filters: {}, order: null }
  returnedRows = []
  returnedError = null
})

const planRow = {
  id: "plan-1",
  client_id: "client-1",
  title: "Strength block",
  status: "active",
  locale: "en-US",
  source: "ai",
  source_payload: null,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
  archived_at: null,
}

describe("getActivePlan (client-owned access)", () => {
  it("filters by client_id and active status", async () => {
    returnedRows = [planRow]
    const plan = await getActivePlan("client-1")

    expect(query.table).toBe("workout_plans")
    expect(query.filters).toEqual({ client_id: "client-1", status: "active" })
    expect(plan?.id).toBe("plan-1")
  })

  it("returns null when the client has no active plan", async () => {
    returnedRows = []
    expect(await getActivePlan("client-1")).toBeNull()
  })

  it("throws on a database error", async () => {
    returnedError = { message: "boom" }
    await expect(getActivePlan("client-1")).rejects.toThrow(
      /Failed to load active plan/
    )
  })
})

describe("listPlans (history preserved)", () => {
  it("returns active and archived plans newest first", async () => {
    returnedRows = [
      planRow,
      { ...planRow, id: "plan-0", status: "archived", archived_at: "x" },
    ]
    const plans = await listPlans("client-1")

    expect(query.filters).toEqual({ client_id: "client-1" })
    expect(query.order).toEqual({ column: "created_at", ascending: false })
    expect(plans.map((p) => p.id)).toEqual(["plan-1", "plan-0"])
  })
})
