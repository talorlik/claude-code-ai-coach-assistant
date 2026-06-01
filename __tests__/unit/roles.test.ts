import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock the server Supabase client so role helpers are tested in isolation.
const mockMaybeSingle = vi.fn()
const mockGetUser = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: mockMaybeSingle }),
        }),
      }),
    }),
    auth: { getUser: mockGetUser },
  }),
}))

import { isAdmin, getCurrentUserRole } from "@/lib/auth/roles"

beforeEach(() => {
  mockMaybeSingle.mockReset()
  mockGetUser.mockReset()
})

describe("isAdmin", () => {
  it("returns false for a missing user id without querying", async () => {
    expect(await isAdmin(null)).toBe(false)
    expect(await isAdmin(undefined)).toBe(false)
    expect(mockMaybeSingle).not.toHaveBeenCalled()
  })

  it("returns true when an admin row exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null })
    expect(await isAdmin("user-1")).toBe(true)
  })

  it("returns false when no admin row exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await isAdmin("user-1")).toBe(false)
  })

  it("returns false on a query error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "x" } })
    expect(await isAdmin("user-1")).toBe(false)
  })
})

describe("getCurrentUserRole", () => {
  it("returns null role for an unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect(await getCurrentUserRole()).toEqual({ userId: null, isAdmin: false })
  })

  it("returns the user id and admin status when signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mockMaybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null })
    expect(await getCurrentUserRole()).toEqual({
      userId: "user-1",
      isAdmin: true,
    })
  })
})
