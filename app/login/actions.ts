"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { headers, cookies } from "next/headers"

import { createClient } from "@/lib/supabase/server"
import { isValidEmail } from "@/lib/auth/validation"
import { isAdmin } from "@/lib/auth/roles"
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
 * Signs an existing user in, then redirects by role: admins to /admin, everyone
 * else to /profile (or a safe ?redirect= target). Ensures a profile row exists.
 */
export async function login(formData: FormData) {
  const creds = readCredentials(formData)
  if (typeof creds === "string") {
    redirect(`/login?error=${creds}`)
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
    redirect(`/login?error=invalidCredentials`)
  }

  await ensureProfile(data.user.id)
  const admin = await isAdmin(data.user.id)

  revalidatePath("/", "layout")
  const target = safeRedirect(formData)
  redirect(target ?? (admin ? "/admin" : "/profile"))
}

/**
 * Registers a new user. Supabase sends a confirmation email; the session is
 * created only after the user clicks the link. The profile row is created at
 * confirmation time (see /auth/confirm).
 */
export async function signup(formData: FormData) {
  const creds = readCredentials(formData)
  if (typeof creds === "string") {
    redirect(`/login?tab=signup&error=${creds}`)
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
    redirect(`/login?tab=signup&error=signupFailed`)
  }

  // With email confirmation + anti-enumeration on, an already-registered email
  // returns success with an obfuscated user whose `identities` array is empty,
  // and no email is sent. Keep the notice generic so it neither confirms nor
  // denies the address is registered while staying accurate when no mail went.
  const alreadyRegistered = data.user?.identities?.length === 0
  const notice = alreadyRegistered
    ? "accountMaybeExists"
    : "checkEmailToConfirm"

  redirect(`/login?notice=${notice}`)
}
