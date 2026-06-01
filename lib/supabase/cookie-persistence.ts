import type { CookieOptions } from "@supabase/ssr"

/**
 * Name of the flag cookie carrying the user's "remember me" choice across
 * requests. Absent means the default (persistent) behavior; a value of "0"
 * means session-only, so the auth cookies must be stripped of their expiry.
 *
 * The choice cannot live inside the Supabase auth cookies themselves: a
 * session cookie is sent by the browser without any expiry attribute, so the
 * server cannot observe persistence by inspecting them. A separate flag is the
 * only thing that survives across requests for the middleware to read.
 */
export const REMEMBER_FLAG = "remember-me"

/**
 * Value written when the user opts out of persistent login.
 */
export const SESSION_ONLY = "0"

/**
 * True when `name` is a Supabase auth cookie. Matches the base token cookie,
 * its numbered chunks (`...-auth-token.0`, `.1`, ...), and the PKCE
 * `...-code-verifier`, all of which share the `sb-` prefix.
 */
export function isAuthCookie(name: string): boolean {
  return name.startsWith("sb-")
}

/**
 * Returns cookie options with any persistence removed, making the cookie
 * session-scoped (cleared when the browser closes). `@supabase/ssr` hard-codes
 * a 400-day `maxAge` on every auth-cookie write, so the only place to override
 * it is here, at the `setAll` boundary just before the cookie is emitted.
 *
 * Does not set `maxAge: 0` - that is a deletion, which would log the user out
 * instead of making the session ephemeral.
 */
export function stripPersistence(options: CookieOptions): CookieOptions {
  const rest = { ...options }
  delete rest.maxAge
  delete rest.expires
  return rest
}
