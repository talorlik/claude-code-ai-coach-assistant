"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"
import type { Profile, ProfileInput } from "@/lib/profile/profile-types"
import { validateProfile } from "@/lib/profile/profile-validation"
import { isValidEmail } from "@/lib/auth/validation"

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
 * Updates the current user's saved contact details (name and phone). Validated
 * server-side and written only to the caller's own row (enforced by RLS).
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
      },
      { onConflict: "user_id" }
    )
    .select()
    .single()

  if (error || !data) return fail("Could not save your details.")

  revalidatePath("/profile")
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

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return fail("Could not update your password.")

  return ok(null)
}
