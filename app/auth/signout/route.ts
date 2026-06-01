import { revalidatePath } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { REMEMBER_FLAG } from "@/lib/supabase/cookie-persistence"

/**
 * Signs the current user out, clears the session cookies, flushes server-
 * rendered caches that read the user, and redirects to /login. Signs out
 * unconditionally: a missing session is a no-op, and calling signOut still
 * scrubs any stale auth cookies.
 */
async function signOutAndRedirect(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  await supabase.auth.signOut()

  revalidatePath("/", "layout")

  const response = NextResponse.redirect(new URL("/login", req.url), {
    status: 302,
  })
  // Clear the remember-me choice so a fresh login starts from the default
  // persistent behavior rather than inheriting a prior session-only opt-out.
  response.cookies.delete(REMEMBER_FLAG)
  return response
}

/**
 * POST /auth/signout - the primary path (used by the sign-out form). POST means
 * the action cannot be triggered by a cross-site navigation or prefetch.
 */
export async function POST(req: NextRequest) {
  return signOutAndRedirect(req)
}

/**
 * GET /auth/signout - convenience so typing the URL in the address bar signs out
 * instead of dead-ending on a 404.
 *
 * A cross-site `<img>`, `<link rel=prefetch>`, or `<a>` would otherwise issue a
 * credentialed GET here and force-log-out the user (CSRF). Address-bar
 * navigations send no `Origin` header, while cross-site requests send a foreign
 * one; so allow only a missing or same-origin `Origin`. The POST path (used by
 * the sign-out form) is unaffected.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.redirect(new URL("/", req.url), { status: 302 })
  }
  return signOutAndRedirect(req)
}
