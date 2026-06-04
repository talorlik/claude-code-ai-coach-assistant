import { describe, expect, it, vi, beforeEach } from "vitest"

import type { GeneratedPlan } from "@/lib/ai/schemas"

/**
 * Integration test for plan persistence with a faked Supabase client. The fake
 * records every insert/update/delete so the test can assert the structured rows
 * written and the partial-write rollback. No live database is used; RLS is
 * exercised separately (it is enforced by the request-scoped client in prod).
 */

type Insert = { table: string; rows: Record<string, unknown>[] }

let inserts: Insert[] = []
let deletes: { table: string }[] = []
let updates: { table: string; patch: Record<string, unknown> }[] = []
// Control which insert (by table) should fail, to drive the rollback path.
let failOnInsertTable: string | null = null
// Sequential ids handed back from inserts, so we can assert cascade cleanup.
let nextId = 0

function nextRowId(prefix: string): string {
  nextId += 1
  return `${prefix}-${nextId}`
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(table: string) {
      return {
        insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
          const arr = Array.isArray(rows) ? rows : [rows]
          // exercises insert: no .select() chain in the code, returns directly.
          if (table === "exercises") {
            if (failOnInsertTable === table) {
              return { error: { message: "exercises boom" } }
            }
            inserts.push({ table, rows: arr })
            return { error: null }
          }
          // plan/workout inserts use .select().single().
          return {
            select: () => ({
              single: async () => {
                if (failOnInsertTable === table) {
                  return { data: null, error: { message: `${table} boom` } }
                }
                inserts.push({ table, rows: arr })
                const id = nextRowId(table)
                return {
                  data: {
                    ...arr[0],
                    id,
                    created_at: "2026-06-04T00:00:00.000Z",
                    updated_at: "2026-06-04T00:00:00.000Z",
                    archived_at: null,
                  },
                  error: null,
                }
              },
            }),
          }
        },
        update(patch: Record<string, unknown>) {
          return {
            eq() {
              return {
                eq: async () => {
                  updates.push({ table, patch })
                  return { error: null }
                },
              }
            },
          }
        },
        delete() {
          return {
            eq: async () => {
              deletes.push({ table })
              return { error: null }
            },
          }
        },
      }
    },
  }),
}))

const { saveGeneratedPlan } = await import("@/lib/db/plan-persistence")

function plan(): GeneratedPlan {
  return {
    title: "Two-day plan",
    summary: "x",
    safety_notes: "Not medical advice.",
    workouts: [
      {
        day_of_week: "monday",
        title: "Day 1",
        focus: "push",
        notes: null,
        exercises: [
          {
            name: "Push-up",
            sets: 3,
            reps: "10",
            duration: null,
            rest: "60s",
            instructions: "Straight body.",
            safety_notes: null,
          },
          {
            name: "Plank",
            sets: null,
            reps: null,
            duration: "30s",
            rest: "30s",
            instructions: "Brace.",
            safety_notes: null,
          },
        ],
      },
      {
        day_of_week: "thursday",
        title: "Day 2",
        focus: "legs",
        notes: null,
        exercises: [
          {
            name: "Squat",
            sets: 3,
            reps: "12",
            duration: null,
            rest: "90s",
            instructions: "Depth.",
            safety_notes: null,
          },
        ],
      },
    ],
  }
}

beforeEach(() => {
  inserts = []
  deletes = []
  updates = []
  failOnInsertTable = null
  nextId = 0
})

describe("saveGeneratedPlan", () => {
  it("saves the plan, its workouts, and exercises as structured rows", async () => {
    const result = await saveGeneratedPlan({
      clientId: "user-1",
      plan: plan(),
      localeTag: "en-US",
    })

    expect(result.workoutCount).toBe(2)
    expect(result.exerciseCount).toBe(3)

    const planInsert = inserts.find((i) => i.table === "workout_plans")!
    expect(planInsert.rows[0]).toMatchObject({
      client_id: "user-1",
      title: "Two-day plan",
      status: "active",
      locale: "en-US",
      source: "ai",
    })
    // The validated plan is preserved verbatim.
    expect(planInsert.rows[0].source_payload).toMatchObject({
      title: "Two-day plan",
    })

    // Two workouts with explicit, ordered positions.
    const workoutInserts = inserts.filter((i) => i.table === "workouts")
    expect(workoutInserts).toHaveLength(2)
    expect(workoutInserts[0].rows[0]).toMatchObject({ position: 0, title: "Day 1" })
    expect(workoutInserts[1].rows[0]).toMatchObject({ position: 1, title: "Day 2" })

    // Exercises carry positions and parent workout ids.
    const exerciseInserts = inserts.filter((i) => i.table === "exercises")
    expect(exerciseInserts).toHaveLength(2)
    expect(exerciseInserts[0].rows).toHaveLength(2)
    expect(exerciseInserts[0].rows[0]).toMatchObject({
      name: "Push-up",
      position: 0,
    })
    expect(exerciseInserts[0].rows[1]).toMatchObject({
      name: "Plank",
      position: 1,
    })
  })

  it("does not archive a previous plan at onboarding (archivePrevious false)", async () => {
    await saveGeneratedPlan({
      clientId: "user-1",
      plan: plan(),
      localeTag: "en-US",
      archivePrevious: false,
    })
    expect(updates).toHaveLength(0)
  })

  it("archives the previous active plan when regenerating", async () => {
    await saveGeneratedPlan({
      clientId: "user-1",
      plan: plan(),
      localeTag: "en-US",
      archivePrevious: true,
    })
    const archive = updates.find((u) => u.table === "workout_plans")
    expect(archive).toBeDefined()
    expect(archive!.patch).toMatchObject({ status: "archived" })
    expect(archive!.patch.archived_at).toBeTruthy()
  })

  it("rolls back the plan row when a child insert fails, saving nothing visible", async () => {
    failOnInsertTable = "exercises"
    await expect(
      saveGeneratedPlan({
        clientId: "user-1",
        plan: plan(),
        localeTag: "en-US",
      })
    ).rejects.toThrow(/exercises/i)

    // The plan row was deleted; cascade removes its children, so nothing partial
    // remains visible to the client.
    expect(deletes.some((d) => d.table === "workout_plans")).toBe(true)
  })

  it("throws and writes nothing when the plan insert itself fails", async () => {
    failOnInsertTable = "workout_plans"
    await expect(
      saveGeneratedPlan({
        clientId: "user-1",
        plan: plan(),
        localeTag: "en-US",
      })
    ).rejects.toThrow(/workout plan/i)
    expect(inserts.some((i) => i.table === "workouts")).toBe(false)
  })
})
