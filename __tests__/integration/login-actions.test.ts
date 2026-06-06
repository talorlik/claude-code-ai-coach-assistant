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

/** The locale the mocked `getLocale` reports; assertions ignore the prefix. */
const TEST_LOCALE = "en"

let signInResult: { data: { user: { id: string } | null }; error: unknown }
let signUpResult: {
  data: { user: { identities?: unknown[] } | null }
  error: unknown
}
let resolvedDestination = "/profile"
const cookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
}

// The actions now redirect through the locale-aware navigation helper, which
// takes `{href, locale}`. Capture the href so existing assertions on the
// unprefixed target still hold; the locale prefix is applied by next-intl in
// the real app and is asserted separately in the e2e and unit suites.
vi.mock("@/i18n/navigation", () => ({
  redirect: ({ href }: { href: string; locale: string }) => {
    throw new RedirectError(href)
  },
}))

vi.mock("next-intl/server", () => ({
  getLocale: async () => TEST_LOCALE,
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

// login() no longer calls isAdmin directly; it delegates the post-auth landing
// decision to resolvePostAuthDestination. Mock the resolver so the action's own
// branching (validation, remember-me, ?redirect= precedence) is what's tested,
// not the resolver's internals (covered in post-auth-redirect.test.ts).
const resolvePostAuthDestination = vi.fn(
  async (_id: string) => resolvedDestination
)

vi.mock("@/lib/auth/post-auth-redirect", () => ({
  resolvePostAuthDestination: (id: string) => resolvePostAuthDestination(id),
}))

vi.mock("@/lib/profile/profile-actions", () => ({
  ensureProfile: async () => {},
}))

import { login, signup } from "@/app/[locale]/login/actions"

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
  resolvedDestination = "/profile"
  resolvePostAuthDestination.mockClear()
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

  it("uses the resolved destination when there is no redirect", async () => {
    resolvedDestination = "/join"
    const target = await captureRedirect(() =>
      login(form({ email: "dana@example.com", password: "longenough1" }))
    )
    expect(target).toBe("/join")
    expect(resolvePostAuthDestination).toHaveBeenCalledWith("user-1")
  })

  it("routes an onboarded user with a plan to the resolved /my-plan", async () => {
    resolvedDestination = "/my-plan"
    const target = await captureRedirect(() =>
      login(form({ email: "dana@example.com", password: "longenough1" }))
    )
    expect(target).toBe("/my-plan")
  })

  it("honors a safe in-app redirect target over the resolver", async () => {
    resolvedDestination = "/join"
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
    // The safe ?redirect= short-circuits the resolver entirely.
    expect(resolvePostAuthDestination).not.toHaveBeenCalled()
  })

  it("ignores an off-site redirect and lets the resolver decide", async () => {
    resolvedDestination = "/join"
    const target = await captureRedirect(() =>
      login(
        form({
          email: "dana@example.com",
          password: "longenough1",
          redirect: "//evil.com",
        })
      )
    )
    expect(target).toBe("/join")
    expect(resolvePostAuthDestination).toHaveBeenCalledWith("user-1")
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
