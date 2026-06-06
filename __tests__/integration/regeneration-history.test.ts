import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * History-preservation integration test (batch required test 4: "old workout
 * logs remain available"). It drives the real {@link regeneratePlanForClient}
 * and the real {@link saveGeneratedPlan} over a fake Supabase client that records
 * every insert/update/delete. The assertion is structural and definitive: a
 * successful regeneration archives the prior plan via an UPDATE and never issues
 * a DELETE against `workout_plans`, `workouts`, or `workout_logs`. Because logs
 * reference workouts that are never deleted, the client's past logged workouts
 * remain queryable after regeneration.
 *
 * Only the AI generator is mocked (so the test is deterministic and offline);
 * the client load, persistence, and audit all run through the fake DB.
 */

type Op =
  | { kind: "insert"; table: string }
  | { kind: "update"; table: string; patch: Record<string, unknown> }
  | { kind: "delete"; table: string }

let ops: Op[] = []
let planId = 0

function makeQuery(table: string) {
  // Chainable stub: insert -> select -> single; update -> eq -> eq; delete -> eq.
  return {
    insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
      ops.push({ kind: "insert", table })
      if (table === "exercises") {
        return { error: null }
      }
      return {
        select: () => ({
          single: async () => {
            planId += 1
            return {
              data: {
                id: `${table}-${planId}`,
                ...((Array.isArray(rows) ? rows[0] : rows) ?? {}),
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
              ops.push({ kind: "update", table, patch })
              return { error: null }
            },
          }
        },
      }
    },
    delete() {
      return {
        eq: async () => {
          ops.push({ kind: "delete", table })
          return { error: null }
        },
      }
    },
    select() {
      return {
        eq: () => ({
          maybeSingle: async () => ({
            // The client load (`getClient`) reads this; return an onboarded row.
            data: {
              user_id: "client-1",
              full_name: "Dana",
              phone: null,
              age: null,
              age_range: null,
              goals: ["strength"],
              fitness_level: "intermediate",
              limitations: null,
              available_days: ["monday"],
              preferred_location: "gym",
              equipment: [],
              notes: null,
              onboarded_at: "2026-06-01T00:00:00.000Z",
              created_at: "",
              updated_at: "",
            },
            error: null,
          }),
        }),
      }
    },
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => makeQuery(table) }),
}))

const generateWorkoutPlan = vi.fn()
vi.mock("@/lib/ai/generate-plan", () => ({
  generateWorkoutPlan: (...args: unknown[]) => generateWorkoutPlan(...args),
}))

const { regeneratePlanForClient } = await import("@/lib/ai/regenerate-plan")

function validPlan() {
  return {
    title: "Refreshed",
    summary: "x",
    safety_notes: "Not medical advice.",
    workouts: [
      {
        day_of_week: "monday",
        title: "Day 1",
        focus: null,
        notes: null,
        exercises: [
          {
            name: "Squat",
            sets: 3,
            reps: "10",
            duration: null,
            rest: "60s",
            instructions: "Depth.",
            safety_notes: null,
          },
        ],
      },
    ],
  }
}

beforeEach(() => {
  ops = []
  planId = 0
  vi.clearAllMocks()
  generateWorkoutPlan.mockResolvedValue({ ok: true, plan: validPlan() })
})

describe("regeneration preserves history", () => {
  it("archives the prior plan via UPDATE and deletes no plan, workout, or log", async () => {
    const result = await regeneratePlanForClient(
      {
        clientId: "client-1",
        triggeredBy: "admin-1",
        localeTag: "en-US",
        reason: "Goals changed",
      },
      vi.fn()
    )

    expect(result.ok).toBe(true)

    // The prior active plan was archived, not deleted.
    const archive = ops.find(
      (o) => o.kind === "update" && o.table === "workout_plans"
    )
    expect(archive).toBeDefined()
    if (archive && archive.kind === "update") {
      expect(archive.patch).toMatchObject({ status: "archived" })
    }

    // No DELETE was issued against any history-bearing table, so old workouts
    // (and the workout_logs that reference them) remain available.
    const deletedTables = ops
      .filter((o) => o.kind === "delete")
      .map((o) => o.table)
    expect(deletedTables).not.toContain("workout_plans")
    expect(deletedTables).not.toContain("workouts")
    expect(deletedTables).not.toContain("workout_logs")
  })
})
