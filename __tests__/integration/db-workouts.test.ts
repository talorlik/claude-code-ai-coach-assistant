import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Integration tests for the active-plan data-access module. A faked thenable
 * query builder records the table and filters per call and returns a row set
 * keyed by table, modelling what RLS would expose to the owning client.
 */

interface Call {
  table: string
  filters: Record<string, unknown>
  inFilter: { column: string; values: unknown[] } | null
}

let calls: Call[]
let rowsByTable: Record<string, Record<string, unknown>[]>
let errorByTable: Record<string, { message: string } | undefined>

function makeBuilder(table: string) {
  const call: Call = { table, filters: {}, inFilter: null }
  calls.push(call)
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = (col: string, val: unknown) => {
    call.filters[col] = val
    return builder
  }
  builder.in = (col: string, vals: unknown[]) => {
    call.inFilter = { column: col, values: vals }
    return builder
  }
  builder.order = () => builder
  builder.maybeSingle = async () => ({
    data: rowsByTable[table]?.[0] ?? null,
    error: errorByTable[table] ?? null,
  })
  builder.then = (
    resolve: (value: { data: unknown; error: unknown }) => unknown
  ) =>
    resolve({
      data: rowsByTable[table] ?? [],
      error: errorByTable[table] ?? null,
    })
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => makeBuilder(table),
  }),
}))

import { getActivePlanDetail, clientOwnsWorkout } from "@/lib/db/workouts"

beforeEach(() => {
  calls = []
  rowsByTable = {}
  errorByTable = {}
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

describe("getActivePlanDetail", () => {
  it("returns null when the client has no active plan", async () => {
    rowsByTable = { workout_plans: [] }
    expect(await getActivePlanDetail("client-1")).toBeNull()
    // Should short-circuit before querying child tables.
    expect(calls.map((c) => c.table)).toEqual(["workout_plans"])
  })

  it("loads the plan with nested ordered workouts, exercises, and logs", async () => {
    rowsByTable = {
      workout_plans: [planRow],
      workouts: [
        { id: "w1", plan_id: "plan-1", day_of_week: "monday", title: "A", focus: "push", position: 0, notes: null },
        { id: "w2", plan_id: "plan-1", day_of_week: "wednesday", title: "B", focus: "pull", position: 1, notes: null },
      ],
      exercises: [
        { id: "e1", workout_id: "w1", name: "Bench", sets: 3, reps: "8", duration: null, rest: "90s", instructions: null, safety_notes: null, position: 0 },
        { id: "e2", workout_id: "w2", name: "Row", sets: 3, reps: "10", duration: null, rest: "60s", instructions: null, safety_notes: null, position: 0 },
      ],
      workout_logs: [
        { id: "l1", client_id: "client-1", workout_id: "w1", planned_date: "2026-06-02", completed_at: "x", difficulty: null, energy_level: null, notes: null, created_at: "x" },
      ],
    }

    const detail = await getActivePlanDetail("client-1")
    expect(detail).not.toBeNull()
    expect(detail!.plan.id).toBe("plan-1")
    expect(detail!.workouts.map((w) => w.id)).toEqual(["w1", "w2"])
    // Exercises are nested under their workout.
    expect(detail!.workouts[0].exercises.map((e) => e.id)).toEqual(["e1"])
    expect(detail!.workouts[1].exercises.map((e) => e.id)).toEqual(["e2"])
    expect(detail!.logs.map((l) => l.id)).toEqual(["l1"])

    // The plan query is scoped to the client and active status.
    const planCall = calls.find((c) => c.table === "workout_plans")!
    expect(planCall.filters).toEqual({ client_id: "client-1", status: "active" })
    // Children are fetched by the plan's workout ids.
    const exCall = calls.find((c) => c.table === "exercises")!
    expect(exCall.inFilter).toEqual({ column: "workout_id", values: ["w1", "w2"] })
  })

  it("returns an empty detail when the plan has no workouts", async () => {
    rowsByTable = { workout_plans: [planRow], workouts: [] }
    const detail = await getActivePlanDetail("client-1")
    expect(detail!.workouts).toEqual([])
    expect(detail!.logs).toEqual([])
    // No exercise/log queries when there are no workouts.
    expect(calls.some((c) => c.table === "exercises")).toBe(false)
  })

  it("throws a descriptive error on a plan load failure", async () => {
    errorByTable = { workout_plans: { message: "boom" } }
    await expect(getActivePlanDetail("client-1")).rejects.toThrow(
      /Failed to load active plan/
    )
  })
})

describe("clientOwnsWorkout", () => {
  it("returns true when a matching workout row is visible", async () => {
    rowsByTable = { workouts: [{ id: "w1" }] }
    expect(await clientOwnsWorkout("client-1", "w1")).toBe(true)
  })

  it("returns false when no matching workout is visible", async () => {
    rowsByTable = { workouts: [] }
    expect(await clientOwnsWorkout("client-1", "w1")).toBe(false)
  })

  it("throws on a database error", async () => {
    errorByTable = { workouts: { message: "nope" } }
    await expect(clientOwnsWorkout("client-1", "w1")).rejects.toThrow(
      /Failed to verify workout ownership/
    )
  })
})
