"use server"

import { headers } from "next/headers"
import { getLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import { isValidEmail } from "@/lib/auth/validation"

/**
 * Sends a password-reset email via Supabase. The link routes through
 * /auth/confirm, which exchanges the recovery token for a session and then
 * redirects to /reset-password. Always reports the same generic notice
 * regardless of whether the email belongs to an account (no enumeration).
 */
export async function requestPasswordReset(formData: FormData) {
  const locale = await getLocale()
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()

  if (!isValidEmail(email)) {
    return redirect({ href: `/forgot-password?error=invalidEmail`, locale })
  }

  const captchaToken =
    String(formData.get("captchaToken") ?? "").trim() || undefined

  const h = await headers()
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${h.get("host") ?? "localhost:3000"}`.replace(
      /^https:\/\/localhost/,
      "http://localhost"
    )
  const supabase = await createClient()

  // Intentionally ignore the result: surfacing success/failure per-email would
  // leak account existence.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
    captchaToken,
  })

  return redirect({ href: `/forgot-password?notice=resetLinkSent`, locale })
}
