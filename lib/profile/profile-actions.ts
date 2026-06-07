"use server"

import { revalidatePath } from "next/cache"
import { getLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"
import type { Profile, ProfileInput } from "@/lib/profile/profile-types"
import { validateProfile } from "@/lib/profile/profile-validation"
import { isValidEmail } from "@/lib/auth/validation"
import { combineE164 } from "@/lib/phone/phone"
import { countryByIso2 } from "@/lib/phone/countries"

/**
 * Locale-relative path the form wrappers redirect back to. The next-intl
 * `redirect` helper prefixes the active locale (`/en/profile`, `/he/profile`).
 */
const PROFILE_PATH = "/profile"

/**
 * Ensures a `profiles` row exists for the given user, creating an empty one if
 * absent. Idempotent. Called after authentication so every signed-in user has a
 * profile to edit. Failures are swallowed: a missing profile must never block
 * sign-in.
 */
export async function ensureProfile(userId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from("profiles")
    .upsert(
      { user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true }
    )
}

/**
 * Updates the current user's saved contact details (name, phone, and the
 * phone's country code). Validated server-side and written only to the caller's
 * own row (enforced by RLS).
 */
export async function updateProfile(
  input: ProfileInput
): Promise<ActionResult<Profile>> {
  const validation = validateProfile(input)
  if (!validation.ok) return validation

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("You must be signed in.")

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        full_name: validation.data.fullName,
        phone: validation.data.phone,
        country_iso2: validation.data.countryIso2,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single()

  if (error || !data) return fail("Could not save your details.")

  // The profile page is locale-prefixed (`/[locale]/profile`); revalidate the
  // dynamic route pattern so every locale's cached render is refreshed.
  revalidatePath("/[locale]/profile", "page")
  return ok(data as Profile)
}

/**
 * Changes the current user's email via Supabase Auth. Triggers a confirmation
 * email to the new address; the change takes effect only after confirmation.
 */
export async function updateEmail(email: string): Promise<ActionResult<null>> {
  const trimmed = email.trim().toLowerCase()
  if (!isValidEmail(trimmed)) {
    return fail("Enter a valid email address.", { email: "Invalid email." })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ email: trimmed })
  if (error) return fail("Could not update your email.")

  return ok(null)
}

/**
 * Changes the current user's password via Supabase Auth. Requires an active
 * session. Enforces a minimum length matching the signup policy.
 */
export async function updatePassword(
  password: string
): Promise<ActionResult<null>> {
  if (password.length < 8) {
    return fail("Password must be at least 8 characters.", {
      password: "Too short.",
    })
  }
  // Upper bound so a pathological input cannot tie up the password hasher.
  if (password.length > 1000) {
    return fail("Password is too long.", { password: "Too long." })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return fail("Could not update your password.")

  return ok(null)
}

/**
 * FormData-accepting wrapper around {@link updateProfile}, bound to the contact
 * details `<form action={...}>`. Reading from `FormData` and ending in a
 * `redirect` is what lets the form submit and report a result with JavaScript
 * disabled: the browser POSTs the form natively, the server handles it, and the
 * page re-renders with a localized banner driven by the `?notice`/`?error` code.
 * When JS is present React re-runs the same action over fetch, so the behavior
 * is identical in both modes.
 *
 * The redirect is the final statement on every branch and is never wrapped in a
 * try/catch: next-intl's `redirect` signals by throwing, so catching it would
 * swallow the navigation.
 *
 * The hidden `phone` input is deliberately NOT read: it cannot update without
 * JavaScript, so it is stale on the no-JS path. Instead the server is the single
 * source of truth - it recombines the submitted national number
 * (`phone-national`) with the selected country's dial code into E.164 via
 * {@link combineE164}, so the stored value is correct with or without JS.
 *
 * @param formData - The submitted form; reads `fullName`, `phone-national`, and
 * `countryIso2`.
 */
export async function updateProfileForm(formData: FormData): Promise<void> {
  const locale = await getLocale()
  const countryIso2 = String(formData.get("countryIso2") ?? "")
  const national = String(formData.get("phone-national") ?? "")
  const country = countryByIso2(countryIso2.trim().toUpperCase())
  // Server is authoritative: recombine the national number with the selected
  // country's dial code into E.164, so the value is correct with or without JS
  // (the hidden `phone` input cannot update client-side without JS). An unknown
  // country yields "", which validateProfile treats as a blank (optional) phone.
  const phone = country ? combineE164(country.dialCode, national) : ""
  const result = await updateProfile({
    fullName: String(formData.get("fullName") ?? ""),
    phone,
    countryIso2,
  })

  if (result.ok) {
    redirect({ href: `${PROFILE_PATH}?notice=detailsSaved`, locale })
  }
  redirect({ href: `${PROFILE_PATH}?error=saveFailed`, locale })
}

/**
 * FormData-accepting wrapper around {@link updateEmail}, bound to the email
 * `<form action={...}>`. See {@link updateProfileForm} for the no-JS submit
 * rationale. A malformed address is reported distinctly from an auth-layer
 * failure so the banner copy is specific.
 *
 * @param formData - The submitted form; reads `email`.
 */
export async function updateEmailForm(formData: FormData): Promise<void> {
  const locale = await getLocale()
  const result = await updateEmail(String(formData.get("email") ?? ""))

  if (result.ok) {
    redirect({ href: `${PROFILE_PATH}?notice=emailConfirmSent`, locale })
  } else {
    // A failing validation tags the `email` field; else it is an auth error.
    const code = result.fieldErrors?.email ? "invalidEmail" : "emailUpdateFailed"
    redirect({ href: `${PROFILE_PATH}?error=${code}`, locale })
  }
}

/**
 * FormData-accepting wrapper around {@link updatePassword}, bound to the
 * password `<form action={...}>`. The confirm-password match is re-checked here
 * because the client-side check does not run with JavaScript disabled. See
 * {@link updateProfileForm} for the no-JS submit rationale.
 *
 * @param formData - The submitted form; reads `password` and `confirmPassword`.
 */
export async function updatePasswordForm(formData: FormData): Promise<void> {
  const locale = await getLocale()
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  // Server-side confirm check: with JS off the client comparison never runs, so
  // this is the only guard. Bail before touching auth so a mismatch is cheap.
  if (password !== confirmPassword) {
    redirect({ href: `${PROFILE_PATH}?error=passwordsDoNotMatch`, locale })
  }

  const result = await updatePassword(password)

  if (result.ok) {
    redirect({ href: `${PROFILE_PATH}?notice=passwordUpdated`, locale })
  } else {
    // A failing length check tags the `password` field; else an auth error.
    const code = result.fieldErrors?.password
      ? "passwordTooShort"
      : "passwordUpdateFailed"
    redirect({ href: `${PROFILE_PATH}?error=${code}`, locale })
  }
}
