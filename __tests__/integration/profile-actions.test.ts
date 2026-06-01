import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Integration test for the profile server actions. The Supabase client is
 * faked so the action's real validation and write logic runs without a live
 * database. `next/cache` is stubbed because revalidatePath needs a request.
 */

let currentUser: { id: string; email: string } | null = null
let upsertedProfile: Record<string, unknown> | null = null
let updatedAuthUser: Record<string, unknown> | null = null
let upsertError: { message: string } | null = null
let authError: { message: string } | null = null

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser } }),
      updateUser: async (attrs: Record<string, unknown>) => {
        if (authError) return { error: authError }
        updatedAuthUser = attrs
        return { error: null }
      },
    },
    from() {
      return {
        upsert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              if (upsertError) return { data: null, error: upsertError }
              upsertedProfile = row
              return { data: row, error: null }
            },
          }),
        }),
      }
    },
  }),
}))

import {
  updateProfile,
  updateEmail,
  updatePassword,
} from "@/lib/profile/profile-actions"

beforeEach(() => {
  currentUser = { id: "user-1", email: "dana@example.com" }
  upsertedProfile = null
  updatedAuthUser = null
  upsertError = null
  authError = null
})

describe("updateProfile", () => {
  it("saves validated name and phone for the signed-in user", async () => {
    const result = await updateProfile({
      fullName: "Dana Levi",
      phone: "050-123-4567",
    })
    expect(result.ok).toBe(true)
    expect(upsertedProfile).toMatchObject({
      user_id: "user-1",
      full_name: "Dana Levi",
      phone: "0501234567",
    })
  })

  it("rejects an invalid name without writing", async () => {
    const result = await updateProfile({ fullName: "A", phone: "" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.fullName).toBeTruthy()
    expect(upsertedProfile).toBeNull()
  })

  it("fails when not signed in", async () => {
    currentUser = null
    const result = await updateProfile({
      fullName: "Dana Levi",
      phone: "0501234567",
    })
    expect(result.ok).toBe(false)
    expect(upsertedProfile).toBeNull()
  })
})

describe("updateEmail", () => {
  it("updates a valid email via auth", async () => {
    const result = await updateEmail("new@example.com")
    expect(result.ok).toBe(true)
    expect(updatedAuthUser).toEqual({ email: "new@example.com" })
  })

  it("rejects a malformed email without calling auth", async () => {
    const result = await updateEmail("nope")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.email).toBeTruthy()
    expect(updatedAuthUser).toBeNull()
  })
})

describe("updatePassword", () => {
  it("updates a password of sufficient length", async () => {
    const result = await updatePassword("longenough1")
    expect(result.ok).toBe(true)
    expect(updatedAuthUser).toEqual({ password: "longenough1" })
  })

  it("rejects a short password without calling auth", async () => {
    const result = await updatePassword("short")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.password).toBeTruthy()
    expect(updatedAuthUser).toBeNull()
  })

  it("surfaces an auth error", async () => {
    authError = { message: "boom" }
    const result = await updatePassword("longenough1")
    expect(result.ok).toBe(false)
  })
})
