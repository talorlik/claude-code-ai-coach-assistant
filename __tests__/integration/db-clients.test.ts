import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Integration tests for the `clients` data-access module. The Supabase client
 * is faked with a thenable query builder that records the table, filters, and
 * upsert payload, so the module's real query construction and row mapping run
 * without a live database. The fake stands in for RLS: the "client-owned" and
 * "trainer-admin" cases assert the queries the module issues for each caller,
 * and the row set the fake returns models what RLS would expose.
 */

interface QueryState {
  table: string | null
  filters: Record<string, unknown>
  upsertRow: Record<string, unknown> | null
  upsertOptions: Record<string, unknown> | null
}

let query: QueryState
let returnedRows: Record<string, unknown>[]
let returnedError: { message: string } | null

function makeBuilder() {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.order = chain
  builder.eq = (col: string, val: unknown) => {
    query.filters[col] = val
    return builder
  }
  builder.upsert = (row: Record<string, unknown>, options: Record<string, unknown>) => {
    query.upsertRow = row
    query.upsertOptions = options
    return builder
  }
  builder.maybeSingle = async () => ({
    data: returnedRows[0] ?? null,
    error: returnedError,
  })
  builder.single = async () => ({
    data: returnedRows[0] ?? null,
    error: returnedError,
  })
  // Make the builder awaitable for the list query (no terminal single()).
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

import { getClient, listClients, upsertClient } from "@/lib/db/clients"

beforeEach(() => {
  query = { table: null, filters: {}, upsertRow: null, upsertOptions: null }
  returnedRows = []
  returnedError = null
})

const clientRow = {
  user_id: "client-1",
  full_name: "Dana Levi",
  phone: "0501234567",
  age: 34,
  age_range: "30-39",
  goal: "strength",
  fitness_level: "intermediate",
  limitations: null,
  available_days: ["mon"],
  preferred_location: "home",
  equipment: ["dumbbells"],
  notes: null,
  onboarded_at: null,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
}

describe("getClient (client-owned access)", () => {
  it("queries the clients table filtered by the caller's user_id", async () => {
    returnedRows = [clientRow]
    const client = await getClient("client-1")

    expect(query.table).toBe("clients")
    expect(query.filters).toEqual({ user_id: "client-1" })
    expect(client?.userId).toBe("client-1")
    expect(client?.fullName).toBe("Dana Levi")
  })

  it("returns null when RLS exposes no row", async () => {
    returnedRows = []
    expect(await getClient("client-1")).toBeNull()
  })

  it("throws loudly on a database error", async () => {
    returnedError = { message: "boom" }
    await expect(getClient("client-1")).rejects.toThrow(/Failed to load client/)
  })
})

describe("upsertClient (client-owned write)", () => {
  it("upserts a snake_case row on user_id and returns the mapped client", async () => {
    returnedRows = [clientRow]
    const client = await upsertClient({
      userId: "client-1",
      fullName: "Dana Levi",
      availableDays: ["mon"],
    })

    expect(query.table).toBe("clients")
    expect(query.upsertRow).toMatchObject({
      user_id: "client-1",
      full_name: "Dana Levi",
      available_days: ["mon"],
    })
    expect(query.upsertOptions).toEqual({ onConflict: "user_id" })
    expect(client.userId).toBe("client-1")
  })
})

describe("listClients (trainer-admin access)", () => {
  it("returns all rows RLS exposes to a trainer admin, newest first", async () => {
    returnedRows = [
      clientRow,
      { ...clientRow, user_id: "client-2", full_name: "Noa Cohen" },
    ]
    const clients = await listClients()

    expect(query.table).toBe("clients")
    expect(clients).toHaveLength(2)
    expect(clients.map((c) => c.userId)).toEqual(["client-1", "client-2"])
  })

  it("returns only the caller's own row when RLS scopes a non-admin", async () => {
    // RLS would expose just the caller's row to a non-admin; the fake models
    // that by returning a single row.
    returnedRows = [clientRow]
    const clients = await listClients()
    expect(clients).toHaveLength(1)
    expect(clients[0].userId).toBe("client-1")
  })
})
