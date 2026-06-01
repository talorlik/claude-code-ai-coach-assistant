import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Integration test for the login/signup server actions. Supabase auth,
 * next/navigation redirect, next/headers, next/cache, role lookup, and
 * ensureProfile are faked so the action's branching (validation, remember-me,
 * role-based redirect, signup notices) runs in isolation.
 *
 * `redirect(target)` throws a tagged error - mirroring Next's real redirect,
 * which throws to halt execution - so each action call is wrapped to capture
 * the target it redirected to.
 */

class RedirectError extends Error {
  constructor(public target: string) {
    super(`redirect:${target}`)
  }
}

let signInResult: { data: { user: { id: string } | null }; error: unknown }
let signUpResult: {
  data: { user: { identities?: unknown[] } | null }
  error: unknown
}
let adminFlag = false
const cookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
}

vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new RedirectError(target)
  },
}))

vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000" }),
  cookies: async () => cookieStore,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async () => signInResult,
      signUp: async () => signUpResult,
    },
  }),
}))

vi.mock("@/lib/auth/roles", () => ({
  isAdmin: async () => adminFlag,
}))

vi.mock("@/lib/profile/profile-actions", () => ({
  ensureProfile: async () => {},
}))

import { login, signup } from "@/app/login/actions"

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
  signInResult = { data: { user: { id: "user-1" } }, error: null }
  signUpResult = { data: { user: { identities: [{}] } }, error: null }
  adminFlag = false
  cookieStore.set.mockReset()
  cookieStore.delete.mockReset()
  cookieStore.get.mockReset()
})

describe("login", () => {
  it("redirects to an error code on missing credentials", async () => {
    const target = await captureRedirect(() =>
      login(form({ email: "", password: "" }))
    )
    expect(target).toBe("/login?error=credentialsRequired")
  })

  it("redirects to an error code on a short password", async () => {
    const target = await captureRedirect(() =>
      login(form({ email: "dana@example.com", password: "short" }))
    )
    expect(target).toBe("/login?error=passwordTooShort")
  })

  it("redirects a non-admin to /profile on success", async () => {
    const target = await captureRedirect(() =>
      login(form({ email: "dana@example.com", password: "longenough1" }))
    )
    expect(target).toBe("/profile")
  })

  it("redirects an admin to /admin on success", async () => {
    adminFlag = true
    const target = await captureRedirect(() =>
      login(form({ email: "admin@example.com", password: "longenough1" }))
    )
    expect(target).toBe("/admin")
  })

  it("honors a safe in-app redirect target", async () => {
    const target = await captureRedirect(() =>
      login(
        form({
          email: "dana@example.com",
          password: "longenough1",
          redirect: "/chat",
        })
      )
    )
    expect(target).toBe("/chat")
  })

  it("ignores an off-site redirect target", async () => {
    const target = await captureRedirect(() =>
      login(
        form({
          email: "dana@example.com",
          password: "longenough1",
          redirect: "//evil.com",
        })
      )
    )
    expect(target).toBe("/profile")
  })

  it("redirects to invalidCredentials when sign-in fails", async () => {
    signInResult = { data: { user: null }, error: { message: "nope" } }
    const target = await captureRedirect(() =>
      login(form({ email: "dana@example.com", password: "longenough1" }))
    )
    expect(target).toBe("/login?error=invalidCredentials")
  })

  it("stores a session-only flag when remember is unchecked", async () => {
    await captureRedirect(() =>
      login(form({ email: "dana@example.com", password: "longenough1" }))
    )
    expect(cookieStore.set).toHaveBeenCalledWith(
      "remember-me",
      "0",
      expect.objectContaining({ path: "/" })
    )
  })

  it("clears the flag when remember is checked", async () => {
    await captureRedirect(() =>
      login(
        form({
          email: "dana@example.com",
          password: "longenough1",
          remember: "on",
        })
      )
    )
    expect(cookieStore.delete).toHaveBeenCalledWith("remember-me")
  })
})

describe("signup", () => {
  it("redirects with checkEmailToConfirm for a new account", async () => {
    const target = await captureRedirect(() =>
      signup(form({ email: "new@example.com", password: "longenough1" }))
    )
    expect(target).toBe("/login?notice=checkEmailToConfirm")
  })

  it("redirects with accountMaybeExists when identities is empty", async () => {
    signUpResult = { data: { user: { identities: [] } }, error: null }
    const target = await captureRedirect(() =>
      signup(form({ email: "exists@example.com", password: "longenough1" }))
    )
    expect(target).toBe("/login?notice=accountMaybeExists")
  })

  it("redirects with signupFailed on error", async () => {
    signUpResult = { data: { user: null }, error: { message: "boom" } }
    const target = await captureRedirect(() =>
      signup(form({ email: "new@example.com", password: "longenough1" }))
    )
    expect(target).toBe("/login?tab=signup&error=signupFailed")
  })
})
