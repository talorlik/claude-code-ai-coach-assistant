import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the trainer client-list data access. The Supabase
 * client is faked with a per-table thenable query builder that returns canned
 * rows, modelling what RLS would expose to each caller:
 *
 * - Trainer admin: `clients` returns every client, so the module aggregates all
 *   of them with their active plan and current-month completion.
 * - Non-admin client: `clients` returns only the caller's own row (RLS), so the
 *   module yields a single client. This is the "client cannot list others" case
 *   at the data layer: the page guard (`requireTrainerAdmin`) is the primary
 *   block, and RLS is the backstop modelled here.
 *
 * The completion maths is exercised through real workout and log rows so the
 * current-month scoping and percentage are covered end to end.
 */

interface TableData {
  clients: Record<string, unknown>[]
  workout_plans: Record<string, unknown>[]
  workouts: Record<string, unknown>[]
  workout_logs: Record<string, unknown>[]
}

let tables: TableData
let lastError: { message: string } | null
let erroringTable: keyof TableData | null

function makeBuilder(table: keyof TableData) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.order = chain
  builder.eq = chain
  builder.in = chain
  builder.gte = chain
  builder.lte = chain
  builder.then = (
    resolve: (value: { data: unknown; error: unknown }) => unknown
  ) =>
    resolve({
      data: tables[table],
      error: erroringTable === table ? lastError : null,
    })
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(table: keyof TableData) {
      return makeBuilder(table)
    },
  }),
}))

import { listClientsWithActivity } from "@/lib/db/trainer-clients"

const reference = new Date("2026-06-15T12:00:00.000Z")

function clientRow(id: string, name: string) {
  return {
    user_id: id,
    full_name: name,
    phone: null,
    age: null,
    age_range: null,
    goals: ["strength"],
    fitness_level: "intermediate",
    limitations: null,
    available_days: [],
    preferred_location: null,
    equipment: [],
    notes: null,
    onboarded_at: "2026-05-20T00:00:00.000Z",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
  }
}

beforeEach(() => {
  tables = { clients: [], workout_plans: [], workouts: [], workout_logs: [] }
  lastError = null
  erroringTable = null
})

describe("listClientsWithActivity (trainer-admin access)", () => {
  it("aggregates every client with active plan and current-month completion", async () => {
    tables.clients = [clientRow("c1", "Dana"), clientRow("c2", "Noa")]
    tables.workout_plans = [
      { id: "p1", client_id: "c1", title: "Strength A", status: "active" },
      // c2 has no active plan.
    ]
    tables.workouts = [
      { id: "w1", plan_id: "p1" },
      { id: "w2", plan_id: "p1" },
      { id: "w3", plan_id: "p1" },
      { id: "w4", plan_id: "p1" },
    ]
    // Two of four workouts completed this month -> 50%.
    tables.workout_logs = [
      { workout_id: "w1", completed_at: "2026-06-03T08:00:00.000Z" },
      { workout_id: "w2", completed_at: "2026-06-09T08:00:00.000Z" },
      // A log from last month must not count.
      { workout_id: "w3", completed_at: "2026-05-30T08:00:00.000Z" },
    ]

    const result = await listClientsWithActivity(reference)

    expect(result).toHaveLength(2)
    const c1 = result.find((r) => r.client.userId === "c1")!
    expect(c1.hasActivePlan).toBe(true)
    expect(c1.activePlanTitle).toBe("Strength A")
    expect(c1.monthCompletionPercent).toBe(50)

    const c2 = result.find((r) => r.client.userId === "c2")!
    expect(c2.hasActivePlan).toBe(false)
    expect(c2.activePlanTitle).toBeNull()
    expect(c2.monthCompletionPercent).toBe(0)
  })

  it("returns an empty list when there are no clients", async () => {
    tables.clients = []
    expect(await listClientsWithActivity(reference)).toEqual([])
  })

  it("throws loudly when the clients query fails", async () => {
    erroringTable = "clients"
    lastError = { message: "rls denied" }
    await expect(listClientsWithActivity(reference)).rejects.toThrow(
      /Failed to list clients/
    )
  })
})

describe("listClientsWithActivity (non-admin RLS scope)", () => {
  it("yields only the caller's own row when RLS hides other clients", async () => {
    // RLS exposes just the caller's client row to a non-admin.
    tables.clients = [clientRow("self", "Self")]
    tables.workout_plans = []
    tables.workouts = []
    tables.workout_logs = []

    const result = await listClientsWithActivity(reference)
    expect(result).toHaveLength(1)
    expect(result[0].client.userId).toBe("self")
    expect(result[0].hasActivePlan).toBe(false)
  })

  it("sets hasAnyPlan true for clients with only archived plans", async () => {
    tables.clients = [clientRow("c-archived", "Archie")]
    tables.workout_plans = [
      {
        id: "p-archived",
        client_id: "c-archived",
        title: "Old plan",
        status: "archived",
      },
    ]
    tables.workouts = []
    tables.workout_logs = []

    const result = await listClientsWithActivity(reference)

    expect(result).toHaveLength(1)
    expect(result[0].hasActivePlan).toBe(false)
    expect(result[0].hasAnyPlan).toBe(true)
  })

  it("sets both flags true for a client with active and archived plans", async () => {
    tables.clients = [clientRow("c-both", "Bo")]
    tables.workout_plans = [
      { id: "p-active", client_id: "c-both", title: "Current", status: "active" },
      { id: "p-old", client_id: "c-both", title: "Old", status: "archived" },
    ]
    tables.workouts = []
    tables.workout_logs = []

    const result = await listClientsWithActivity(reference)

    expect(result).toHaveLength(1)
    expect(result[0].hasActivePlan).toBe(true)
    expect(result[0].hasAnyPlan).toBe(true)
  })
})
