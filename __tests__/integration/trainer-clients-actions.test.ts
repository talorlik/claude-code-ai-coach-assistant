import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the trainer client-list server actions.
 *
 * - Auth gating: both actions require the trainer-admin role; when the guard
 *   throws (as Next's redirect does), no write runs.
 * - setPlanActiveAction: deactivate archives the active plan; activate restores
 *   the most-recently-archived plan; activate with no plan returns the
 *   localizable `plan.noPlanToActivate` code without throwing.
 * - deleteClientAction: deletes the clients row then the auth user, and reports
 *   a partial failure if the auth-user delete fails after the data delete.
 *
 * Auth, Supabase, and next/cache are mocked.
 */

const requireTrainerAdmin = vi.fn<() => Promise<string>>()

vi.mock("@/lib/auth/require-user", () => ({
  requireTrainerAdmin: () => requireTrainerAdmin(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

interface PlanRow {
  id: string
  client_id: string
  status: string
  archived_at: string | null
  updated_at: string
}

let plans: PlanRow[]
let updateCalls: Array<{ patch: Record<string, unknown>; id: string }>
let deletedClientIds: string[]
let deletedUserIds: string[]
let authDeleteError: { message: string } | null
let dataDeleteError: { message: string } | null

function rlsClient() {
  return {
    from(table: string) {
      if (table !== "workout_plans" && table !== "clients") {
        throw new Error(`unexpected table ${table}`)
      }
      const ctx: {
        action: "select" | "update" | "delete" | null
        patch: Record<string, unknown>
        filters: Record<string, unknown>
        order?: { col: string; asc: boolean }
        limitN?: number
      } = { action: null, patch: {}, filters: {} }

      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.update = (patch: Record<string, unknown>) => {
        ctx.action = "update"
        ctx.patch = patch
        return builder
      }
      builder.delete = () => {
        ctx.action = "delete"
        return builder
      }
      builder.eq = (col: string, val: unknown) => {
        ctx.filters[col] = val
        return builder
      }
      builder.order = (col: string, opts: { ascending: boolean }) => {
        ctx.order = { col, asc: opts.ascending }
        return builder
      }
      builder.limit = (n: number) => {
        ctx.limitN = n
        return builder
      }
      builder.maybeSingle = async () => {
        const matched = plans
          .filter((p) =>
            Object.entries(ctx.filters).every(
              ([k, v]) => (p as unknown as Record<string, unknown>)[k] === v
            )
          )
          .sort((a, b) =>
            ctx.order?.col === "archived_at"
              ? (b.archived_at ?? "").localeCompare(a.archived_at ?? "")
              : 0
          )
        return { data: matched[0] ?? null, error: null }
      }
      builder.then = (resolve: (v: { error: unknown }) => unknown) => {
        if (ctx.action === "update") {
          for (const p of plans) {
            if (
              Object.entries(ctx.filters).every(
                ([k, v]) => (p as unknown as Record<string, unknown>)[k] === v
              )
            ) {
              Object.assign(p, ctx.patch)
              updateCalls.push({ patch: ctx.patch, id: p.id })
            }
          }
        } else if (ctx.action === "delete" && table === "clients") {
          if (dataDeleteError) {
            return resolve({ error: dataDeleteError })
          }
          deletedClientIds.push(String(ctx.filters.user_id))
        }
        return resolve({ error: null })
      }
      return builder
    },
    auth: {
      admin: {
        deleteUser: async (userId: string) => {
          if (authDeleteError) return { error: authDeleteError }
          deletedUserIds.push(userId)
          return { error: null }
        },
      },
    },
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => rlsClient(),
  createAdminClient: async () => rlsClient(),
}))

import {
  setPlanActiveAction,
  deleteClientAction,
} from "@/lib/db/trainer-clients-actions"

beforeEach(() => {
  vi.clearAllMocks()
  requireTrainerAdmin.mockResolvedValue("admin-1")
  plans = []
  updateCalls = []
  deletedClientIds = []
  deletedUserIds = []
  authDeleteError = null
  dataDeleteError = null
})

describe("setPlanActiveAction", () => {
  it("archives the active plan when deactivating", async () => {
    plans = [
      {
        id: "p1",
        client_id: "c1",
        status: "active",
        archived_at: null,
        updated_at: "2026-06-01T00:00:00Z",
      },
    ]

    const result = await setPlanActiveAction("c1", false)

    expect(result.ok).toBe(true)
    expect(plans[0].status).toBe("archived")
    expect(plans[0].archived_at).not.toBeNull()
  })

  it("reactivates the most-recently-archived plan when activating", async () => {
    plans = [
      {
        id: "old",
        client_id: "c1",
        status: "archived",
        archived_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-01T00:00:00Z",
      },
      {
        id: "recent",
        client_id: "c1",
        status: "archived",
        archived_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T00:00:00Z",
      },
    ]

    const result = await setPlanActiveAction("c1", true)

    expect(result.ok).toBe(true)
    const recent = plans.find((p) => p.id === "recent")!
    expect(recent.status).toBe("active")
    expect(recent.archived_at).toBeNull()
  })

  it("returns noPlanToActivate when the client has no plan", async () => {
    plans = []

    const result = await setPlanActiveAction("c1", true)

    expect(result).toEqual({ ok: false, error: "plan.noPlanToActivate" })
  })

  it("rejects when the admin guard throws", async () => {
    requireTrainerAdmin.mockRejectedValue(new Error("redirect"))

    await expect(setPlanActiveAction("c1", false)).rejects.toThrow("redirect")
    expect(updateCalls).toHaveLength(0)
  })
})

describe("deleteClientAction", () => {
  it("deletes the client data then the auth user", async () => {
    const result = await deleteClientAction("c1")

    expect(result).toEqual({ ok: true, data: null })
    expect(deletedClientIds).toContain("c1")
    expect(deletedUserIds).toContain("c1")
  })

  it("returns a partial-failure code when the auth-user delete fails", async () => {
    authDeleteError = { message: "auth boom" }

    const result = await deleteClientAction("c1")

    expect(result).toEqual({ ok: false, error: "delete.error" })
    // Data delete still happened (the row is gone).
    expect(deletedClientIds).toContain("c1")
  })

  it("does not delete the auth user when the data delete fails", async () => {
    dataDeleteError = { message: "data boom" }

    const result = await deleteClientAction("c1")

    expect(result).toEqual({ ok: false, error: "delete.error" })
    expect(deletedClientIds).toHaveLength(0)
    expect(deletedUserIds).toHaveLength(0)
  })

  it("rejects when the admin guard throws", async () => {
    requireTrainerAdmin.mockRejectedValue(new Error("redirect"))

    await expect(deleteClientAction("c1")).rejects.toThrow("redirect")
    expect(deletedClientIds).toHaveLength(0)
  })
})
