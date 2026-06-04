"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { upsertClient } from "@/lib/db/clients"
import type { Client } from "@/lib/db/mappers"
import { LOCALE_TAGS, type Locale, type LocaleTag } from "@/i18n/routing"
import { generateWorkoutPlan } from "@/lib/ai/generate-plan"
import {
  saveGeneratedPlan,
  recordGenerationEvent,
} from "@/lib/db/plan-persistence"
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
   * Whether a workout plan was generated and saved as part of this onboarding.
   * `false` means the profile was saved but plan generation failed (the AI call
   * errored or returned invalid output); the UI confirms the saved profile and
   * surfaces a "try again later" message rather than blocking the client.
   */
  planGenerated: boolean
}

/** Resolves a raw URL locale prefix to its full tag, defaulting to en-US. */
function resolveLocaleTag(locale: string | undefined): LocaleTag {
  return locale && locale in LOCALE_TAGS
    ? LOCALE_TAGS[locale as Locale]
    : LOCALE_TAGS.en
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
 * After the profile is saved, the action generates a workout plan via the
 * server-side AI flow and persists it. Generation failure is non-fatal: the
 * saved profile is kept and `planGenerated: false` is returned so the client is
 * not blocked. The profile save and the plan generation are independent, so a
 * persistence helper that throws on plan save does NOT undo the profile.
 *
 * @param input - The raw onboarding payload from the form.
 * @param locale - The active URL locale prefix (`"en"`/`"he"`); sets the plan's
 *   output language. Defaults to English when absent or unknown.
 * @returns The saved client and a plan-generation flag, or a field-keyed error.
 */
export async function saveOnboarding(
  input: OnboardingInput,
  locale?: string
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

  // Generate and persist a workout plan in the client's language. Any failure
  // is recorded as a `failed` generation event and reported as
  // planGenerated: false; the profile stays saved either way.
  const localeTag = resolveLocaleTag(locale)
  const generation = await generateWorkoutPlan(client, localeTag)

  if (!generation.ok) {
    await recordGenerationEvent({
      clientId: user.id,
      triggeredBy: user.id,
      source: "onboarding",
      status: "failed",
    })
    return ok({ client, planGenerated: false })
  }

  try {
    const saved = await saveGeneratedPlan({
      clientId: user.id,
      plan: generation.plan,
      localeTag,
      // First plan at onboarding: there is no prior active plan to archive.
      // Archiving is the regeneration path's concern (batch 14).
      archivePrevious: false,
    })
    await recordGenerationEvent({
      clientId: user.id,
      triggeredBy: user.id,
      source: "onboarding",
      status: "succeeded",
      planId: saved.plan.id,
    })
    // Surface the new plan on the plan view's cached render.
    revalidatePath("/[locale]/my-plan", "page")
    return ok({ client, planGenerated: true })
  } catch {
    // saveGeneratedPlan rolls back any partial plan before throwing; nothing
    // half-written is visible. Record the failure and keep the profile.
    await recordGenerationEvent({
      clientId: user.id,
      triggeredBy: user.id,
      source: "onboarding",
      status: "failed",
    })
    return ok({ client, planGenerated: false })
  }
}
