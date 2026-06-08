import { beforeEach, describe, expect, it, vi } from "vitest"

import type { OnboardingInput } from "@/lib/validation/onboarding"

/**
 * Integration test for the trainer-admin client onboarding save action. The auth
 * guard, the clients data layer, and cache revalidation are mocked, so the test
 * exercises the action's orchestration: it is admin-gated, it re-validates the
 * payload through the shared onboarding validator, and on success it upserts the
 * *explicit target* client (not the caller) with the new availability / duration
 * / equipment-other fields mapped through.
 */

const requireTrainerAdmin = vi.fn<() => Promise<string>>()
const upsertClient = vi.fn()

vi.mock("@/lib/auth/require-user", () => ({
  requireTrainerAdmin: () => requireTrainerAdmin(),
}))

vi.mock("@/lib/db/clients", () => ({
  upsertClient: (input: unknown) => upsertClient(input),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const { saveClientOnboardingAction } = await import(
  "@/lib/trainer/client-onboarding-actions"
)

/** A fully valid onboarding payload; tests override individual fields. */
function valid(overrides: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    fullName: "Dana Levi",
    phone: "+972541234567",
    countryIso2: "IL",
    age: "32",
    goals: ["build_muscle"],
    fitnessLevel: "intermediate",
    availableDays: ["monday", "wednesday"],
    availability: {
      monday: [{ start: "06:00", end: "08:00" }],
      wednesday: [{ start: "18:00", end: "20:00" }],
    },
    sessionDurationMinutes: "45",
    preferredLocation: "gym",
    equipment: ["dumbbells"],
    equipmentOtherSelected: true,
    equipmentOther: "sled, prowler",
    limitations: "",
    notes: "",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  requireTrainerAdmin.mockResolvedValue("admin-1")
  upsertClient.mockResolvedValue({ userId: "client-9" })
})

describe("saveClientOnboardingAction", () => {
  it("upserts the explicit target client with the new fields", async () => {
    const result = await saveClientOnboardingAction("client-9", valid())

    expect(result.ok).toBe(true)
    expect(requireTrainerAdmin).toHaveBeenCalledOnce()
    expect(upsertClient).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "client-9",
        availability: {
          monday: [{ start: "06:00", end: "08:00" }],
          wednesday: [{ start: "18:00", end: "20:00" }],
        },
        sessionDurationMinutes: 45,
        equipmentOther: ["sled", "prowler"],
      })
    )
  })

  it("rejects an invalid payload without writing", async () => {
    const result = await saveClientOnboardingAction(
      "client-9",
      valid({ sessionDurationMinutes: "50" })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors?.sessionDurationMinutes).toBe("invalid")
    }
    expect(upsertClient).not.toHaveBeenCalled()
  })

  it("surfaces a save failure as a user-safe code", async () => {
    upsertClient.mockRejectedValueOnce(new Error("db down"))
    const result = await saveClientOnboardingAction("client-9", valid())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("saveFailed")
  })
})
