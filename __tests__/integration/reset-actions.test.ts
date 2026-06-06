import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Regression test for `setNewPassword`. Batch 21 rewired post-auth routing; this
 * guards that the password-recovery path is untouched - a successful reset still
 * signs the user out and lands on `/login?notice=passwordUpdated`, and never
 * leaks into the new onboarding/my-plan decision flow.
 */

class RedirectError extends Error {
  constructor(public target: string) {
    super(`redirect:${target}`)
  }
}

let updateResult: { ok: boolean; fieldErrors?: { password?: string } }
const signOut = vi.fn(async () => {})

vi.mock("@/i18n/navigation", () => ({
  redirect: ({ href }: { href: string; locale: string }) => {
    throw new RedirectError(href)
  },
}))
vi.mock("next-intl/server", () => ({ getLocale: async () => "en" }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut } }),
}))
vi.mock("@/lib/profile/profile-actions", () => ({
  updatePassword: async () => updateResult,
}))

import { setNewPassword } from "@/app/[locale]/reset-password/actions"

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
  updateResult = { ok: true }
  signOut.mockClear()
})

describe("setNewPassword", () => {
  it("signs out and lands on /login?notice=passwordUpdated on success", async () => {
    const target = await captureRedirect(() =>
      setNewPassword(
        form({ password: "longenough1", confirmPassword: "longenough1" })
      )
    )
    expect(target).toBe("/login?notice=passwordUpdated")
    expect(signOut).toHaveBeenCalled()
  })

  it("rejects mismatched passwords without signing out", async () => {
    const target = await captureRedirect(() =>
      setNewPassword(
        form({ password: "longenough1", confirmPassword: "different1" })
      )
    )
    expect(target).toBe("/reset-password?error=passwordsDoNotMatch")
    expect(signOut).not.toHaveBeenCalled()
  })

  it("surfaces a too-short password error", async () => {
    updateResult = { ok: false, fieldErrors: { password: "tooShort" } }
    const target = await captureRedirect(() =>
      setNewPassword(form({ password: "short", confirmPassword: "short" }))
    )
    expect(target).toBe("/reset-password?error=passwordTooShort")
  })
})
