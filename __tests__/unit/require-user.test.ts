import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Unit tests for the auth/role guards. `getCurrentUserRole` is mocked so each
 * case sets the caller's identity directly. `redirect` is mocked to throw a
 * sentinel carrying its argument, mirroring next-intl's real behavior (it never
 * returns) and letting us assert the redirect target and that execution stops.
 */

// Hoisted so the vi.mock factories below (themselves hoisted to the top of the
// module) can safely reference these without a temporal-dead-zone error.
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

// The hoisted RedirectError is a value binding; this names its instance type so
// caught errors can be narrowed in type position.
type RedirectErrorInstance = InstanceType<typeof RedirectError>

import {
  requireUser,
  requireClient,
  requireTrainerAdmin,
} from "@/lib/auth/require-user"

beforeEach(() => {
  mockGetCurrentUserRole.mockReset()
})

describe("requireUser", () => {
  it("returns the user id when signed in", async () => {
    mockGetCurrentUserRole.mockResolvedValue({ userId: "u1", isAdmin: false })
    expect(await requireUser()).toBe("u1")
  })

  it("redirects to localized login when signed out", async () => {
    mockGetCurrentUserRole.mockResolvedValue({ userId: null, isAdmin: false })
    await expect(requireUser()).rejects.toBeInstanceOf(RedirectError)
    try {
      await requireUser()
    } catch (e) {
      const arg = (e as RedirectErrorInstance).arg
      expect(arg.href).toBe("/login?notice=signInToContinue")
      expect(arg.locale).toBe("he")
    }
  })
})

describe("requireClient", () => {
  it("allows any signed-in user", async () => {
    mockGetCurrentUserRole.mockResolvedValue({ userId: "u2", isAdmin: false })
    expect(await requireClient()).toBe("u2")
  })

  it("allows a trainer admin too", async () => {
    mockGetCurrentUserRole.mockResolvedValue({ userId: "admin1", isAdmin: true })
    expect(await requireClient()).toBe("admin1")
  })

  it("redirects a signed-out visitor to login", async () => {
    mockGetCurrentUserRole.mockResolvedValue({ userId: null, isAdmin: false })
    try {
      await requireClient()
      throw new Error("should have redirected")
    } catch (e) {
      expect(e).toBeInstanceOf(RedirectError)
      expect((e as RedirectErrorInstance).arg.href).toBe(
        "/login?notice=signInToContinue"
      )
    }
  })
})

describe("requireTrainerAdmin", () => {
  it("returns the admin id for a trainer admin", async () => {
    mockGetCurrentUserRole.mockResolvedValue({ userId: "admin1", isAdmin: true })
    expect(await requireTrainerAdmin()).toBe("admin1")
  })

  it("redirects a signed-out visitor to login", async () => {
    mockGetCurrentUserRole.mockResolvedValue({ userId: null, isAdmin: false })
    try {
      await requireTrainerAdmin()
      throw new Error("should have redirected")
    } catch (e) {
      expect((e as RedirectErrorInstance).arg.href).toBe(
        "/login?notice=signInToContinue"
      )
    }
  })

  it("redirects a signed-in non-admin (client) to home", async () => {
    mockGetCurrentUserRole.mockResolvedValue({ userId: "u3", isAdmin: false })
    try {
      await requireTrainerAdmin()
      throw new Error("should have redirected")
    } catch (e) {
      expect(e).toBeInstanceOf(RedirectError)
      expect((e as RedirectErrorInstance).arg.href).toBe("/")
      expect((e as RedirectErrorInstance).arg.locale).toBe("he")
    }
  })
})
