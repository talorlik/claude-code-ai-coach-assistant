import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Unit test for {@link resolvePostAuthDestination}. The three Supabase-backed
 * helpers it composes (`isAdmin`, `getClient`, `getActivePlanDetail`) are mocked
 * so the decision order is exercised in isolation, independent of RLS or the
 * database.
 */

let adminFlag = false
let clientRow: unknown = null
let activePlan: unknown = null

const isAdmin = vi.fn(async (_id: string) => adminFlag)
const getClient = vi.fn(async (_id: string) => clientRow)
const getActivePlanDetail = vi.fn(async (_id: string) => activePlan)

vi.mock("@/lib/auth/roles", () => ({ isAdmin: (id: string) => isAdmin(id) }))
vi.mock("@/lib/db/clients", () => ({ getClient: (id: string) => getClient(id) }))
vi.mock("@/lib/db/workouts", () => ({
  getActivePlanDetail: (id: string) => getActivePlanDetail(id),
}))

import { resolvePostAuthDestination } from "@/lib/auth/post-auth-redirect"

beforeEach(() => {
  adminFlag = false
  clientRow = null
  activePlan = null
  isAdmin.mockClear()
  getClient.mockClear()
  getActivePlanDetail.mockClear()
})

describe("resolvePostAuthDestination", () => {
  it("sends an admin to /admin without consulting client state", async () => {
    adminFlag = true
    const dest = await resolvePostAuthDestination("user-1")
    expect(dest).toBe("/admin")
    expect(getClient).not.toHaveBeenCalled()
    expect(getActivePlanDetail).not.toHaveBeenCalled()
  })

  it("sends a user with no onboarding row to /join", async () => {
    clientRow = null
    const dest = await resolvePostAuthDestination("user-1")
    expect(dest).toBe("/join")
    expect(getActivePlanDetail).not.toHaveBeenCalled()
  })

  it("sends an onboarded user with an active plan to /my-plan", async () => {
    clientRow = { userId: "user-1" }
    activePlan = { plan: { id: "plan-1" } }
    const dest = await resolvePostAuthDestination("user-1")
    expect(dest).toBe("/my-plan")
  })

  it("sends an onboarded user with no active plan back to /join", async () => {
    clientRow = { userId: "user-1" }
    activePlan = null
    const dest = await resolvePostAuthDestination("user-1")
    expect(dest).toBe("/join")
  })
})
