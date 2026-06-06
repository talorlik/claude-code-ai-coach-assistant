import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the live-plan WRITE data-access module. A faked thenable
 * query builder records the table, operation, payload, and filters per call and
 * returns row sets / counts keyed by table, modelling what RLS exposes to the
 * trainer admin. The destructive-path tests are the point: a workout WITH logs
 * must never be hard-deleted (the `ON DELETE CASCADE` would erase history), and
 * an exercise delete / workout-metadata update must not touch `workout_logs`.
 */

interface Call {
  table: string
  op: "select" | "insert" | "update" | "delete"
  payload?: Record<string, unknown>
  filters: Record<string, unknown>
  head?: boolean
}

let calls: Call[]
let rowsByTable: Record<string, Record<string, unknown>[]>
let countByTable: Record<string, number>
let errorByTable: Record<string, { message: string } | undefined>

function makeBuilder(table: string) {
  const call: Call = { table, op: "select", filters: {} }
  calls.push(call)
  const builder: Record<string, unknown> = {}
  builder.select = (_cols?: unknown, opts?: { head?: boolean }) => {
    if (opts?.head) call.head = true
    return builder
  }
  builder.insert = (payload: Record<string, unknown>) => {
    call.op = "insert"
    call.payload = payload
    return builder
  }
  builder.update = (payload: Record<string, unknown>) => {
    call.op = "update"
    call.payload = payload
    return builder
  }
  builder.delete = () => {
    call.op = "delete"
    return builder
  }
  builder.eq = (col: string, val: unknown) => {
    call.filters[col] = val
    return builder
  }
  builder.order = () => builder
  builder.maybeSingle = async () => ({
    data: rowsByTable[table]?.[0] ?? null,
    error: errorByTable[table] ?? null,
  })
  builder.single = async () => ({
    data: rowsByTable[table]?.[0] ?? null,
    error: errorByTable[table] ?? null,
  })
  // A head/count select resolves to a count; a delete/non-single op resolves to
  // the row set. The thenable supports both await styles the module uses.
  builder.then = (
    resolve: (value: {
      data: unknown
      error: unknown
      count?: number | null
    }) => unknown
  ) =>
    resolve({
      data: rowsByTable[table] ?? [],
      error: errorByTable[table] ?? null,
      count: countByTable[table] ?? 0,
    })
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => makeBuilder(table),
  }),
}))

import {
  addExercise,
  addWorkout,
  countWorkoutLogs,
  deleteExercise,
  deleteWorkout,
  updateExercise,
  updateWorkout,
} from "@/lib/db/plan-edits"

const exerciseRow = {
  id: "e1",
  workout_id: "w1",
  name: "Squat",
  sets: 3,
  reps: "8-12",
  duration: null,
  rest: "90s",
  instructions: null,
  safety_notes: null,
  position: 0,
  created_at: "x",
  updated_at: "x",
}

const workoutRow = {
  id: "w1",
  plan_id: "plan-1",
  day_of_week: "monday",
  title: "Day A",
  focus: "push",
  position: 0,
  notes: null,
  created_at: "x",
  updated_at: "x",
}

beforeEach(() => {
  calls = []
  rowsByTable = {}
  countByTable = {}
  errorByTable = {}
})

describe("updateExercise", () => {
  it("writes only the editable columns and returns the saved row", async () => {
    rowsByTable = { exercises: [{ ...exerciseRow, sets: 4 }] }
    const row = await updateExercise("e1", {
      name: "Squat",
      sets: 4,
      reps: "8-12",
      duration: null,
      rest: "90s",
      instructions: null,
      safety_notes: null,
    })

    expect(row.sets).toBe(4)
    const call = calls.find((c) => c.table === "exercises")!
    expect(call.op).toBe("update")
    expect(call.filters).toEqual({ id: "e1" })
    // Identity / parent columns are never part of the update payload.
    expect(call.payload).not.toHaveProperty("id")
    expect(call.payload).not.toHaveProperty("workout_id")
    expect(call.payload).toMatchObject({ name: "Squat", sets: 4 })
  })
})

describe("updateWorkout", () => {
  it("updates metadata only and never touches workout_logs", async () => {
    rowsByTable = { workouts: [{ ...workoutRow, title: "Renamed" }] }
    const row = await updateWorkout("w1", {
      title: "Renamed",
      focus: "pull",
      day_of_week: "tuesday",
      notes: "new note",
    })

    expect(row.title).toBe("Renamed")
    // The only table written is `workouts`; logs are untouched by a metadata edit.
    expect(calls.map((c) => c.table)).toEqual(["workouts"])
    expect(calls[0].op).toBe("update")
    expect(calls[0].payload).not.toHaveProperty("plan_id")
  })
})

describe("addExercise / addWorkout", () => {
  it("inserts an exercise under its workout with the given position", async () => {
    rowsByTable = { exercises: [{ ...exerciseRow, id: "e9" }] }
    const row = await addExercise("w1", {
      name: "Lunge",
      sets: 3,
      reps: "10",
      duration: null,
      rest: "60s",
      instructions: null,
      safety_notes: null,
      position: 2,
    })

    expect(row.id).toBe("e9")
    const call = calls.find((c) => c.table === "exercises")!
    expect(call.op).toBe("insert")
    expect(call.payload).toMatchObject({ workout_id: "w1", position: 2 })
  })

  it("inserts a workout under its plan", async () => {
    rowsByTable = { workouts: [{ ...workoutRow, id: "w9" }] }
    const row = await addWorkout("plan-1", {
      title: "Day C",
      focus: null,
      day_of_week: null,
      notes: null,
      position: 3,
    })

    expect(row.id).toBe("w9")
    const call = calls.find((c) => c.table === "workouts")!
    expect(call.op).toBe("insert")
    expect(call.payload).toMatchObject({ plan_id: "plan-1", position: 3 })
  })
})

describe("deleteExercise", () => {
  it("deletes by id (safe: logs reference workouts, not exercises)", async () => {
    await deleteExercise("e1")
    const call = calls.find((c) => c.table === "exercises")!
    expect(call.op).toBe("delete")
    expect(call.filters).toEqual({ id: "e1" })
    // No workout_logs access on an exercise delete.
    expect(calls.some((c) => c.table === "workout_logs")).toBe(false)
  })
})

describe("deleteWorkout (cascade guard)", () => {
  it("REFUSES to delete a workout that has completion logs", async () => {
    countByTable = { workout_logs: 2 }

    const outcome = await deleteWorkout("w1")

    expect(outcome).toEqual({ ok: false, reason: "has_logs", logCount: 2 })
    // It must count logs but NEVER issue a delete against `workouts`.
    expect(calls.some((c) => c.table === "workout_logs" && c.head)).toBe(true)
    expect(calls.some((c) => c.table === "workouts" && c.op === "delete")).toBe(
      false
    )
  })

  it("deletes a workout only when no logs reference it", async () => {
    countByTable = { workout_logs: 0 }

    const outcome = await deleteWorkout("w1")

    expect(outcome).toEqual({ ok: true })
    const del = calls.find((c) => c.table === "workouts" && c.op === "delete")!
    expect(del.filters).toEqual({ id: "w1" })
  })
})

describe("countWorkoutLogs", () => {
  it("returns the exact head-count of referencing logs", async () => {
    countByTable = { workout_logs: 5 }
    expect(await countWorkoutLogs("w1")).toBe(5)
  })

  it("throws a descriptive error on a database failure", async () => {
    errorByTable = { workout_logs: { message: "boom" } }
    await expect(countWorkoutLogs("w1")).rejects.toThrow(
      /Failed to count workout logs/
    )
  })
})
