import { type EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/profile/profile-actions"

/**
 * GET /auth/confirm
 *
 * Supabase emails embed a URL with `token_hash` and `type`. This handler
 * exchanges the token for a session, ensures a profile row, and redirects to
 * `next` (default /profile; recovery links pass next=/reset-password). The
 * token params are stripped from the redirect so they do not leak.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  // `next` is externally controllable (anyone with a valid token can craft it).
  // Assigning it to `redirectTo.pathname` already keeps it same-host, but an
  // allowlist removes the open-ended landing surface entirely. Only the two
  // post-confirm destinations the email templates use are permitted.
  const ALLOWED_NEXT = ["/profile", "/reset-password"]
  const requestedNext = searchParams.get("next") ?? "/profile"
  const next = ALLOWED_NEXT.includes(requestedNext) ? requestedNext : "/profile"

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete("token_hash")
  redirectTo.searchParams.delete("type")
  redirectTo.searchParams.delete("next")

  if (token_hash && type) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      if (data.user) {
        await ensureProfile(data.user.id)
      }
      return NextResponse.redirect(redirectTo)
    }
  }

  // Verification failed (expired, already-used, or missing params).
  redirectTo.pathname = "/login"
  redirectTo.searchParams.set("error", "resetLinkInvalid")
  return NextResponse.redirect(redirectTo)
}
