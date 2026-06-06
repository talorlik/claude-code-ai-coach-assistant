"use server"

import { revalidatePath } from "next/cache"
import { headers, cookies } from "next/headers"
import { getLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import { isValidEmail } from "@/lib/auth/validation"
import { resolvePostAuthDestination } from "@/lib/auth/post-auth-redirect"
import { ensureProfile } from "@/lib/profile/profile-actions"
import { REMEMBER_FLAG, SESSION_ONLY } from "@/lib/supabase/cookie-persistence"

const MIN_PASSWORD_LENGTH = 8

type Credentials = { email: string; password: string }

/**
 * Reads the Turnstile token a form carries in its hidden `captchaToken` field,
 * or `undefined` when empty. `undefined` (not `""`) lets it spread into
 * Supabase's `options` without forcing a captcha when none is configured.
 */
function readCaptchaToken(formData: FormData): string | undefined {
  const token = String(formData.get("captchaToken") ?? "").trim()
  return token || undefined
}

/**
 * Returns a safe in-app redirect target from a submitted form, or null. Only
 * same-site absolute-path values (a single leading `/`) are allowed, preventing
 * open redirects to external hosts or protocol-relative URLs.
 */
function safeRedirect(formData: FormData): string | null {
  const raw = String(formData.get("redirect") ?? "").trim()
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw
  return null
}

/**
 * Reads and server-side-validates credentials. Returns normalized credentials
 * or a stable error code. Validation does not depend on HTML form attributes,
 * which a client can bypass.
 */
function readCredentials(formData: FormData): Credentials | string {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) return "credentialsRequired"
  if (!isValidEmail(email)) return "invalidEmail"
  if (password.length < MIN_PASSWORD_LENGTH) return "passwordTooShort"
  return { email, password }
}

/**
 * Signs an existing user in, then redirects to the right post-auth destination.
 *
 * Precedence: a safe same-site `?redirect=` target (carried on the form) always
 * wins, preserving the "return to where you were" behavior. With no such target,
 * {@link resolvePostAuthDestination} decides by account state - admins to
 * `/admin`, un-onboarded clients to `/join`, onboarded clients with a plan to
 * `/my-plan`. Ensures a profile row exists and honors the remember-me choice.
 */
export async function login(formData: FormData) {
  const locale = await getLocale()
  const creds = readCredentials(formData)
  if (typeof creds === "string") {
    return redirect({ href: `/login?error=${creds}`, locale })
  }

  // Record the remember-me choice BEFORE signing in so the cookie write
  // triggered by signInWithPassword reads it in the same request. Only the
  // opt-out is stored, as a session cookie so it too clears on browser close.
  const remember = formData.get("remember") !== null
  const cookieStore = await cookies()
  if (remember) {
    cookieStore.delete(REMEMBER_FLAG)
  } else {
    cookieStore.set(REMEMBER_FLAG, SESSION_ONLY, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      // Never transmit the preference flag over plaintext in production.
      secure: process.env.NODE_ENV === "production",
    })
  }

  const captchaToken = readCaptchaToken(formData)
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
    options: { captchaToken },
  })

  if (error || !data.user) {
    // Generic message: do not reveal whether the email exists.
    return redirect({ href: `/login?error=invalidCredentials`, locale })
  }

  await ensureProfile(data.user.id)

  revalidatePath("/", "layout")
  // A safe same-site ?redirect= target takes precedence; otherwise the shared
  // resolver decides where this account belongs.
  const target =
    safeRedirect(formData) ?? (await resolvePostAuthDestination(data.user.id))
  return redirect({ href: target, locale })
}

/**
 * Registers a new user. Supabase sends a confirmation email; the session is
 * created only after the user clicks the link. The profile row is created at
 * confirmation time (see /auth/confirm).
 */
export async function signup(formData: FormData) {
  const locale = await getLocale()
  const creds = readCredentials(formData)
  if (typeof creds === "string") {
    return redirect({ href: `/login?tab=signup&error=${creds}`, locale })
  }

  const h = await headers()
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${h.get("host") ?? "localhost:3000"}`.replace(
      /^https:\/\/localhost/,
      "http://localhost"
    )

  const captchaToken = readCaptchaToken(formData)
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: creds.email,
    password: creds.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      captchaToken,
    },
  })

  if (error) {
    return redirect({ href: `/login?tab=signup&error=signupFailed`, locale })
  }

  // With email confirmation + anti-enumeration on, an already-registered email
  // returns success with an obfuscated user whose `identities` array is empty,
  // and no email is sent. Keep the notice generic so it neither confirms nor
  // denies the address is registered while staying accurate when no mail went.
  const alreadyRegistered = data.user?.identities?.length === 0
  const notice = alreadyRegistered
    ? "accountMaybeExists"
    : "checkEmailToConfirm"

  return redirect({ href: `/login?notice=${notice}`, locale })
}
