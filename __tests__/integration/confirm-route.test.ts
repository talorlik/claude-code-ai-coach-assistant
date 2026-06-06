import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Integration tests for `GET /auth/confirm`. The Supabase token exchange,
 * `ensureProfile`, and the post-auth resolver are mocked so the route's landing
 * decision is tested in isolation. The hard constraint under test: a `recovery`
 * confirmation NEVER consults the resolver and always lands on
 * `/reset-password`, keeping password recovery insulated from the signup flow.
 */

let verifyResult: { data: { user: { id: string } | null }; error: unknown }

const verifyOtp = vi.fn(async () => verifyResult)
const ensureProfile = vi.fn(async (_id: string) => {})
const resolvePostAuthDestination = vi.fn(async (_id: string) => "/join")

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}))
vi.mock("@/lib/profile/profile-actions", () => ({
  ensureProfile: (id: string) => ensureProfile(id),
}))
vi.mock("@/lib/auth/post-auth-redirect", () => ({
  resolvePostAuthDestination: (id: string) => resolvePostAuthDestination(id),
}))

import { GET } from "@/app/auth/confirm/route"

/** Builds a confirm request URL with the given query params. */
function confirmRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/auth/confirm")
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

/** Returns the pathname of a route's redirect Response. */
function locationPath(res: Response): string {
  const loc = res.headers.get("location")
  if (!loc) throw new Error("expected a redirect Location header")
  return new URL(loc).pathname
}

beforeEach(() => {
  verifyResult = { data: { user: { id: "user-1" } }, error: null }
  verifyOtp.mockClear()
  ensureProfile.mockClear()
  resolvePostAuthDestination.mockClear()
})

describe("GET /auth/confirm", () => {
  it("routes a signup confirmation to the resolver's destination", async () => {
    resolvePostAuthDestination.mockResolvedValueOnce("/join")
    const res = await GET(
      confirmRequest({ token_hash: "tok", type: "signup" })
    )
    expect(locationPath(res)).toBe("/join")
    expect(ensureProfile).toHaveBeenCalledWith("user-1")
    expect(resolvePostAuthDestination).toHaveBeenCalledWith("user-1")
  })

  it("routes a recovery confirmation to /reset-password and never calls the resolver", async () => {
    const res = await GET(
      confirmRequest({ token_hash: "tok", type: "recovery" })
    )
    expect(locationPath(res)).toBe("/reset-password")
    expect(resolvePostAuthDestination).not.toHaveBeenCalled()
    // Recovery must not create profile side effects via this path either.
    expect(ensureProfile).not.toHaveBeenCalled()
  })

  it("honors an allowlisted explicit next over the resolver", async () => {
    const res = await GET(
      confirmRequest({ token_hash: "tok", type: "signup", next: "/my-plan" })
    )
    expect(locationPath(res)).toBe("/my-plan")
    expect(resolvePostAuthDestination).not.toHaveBeenCalled()
  })

  it("falls back to the resolver for a non-allowlisted next on signup", async () => {
    resolvePostAuthDestination.mockResolvedValueOnce("/join")
    const res = await GET(
      confirmRequest({ token_hash: "tok", type: "signup", next: "/evil" })
    )
    expect(locationPath(res)).toBe("/join")
    expect(resolvePostAuthDestination).toHaveBeenCalledWith("user-1")
  })

  it("falls back to /reset-password for a non-allowlisted next on recovery", async () => {
    const res = await GET(
      confirmRequest({ token_hash: "tok", type: "recovery", next: "/evil" })
    )
    expect(locationPath(res)).toBe("/reset-password")
    expect(resolvePostAuthDestination).not.toHaveBeenCalled()
  })

  it("redirects an invalid/expired token to /login?error=resetLinkInvalid", async () => {
    verifyResult = { data: { user: null }, error: { message: "expired" } }
    const res = await GET(
      confirmRequest({ token_hash: "bad", type: "signup" })
    )
    const loc = new URL(res.headers.get("location") as string)
    expect(loc.pathname).toBe("/login")
    expect(loc.searchParams.get("error")).toBe("resetLinkInvalid")
  })

  it("strips token params from the redirect URL", async () => {
    const res = await GET(
      confirmRequest({ token_hash: "tok", type: "signup" })
    )
    const loc = new URL(res.headers.get("location") as string)
    expect(loc.searchParams.has("token_hash")).toBe(false)
    expect(loc.searchParams.has("type")).toBe(false)
    expect(loc.searchParams.has("next")).toBe(false)
  })
})
