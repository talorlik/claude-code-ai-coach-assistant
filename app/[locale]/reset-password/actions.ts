"use server"

import { revalidatePath } from "next/cache"
import { getLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import { updatePassword } from "@/lib/profile/profile-actions"

/**
 * Sets a new password during recovery. Runs on the session established by
 * /auth/confirm, reusing `updatePassword`. On success the user is signed out and
 * sent to login, forcing a fresh sign-in. Validation is server-side and
 * authoritative; errors are stable codes resolved on the page.
 */
export async function setNewPassword(formData: FormData) {
  const locale = await getLocale()
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (password !== confirmPassword) {
    return redirect({ href: `/reset-password?error=passwordsDoNotMatch`, locale })
  }

  const result = await updatePassword(password)
  if (!result.ok) {
    const code = result.fieldErrors?.password
      ? "passwordTooShort"
      : "updateFailed"
    return redirect({ href: `/reset-password?error=${code}`, locale })
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")

  return redirect({ href: `/login?notice=passwordUpdated`, locale })
}
