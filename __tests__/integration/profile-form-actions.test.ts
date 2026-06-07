import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Integration test for the FormData-accepting profile form wrappers
 * (updateProfileForm/updateEmailForm/updatePasswordForm). These are the no-JS
 * submit entry points: they read FormData, call the underlying typed action, and
 * redirect back to `/profile` with a `?notice`/`?error` code.
 *
 * Supabase, next/cache, the locale-aware redirect, and getLocale are faked so
 * the wrappers' branching runs in isolation. `redirect({href})` throws a tagged
 * error - mirroring the real next-intl redirect, which throws to halt - so each
 * call is wrapped to capture the href it redirected to.
 */

class RedirectError extends Error {
  constructor(public target: string) {
    super(`redirect:${target}`)
  }
}

const TEST_LOCALE = "en"

let currentUser: { id: string; email: string } | null = null
let upsertedProfile: Record<string, unknown> | null = null
let updatedAuthUser: Record<string, unknown> | null = null
let upsertError: { message: string } | null = null
let authError: { message: string } | null = null

vi.mock("@/i18n/navigation", () => ({
  redirect: ({ href }: { href: string; locale: string }) => {
    throw new RedirectError(href)
  },
}))

vi.mock("next-intl/server", () => ({
  getLocale: async () => TEST_LOCALE,
}))

vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

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
  updateProfileForm,
  updateEmailForm,
  updatePasswordForm,
} from "@/lib/profile/profile-actions"

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

async function captureRedirect(run: () => Promise<void>): Promise<string> {
  try {
    await run()
  } catch (e) {
    if (e instanceof RedirectError) return e.target
    throw e
  }
  throw new Error("expected a redirect")
}

beforeEach(() => {
  currentUser = { id: "user-1", email: "dana@example.com" }
  upsertedProfile = null
  updatedAuthUser = null
  upsertError = null
  authError = null
})

describe("updateProfileForm", () => {
  it("redirects with detailsSaved on a valid save", async () => {
    const target = await captureRedirect(() =>
      updateProfileForm(form({ fullName: "Dana Levi", phone: "0501234567" }))
    )
    expect(target).toBe("/profile?notice=detailsSaved")
    expect(upsertedProfile).toMatchObject({ full_name: "Dana Levi" })
  })

  it("redirects with saveFailed on an invalid name without writing", async () => {
    const target = await captureRedirect(() =>
      updateProfileForm(form({ fullName: "A", phone: "" }))
    )
    expect(target).toBe("/profile?error=saveFailed")
    expect(upsertedProfile).toBeNull()
  })

  it("redirects with saveFailed when not signed in", async () => {
    currentUser = null
    const target = await captureRedirect(() =>
      updateProfileForm(form({ fullName: "Dana Levi", phone: "0501234567" }))
    )
    expect(target).toBe("/profile?error=saveFailed")
  })
})

describe("updateEmailForm", () => {
  it("redirects with emailConfirmSent on a valid email", async () => {
    const target = await captureRedirect(() =>
      updateEmailForm(form({ email: "new@example.com" }))
    )
    expect(target).toBe("/profile?notice=emailConfirmSent")
    expect(updatedAuthUser).toEqual({ email: "new@example.com" })
  })

  it("redirects with invalidEmail on a malformed address without calling auth", async () => {
    const target = await captureRedirect(() =>
      updateEmailForm(form({ email: "nope" }))
    )
    expect(target).toBe("/profile?error=invalidEmail")
    expect(updatedAuthUser).toBeNull()
  })

  it("redirects with emailUpdateFailed on an auth error", async () => {
    authError = { message: "boom" }
    const target = await captureRedirect(() =>
      updateEmailForm(form({ email: "new@example.com" }))
    )
    expect(target).toBe("/profile?error=emailUpdateFailed")
  })
})

describe("updatePasswordForm", () => {
  it("redirects with passwordsDoNotMatch without calling auth", async () => {
    const target = await captureRedirect(() =>
      updatePasswordForm(
        form({ password: "longenough1", confirmPassword: "different1" })
      )
    )
    expect(target).toBe("/profile?error=passwordsDoNotMatch")
    // Proves the server-side confirm check runs before any auth call (no-JS path).
    expect(updatedAuthUser).toBeNull()
  })

  it("redirects with passwordTooShort on a short password", async () => {
    const target = await captureRedirect(() =>
      updatePasswordForm(form({ password: "short", confirmPassword: "short" }))
    )
    expect(target).toBe("/profile?error=passwordTooShort")
    expect(updatedAuthUser).toBeNull()
  })

  it("redirects with passwordUpdated on a valid change", async () => {
    const target = await captureRedirect(() =>
      updatePasswordForm(
        form({ password: "longenough1", confirmPassword: "longenough1" })
      )
    )
    expect(target).toBe("/profile?notice=passwordUpdated")
    expect(updatedAuthUser).toEqual({ password: "longenough1" })
  })

  it("redirects with passwordUpdateFailed on an auth error", async () => {
    authError = { message: "boom" }
    const target = await captureRedirect(() =>
      updatePasswordForm(
        form({ password: "longenough1", confirmPassword: "longenough1" })
      )
    )
    expect(target).toBe("/profile?error=passwordUpdateFailed")
  })
})
