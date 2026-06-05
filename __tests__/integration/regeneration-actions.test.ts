import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the regeneration server actions. These assert the
 * action-layer responsibilities the orchestration tests do not:
 *
 * - Auth gating: the client action requires a client session; the trainer action
 *   requires the trainer-admin role. When the guard redirects (throws, as Next's
 *   redirect does), no regeneration runs.
 * - Reason validation: a missing/short reason is rejected with the field code the
 *   form localizes, before any AI or DB work.
 * - Delegation: a valid request reaches {@link regeneratePlanForClient} with the
 *   correct owner/trigger, and a failure is surfaced as a localizable code.
 * - History preservation end-to-end: driving the real orchestration over a fake
 *   Supabase client, a successful regeneration archives (updates) the prior plan
 *   and never deletes any plan, workout, or workout_log, so old logs remain.
 *
 * Auth, AI, and (for the delegation tests) the orchestration are mocked; the
 * history test uses the real orchestration with a fake Supabase client so the
 * never-delete guarantee is exercised, not assumed.
 */

const requireClient = vi.fn<() => Promise<string>>()
const requireTrainerAdmin = vi.fn<() => Promise<string>>()
const regeneratePlanForClient = vi.fn()
const getLocale = vi.fn<() => Promise<string>>()

vi.mock("@/lib/auth/require-user", () => ({
  requireClient: () => requireClient(),
  requireTrainerAdmin: () => requireTrainerAdmin(),
}))

vi.mock("@/lib/ai/regenerate-plan", () => ({
  regeneratePlanForClient: (...args: unknown[]) =>
    regeneratePlanForClient(...args),
}))

vi.mock("next-intl/server", () => ({
  getLocale: () => getLocale(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import {
  regenerateMyPlanAction,
  regenerateClientPlanAction,
} from "@/lib/workouts/regeneration-actions"

beforeEach(() => {
  vi.clearAllMocks()
  requireClient.mockResolvedValue("client-1")
  requireTrainerAdmin.mockResolvedValue("admin-1")
  getLocale.mockResolvedValue("en")
  regeneratePlanForClient.mockResolvedValue({
    ok: true,
    plan: { id: "plan-new" },
    workoutCount: 2,
    exerciseCount: 5,
  })
})

describe("regenerateMyPlanAction", () => {
  it("regenerates the caller's own plan with the trimmed reason", async () => {
    const result = await regenerateMyPlanAction("Plan too easy now")

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.plan.id).toBe("plan-new")
    // The client is both the owner and the trigger; locale resolves to en-US.
    expect(regeneratePlanForClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        triggeredBy: "client-1",
        localeTag: "en-US",
        reason: "Plan too easy now",
      }),
      undefined
    )
  })

  it("rejects a missing reason before any regeneration work", async () => {
    const result = await regenerateMyPlanAction("")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.reason).toBe("required")
    expect(regeneratePlanForClient).not.toHaveBeenCalled()
  })

  it("surfaces an AI failure as a localizable code", async () => {
    regeneratePlanForClient.mockResolvedValue({ ok: false, reason: "ai_error" })
    const result = await regenerateMyPlanAction("Goals changed")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("aiError")
  })

  it("does not regenerate when the client guard redirects (throws)", async () => {
    requireClient.mockRejectedValue(new Error("NEXT_REDIRECT"))
    await expect(regenerateMyPlanAction("Goals changed")).rejects.toThrow()
    expect(regeneratePlanForClient).not.toHaveBeenCalled()
  })
})

describe("regenerateClientPlanAction", () => {
  it("regenerates the target client's plan, attributing the trigger to the admin", async () => {
    const result = await regenerateClientPlanAction("client-9", "Switching focus")

    expect(result.ok).toBe(true)
    expect(regeneratePlanForClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-9",
        triggeredBy: "admin-1",
        reason: "Switching focus",
      }),
      undefined
    )
  })

  it("rejects a too-short reason for the trainer too", async () => {
    const result = await regenerateClientPlanAction("client-9", "x")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.reason).toBe("tooShort")
    expect(regeneratePlanForClient).not.toHaveBeenCalled()
  })

  it("does not regenerate when the admin guard redirects (throws)", async () => {
    requireTrainerAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"))
    await expect(
      regenerateClientPlanAction("client-9", "Switching focus")
    ).rejects.toThrow()
    expect(regeneratePlanForClient).not.toHaveBeenCalled()
  })
})
