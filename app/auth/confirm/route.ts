import { type EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/profile/profile-actions"
import { resolvePostAuthDestination } from "@/lib/auth/post-auth-redirect"

/**
 * Allowlisted post-confirm landing paths. An explicit, allowlisted `next` from
 * the email link is honored verbatim; anything else falls through to the
 * type-based decision below. `/join` and `/my-plan` were added so the signup
 * journey can route a confirmed user straight into onboarding or their plan.
 */
const ALLOWED_NEXT = ["/profile", "/reset-password", "/join", "/my-plan"]

/**
 * GET /auth/confirm
 *
 * Supabase emails embed a URL with `token_hash` and `type`. This handler
 * exchanges the token for a session, ensures a profile row (for non-recovery
 * confirmations), and redirects to the right destination. The token params are
 * stripped from the redirect so they do not leak.
 *
 * Landing decision (only after a successful token exchange):
 * 1. An explicit, allowlisted `next` always wins (e.g. `/my-plan`).
 * 2. Otherwise `type === "recovery"` -> `/reset-password`. Password recovery is
 *    hard-insulated from the signup flow: this branch NEVER calls
 *    {@link resolvePostAuthDestination}, so a reset link can never leak into
 *    onboarding or the plan view.
 * 3. Otherwise (signup, email-change, invite) -> the destination chosen by
 *    {@link resolvePostAuthDestination} for the confirmed user.
 *
 * An invalid/expired/used token redirects to `/login?error=resetLinkInvalid`.
 * The destination is written as a non-localized pathname; next-intl applies the
 * active locale prefix on the redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  // `next` is externally controllable (anyone with a valid token can craft it),
  // so it is constrained to the allowlist. An allowlisted value is treated as an
  // explicit override; anything else (including the absence of `next`) defers to
  // the type-based decision and the resolver.
  const requestedNext = searchParams.get("next")
  const explicitNext =
    requestedNext && ALLOWED_NEXT.includes(requestedNext) ? requestedNext : null

  const redirectTo = request.nextUrl.clone()
  redirectTo.searchParams.delete("token_hash")
  redirectTo.searchParams.delete("type")
  redirectTo.searchParams.delete("next")

  if (token_hash && type) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      if (explicitNext) {
        // An explicit, allowlisted destination overrides the decision flow.
        // Recovery confirmations still ensure no profile side effects below.
        if (type !== "recovery" && data.user) {
          await ensureProfile(data.user.id)
        }
        redirectTo.pathname = explicitNext
        return NextResponse.redirect(redirectTo)
      }

      if (type === "recovery") {
        // Recovery NEVER enters the onboarding/my-plan decision flow.
        redirectTo.pathname = "/reset-password"
        return NextResponse.redirect(redirectTo)
      }

      // Signup, email-change, and invite confirmations: create the profile row,
      // then let the shared resolver decide the destination by account state.
      if (data.user) {
        await ensureProfile(data.user.id)
        redirectTo.pathname = await resolvePostAuthDestination(data.user.id)
      } else {
        redirectTo.pathname = "/profile"
      }
      return NextResponse.redirect(redirectTo)
    }
  }

  // Verification failed (expired, already-used, or missing params).
  redirectTo.pathname = "/login"
  redirectTo.searchParams.set("error", "resetLinkInvalid")
  return NextResponse.redirect(redirectTo)
}
