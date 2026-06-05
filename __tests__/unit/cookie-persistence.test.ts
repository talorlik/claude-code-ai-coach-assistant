import { describe, expect, it } from "vitest"

import {
  REMEMBER_FLAG,
  SESSION_ONLY,
  isAuthCookie,
  stripPersistence,
} from "@/lib/supabase/cookie-persistence"

/**
 * Unit tests for the remember-me cookie persistence helpers. These pure helpers
 * decide which cookies are Supabase auth cookies and how to make a cookie
 * session-scoped, which underpins the "remember me" behavior the build must
 * preserve. Driving them directly pins that logic without a live session.
 */

describe("cookie-persistence constants", () => {
  it("uses the documented flag name and session-only value", () => {
    expect(REMEMBER_FLAG).toBe("remember-me")
    expect(SESSION_ONLY).toBe("0")
  })
})

describe("isAuthCookie", () => {
  it("matches the base Supabase auth-token cookie", () => {
    expect(isAuthCookie("sb-abcdef-auth-token")).toBe(true)
  })

  it("matches numbered auth-token chunks", () => {
    expect(isAuthCookie("sb-abcdef-auth-token.0")).toBe(true)
    expect(isAuthCookie("sb-abcdef-auth-token.1")).toBe(true)
  })

  it("matches the PKCE code-verifier cookie", () => {
    expect(isAuthCookie("sb-abcdef-auth-token-code-verifier")).toBe(true)
  })

  it("does not match unrelated cookies", () => {
    expect(isAuthCookie(REMEMBER_FLAG)).toBe(false)
    expect(isAuthCookie("NEXT_LOCALE")).toBe(false)
    expect(isAuthCookie("theme")).toBe(false)
  })
})

describe("stripPersistence", () => {
  it("removes both maxAge and expires to make a cookie session-scoped", () => {
    const result = stripPersistence({
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
      expires: new Date("2099-01-01"),
      sameSite: "lax",
    })
    expect(result).not.toHaveProperty("maxAge")
    expect(result).not.toHaveProperty("expires")
    // Non-persistence options are preserved untouched.
    expect(result.path).toBe("/")
    expect(result.sameSite).toBe("lax")
  })

  it("never sets maxAge: 0, which would delete (log out) instead of expire", () => {
    const result = stripPersistence({ maxAge: 1000 })
    expect(result.maxAge).toBeUndefined()
  })

  it("does not mutate the input options object", () => {
    const input = { path: "/", maxAge: 999 }
    stripPersistence(input)
    expect(input.maxAge).toBe(999)
  })
})
