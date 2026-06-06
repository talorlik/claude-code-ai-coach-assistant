import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Role-gating regression for the `/admin` subtree (batch 22). `requireAdmin` is
 * the guard the admin layout runs before the dashboard renders; it is a
 * back-compatible alias of `requireTrainerAdmin`. These tests pin the gating
 * contract directly against `requireAdmin` so the admin dashboard's access rules
 * are asserted at the name the layout actually calls: a signed-out visitor is
 * sent to the localized login, and a signed-in non-admin (customer) is sent to
 * home. `getCurrentUserRole` is mocked to set the caller's identity; `redirect`
 * throws a sentinel carrying its argument, mirroring next-intl's never-returning
 * behavior so the redirect target and short-circuit can both be asserted.
 */

const { mockGetCurrentUserRole, RedirectError } = vi.hoisted(() => {
  class RedirectError extends Error {
    arg: { href: string; locale: string }
    constructor(arg: { href: string; locale: string }) {
      super("redirect")
      this.arg = arg
    }
  }
  return { mockGetCurrentUserRole: vi.fn(), RedirectError }
})

vi.mock("next-intl/server", () => ({
  getLocale: async () => "he",
}))

vi.mock("@/i18n/navigation", () => ({
  redirect: (arg: { href: string; locale: string }) => {
    throw new RedirectError(arg)
  },
}))

vi.mock("@/lib/auth/roles", () => ({
  getCurrentUserRole: mockGetCurrentUserRole,
}))

type RedirectErrorInstance = InstanceType<typeof RedirectError>

import { requireAdmin } from "@/lib/auth/require-admin"

beforeEach(() => {
  mockGetCurrentUserRole.mockReset()
})

describe("requireAdmin (admin route guard)", () => {
  it("returns the admin id for an admin", async () => {
    mockGetCurrentUserRole.mockResolvedValue({ userId: "admin1", isAdmin: true })
    expect(await requireAdmin()).toBe("admin1")
  })

  it("redirects a signed-out visitor to the localized login", async () => {
    mockGetCurrentUserRole.mockResolvedValue({ userId: null, isAdmin: false })
    try {
      await requireAdmin()
      throw new Error("should have redirected")
    } catch (e) {
      expect(e).toBeInstanceOf(RedirectError)
      expect((e as RedirectErrorInstance).arg.href).toBe(
        "/login?notice=signInToContinue"
      )
      expect((e as RedirectErrorInstance).arg.locale).toBe("he")
    }
  })

  it("redirects a signed-in non-admin (customer) to home", async () => {
    mockGetCurrentUserRole.mockResolvedValue({ userId: "u3", isAdmin: false })
    try {
      await requireAdmin()
      throw new Error("should have redirected")
    } catch (e) {
      expect(e).toBeInstanceOf(RedirectError)
      expect((e as RedirectErrorInstance).arg.href).toBe("/")
      expect((e as RedirectErrorInstance).arg.locale).toBe("he")
    }
  })
})
