"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { upsertClient } from "@/lib/db/clients"
import type { Client } from "@/lib/db/mappers"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"
import {
  validateOnboarding,
  type OnboardingInput,
} from "@/lib/validation/onboarding"

/** Payload returned to the client after a successful onboarding save. */
export interface OnboardingSaveResult {
  /** The persisted client profile. */
  client: Client
  /**
   * Whether a workout plan was generated as part of this save. Batch 08 wires
   * real generation; until then this is always `false` and the UI shows the
   * "Create my workout plan" affordance without a plan yet existing.
   */
  planGenerated: boolean
}

/**
 * Persists a client's onboarding answers, then (in a later batch) kicks off AI
 * plan generation. Validates server-side via {@link validateOnboarding} and
 * writes only the caller's own `clients` row through {@link upsertClient}, so
 * RLS enforces ownership. Re-running the action updates the existing row in
 * place (the upsert conflict target is `user_id`), which is how a client edits
 * their onboarding later.
 *
 * On a validation failure the per-field error codes from the validator are
 * passed through unchanged so the client form can localize them. On an auth
 * failure (no session) a generic signed-out error is returned; the page guard
 * normally prevents reaching this state, but the action re-checks because a
 * server action is an independently callable entry point.
 *
 * @param input - The raw onboarding payload from the form.
 * @returns The saved client and a plan-generation flag, or a field-keyed error.
 */
export async function saveOnboarding(
  input: OnboardingInput
): Promise<ActionResult<OnboardingSaveResult>> {
  const validation = validateOnboarding(input)
  if (!validation.ok) return validation

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("signedOut")

  const data = validation.data

  let client: Client
  try {
    client = await upsertClient({
      userId: user.id,
      fullName: data.fullName,
      phone: data.phone || null,
      age: data.age,
      ageRange: data.ageRange,
      goal: data.goal,
      fitnessLevel: data.fitnessLevel,
      limitations: data.limitations,
      availableDays: data.availableDays,
      preferredLocation: data.preferredLocation,
      equipment: data.equipment,
      notes: data.notes,
      // Stamp completion the first time and on every subsequent edit; an ISO
      // string keeps the column a real timestamptz.
      onboardedAt: new Date().toISOString(),
    })
  } catch {
    // upsertClient throws a descriptive Error on a DB failure; surface a
    // user-safe, localizable code instead of leaking the message.
    return fail("saveFailed")
  }

  // Onboarding lives at `/[locale]/join`; refresh every locale's cached render
  // so a returning client sees their saved answers.
  revalidatePath("/[locale]/join", "page")

  // Batch 08 replaces this with real, validated AI plan generation. Until then
  // we persist onboarding and report that no plan was generated yet.
  return ok({ client, planGenerated: false })
}
