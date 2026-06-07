"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getClient, upsertClient } from "@/lib/db/clients"
import { normalizePhone } from "@/lib/auth/validation"
import type { Client, ClientUpsertInput } from "@/lib/db/mappers"
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
  validateOnboardingStep,
  type OnboardingInput,
  type OnboardingStep,
} from "@/lib/validation/onboarding"

/** Payload returned to the client after a successful onboarding save. */
export interface OnboardingSaveResult {
  /** The persisted client profile. */
  client: Client
}

/** Payload returned after a plan-generation attempt. */
export interface PlanGenerationResult {
  /**
   * Whether a workout plan was generated and saved. `false` means generation
   * failed (the AI call errored or returned invalid output); the UI confirms
   * the saved profile and surfaces a "try again later" message rather than
   * blocking the client.
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
 * Builds the `clients` upsert payload for one wizard step from validated input.
 * Only the columns the step owns are included; every other field is left
 * `undefined` so {@link upsertClient} (via `toClientUpsertRow`, which omits
 * `undefined`) never clobbers data saved by another step. `onboardedAt` is
 * deliberately never set here - completion is stamped only by
 * {@link saveOnboardingDetails}, so a partially-filled resume is not mistaken
 * for a finished onboarding.
 */
function stepUpsertInput(
  step: OnboardingStep,
  userId: string,
  input: OnboardingInput
): ClientUpsertInput {
  if (step === 0) {
    // The step passed validateOnboardingStep, so normalize the same way the
    // full validator does: trim the name, normalize the phone, coerce the age.
    const age =
      input.age === "" || input.age === null || input.age === undefined
        ? null
        : Number(input.age)
    const phone = normalizePhone(input.phone ?? "")
    return {
      userId,
      fullName: (input.fullName ?? "").trim(),
      phone: phone || null,
      age: Number.isInteger(age) ? (age as number) : null,
      ageRange: input.ageRange || null,
    }
  }
  if (step === 1) {
    return {
      userId,
      goals: input.goals ?? [],
      fitnessLevel: input.fitnessLevel ?? null,
      preferredLocation: input.preferredLocation ?? null,
    }
  }
  return {
    userId,
    availableDays: input.availableDays ?? [],
    equipment: input.equipment ?? [],
    limitations: (input.limitations ?? "").trim() || null,
    notes: (input.notes ?? "").trim() || null,
  }
}

/**
 * Persists a single onboarding step so a client can leave mid-flow and resume.
 * Validates only the fields the step owns via {@link validateOnboardingStep}
 * (so the user is stopped on the same step instead of bounced after a full
 * submit), then upserts only that step's columns. Does NOT stamp `onboardedAt`
 * and does NOT trigger AI generation - both are the final step's concern.
 *
 * @param step - The wizard step index (0-2) being saved.
 * @param input - The raw payload; only the step's fields are read.
 * @returns The saved client, or a field-keyed error / auth error.
 */
export async function saveOnboardingStep(
  step: OnboardingStep,
  input: OnboardingInput
): Promise<ActionResult<OnboardingSaveResult>> {
  const fieldErrors = validateOnboardingStep(step, input)
  if (Object.keys(fieldErrors).length > 0) {
    return fail("invalid", fieldErrors)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("signedOut")

  let client: Client
  try {
    client = await upsertClient(stepUpsertInput(step, user.id, input))
  } catch {
    return fail("saveFailed")
  }

  // A returning client sees their saved answers on the cached `/[locale]/join`.
  revalidatePath("/[locale]/join", "page")
  return ok({ client })
}

/**
 * Validates and persists the complete onboarding profile, stamping
 * `onboardedAt` to mark completion. This is the final-step save; it does NOT
 * generate a plan - the UI enables a separate "Generate plan" action
 * ({@link generateOnboardingPlan}) only after this save succeeds.
 *
 * Validates server-side via {@link validateOnboarding} and writes only the
 * caller's own `clients` row through {@link upsertClient}, so RLS enforces
 * ownership. Re-running updates the existing row in place (conflict target
 * `user_id`), which is how a client edits their onboarding later.
 *
 * @param input - The raw onboarding payload from the form.
 * @returns The saved client, or a field-keyed error / auth error.
 */
export async function saveOnboardingDetails(
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
      goals: data.goals,
      fitnessLevel: data.fitnessLevel,
      limitations: data.limitations,
      availableDays: data.availableDays,
      preferredLocation: data.preferredLocation,
      equipment: data.equipment,
      notes: data.notes,
      // Stamp completion on the final save and on every subsequent edit; an ISO
      // string keeps the column a real timestamptz.
      onboardedAt: new Date().toISOString(),
    })
  } catch {
    // upsertClient throws a descriptive Error on a DB failure; surface a
    // user-safe, localizable code instead of leaking the message.
    return fail("saveFailed")
  }

  revalidatePath("/[locale]/join", "page")
  return ok({ client })
}

/**
 * Generates and persists a workout plan for the signed-in client from their
 * already-saved onboarding row. Decoupled from the profile save: the UI calls
 * this only after {@link saveOnboardingDetails} succeeds, so the client's
 * answers are guaranteed present. Re-reads the row via {@link getClient} rather
 * than trusting client-passed data.
 *
 * Generation failure is non-fatal: the saved profile is kept, a `failed`
 * generation event is recorded, and `planGenerated: false` is returned so the
 * client is not blocked.
 *
 * @param locale - The active URL locale prefix (`"en"`/`"he"`); sets the plan's
 *   output language. Defaults to English when absent or unknown.
 * @returns A plan-generation flag, or an auth / missing-profile error.
 */
export async function generateOnboardingPlan(
  locale?: string
): Promise<ActionResult<PlanGenerationResult>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("signedOut")

  // The profile must be saved before a plan can be generated.
  const client = await getClient(user.id)
  if (!client) return fail("saveFailed")

  const localeTag = resolveLocaleTag(locale)
  const generation = await generateWorkoutPlan(client, localeTag)

  if (!generation.ok) {
    await recordGenerationEvent({
      clientId: user.id,
      triggeredBy: user.id,
      source: "onboarding",
      status: "failed",
    })
    return ok({ planGenerated: false })
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
    return ok({ planGenerated: true })
  } catch {
    // saveGeneratedPlan rolls back any partial plan before throwing; nothing
    // half-written is visible. Record the failure and keep the profile.
    await recordGenerationEvent({
      clientId: user.id,
      triggeredBy: user.id,
      source: "onboarding",
      status: "failed",
    })
    return ok({ planGenerated: false })
  }
}
