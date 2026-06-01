"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { updatePassword } from "@/lib/profile/profile-actions"

/**
 * Sets a new password during recovery. Runs on the session established by
 * /auth/confirm, reusing `updatePassword`. On success the user is signed out and
 * sent to login, forcing a fresh sign-in. Validation is server-side and
 * authoritative; errors are stable codes resolved on the page.
 */
export async function setNewPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (password !== confirmPassword) {
    redirect(`/reset-password?error=passwordsDoNotMatch`)
  }

  const result = await updatePassword(password)
  if (!result.ok) {
    const code = result.fieldErrors?.password
      ? "passwordTooShort"
      : "updateFailed"
    redirect(`/reset-password?error=${code}`)
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")

  redirect(`/login?notice=passwordUpdated`)
}
