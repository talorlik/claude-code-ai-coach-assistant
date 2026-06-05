"use server"

import { revalidatePath } from "next/cache"
import { getLocale } from "next-intl/server"

import { requireClient, requireTrainerAdmin } from "@/lib/auth/require-user"
import { regeneratePlanForClient } from "@/lib/ai/regenerate-plan"
import type { ObjectGenerator } from "@/lib/ai/generate-plan"
import { LOCALE_TAGS, type Locale, type LocaleTag } from "@/i18n/routing"
import type { WorkoutPlanRow } from "@/lib/db/types"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"
import { validateRegenerationReason } from "@/lib/validation/regeneration"

/**
 * Server actions for plan regeneration, the client-facing and trainer-facing
 * entry points the My Plan page and the client dashboard call. Each action is an
 * independently callable entry point, so each re-runs the authoritative auth
 * guard (RLS is the database backstop), validates the reason through the shared
 * {@link validateRegenerationReason}, then delegates the archive-on-validate
 * orchestration to {@link regeneratePlanForClient}. The AI call is server-side
 * only via the Vercel AI Gateway; invalid or partial output is never saved.
 *
 * Failures are returned as `ActionResult` failures (a user-safe message plus an
 * optional per-field code) rather than thrown, so the forms present them inline.
 */

/** Payload returned on a successful regeneration. */
export interface RegenerateResult {
  /** The newly inserted active plan row. */
  plan: WorkoutPlanRow
  /** Workout sessions written. */
  workoutCount: number
  /** Exercises written across all sessions. */
  exerciseCount: number
}

/** Resolves the active URL locale to a {@link LocaleTag}, defaulting to en-US. */
async function activeLocaleTag(): Promise<LocaleTag> {
  const locale = (await getLocale()) as Locale
  return LOCALE_TAGS[locale] ?? LOCALE_TAGS.en
}

/** Revalidates a client's plan surfaces in both locales after regeneration. */
function revalidateClientPlan(clientId: string): void {
  revalidatePath("/en/my-plan")
  revalidatePath("/he/my-plan")
  revalidatePath(`/en/trainer/clients/${clientId}`)
  revalidatePath(`/he/trainer/clients/${clientId}`)
}

/**
 * Maps a {@link regeneratePlanForClient} failure to a user-safe message code the
 * regeneration forms localize under their `errors` namespace.
 */
function failureMessage(reason: "no_client" | "ai_error" | "save_error"): string {
  switch (reason) {
    case "no_client":
      return "noClient"
    case "ai_error":
      return "aiError"
    case "save_error":
      return "saveError"
  }
}

/**
 * Regenerates the signed-in client's own active plan. Requires an authenticated
 * client session, validates the reason, and regenerates for the caller's own id
 * in the active locale. The previous plan and its logs are preserved (archived,
 * not deleted) by the shared orchestration.
 *
 * @param rawReason - The required, free-text reason for regenerating.
 * @param generate - Object-generator seam; defaults to the SDK generator. Tests
 *   pass a fake so no network call is made.
 * @returns The new active plan and counts, or a validation/auth/AI failure.
 */
export async function regenerateMyPlanAction(
  rawReason: string,
  generate?: ObjectGenerator
): Promise<ActionResult<RegenerateResult>> {
  const userId = await requireClient()

  const validation = validateRegenerationReason(rawReason)
  if (!validation.ok) return validation

  const localeTag = await activeLocaleTag()
  const result = await regeneratePlanForClient(
    {
      clientId: userId,
      triggeredBy: userId,
      localeTag,
      reason: validation.data.reason,
    },
    generate
  )

  if (!result.ok) {
    return fail(failureMessage(result.reason))
  }

  revalidateClientPlan(userId)
  return ok({
    plan: result.plan,
    workoutCount: result.workoutCount,
    exerciseCount: result.exerciseCount,
  })
}

/**
 * Regenerates a given client's active plan on behalf of the trainer admin.
 * Requires the trainer-admin role, validates the reason, and regenerates for the
 * target client; the audit event records the admin as the trigger and the
 * client as the owner. History (old plans and logs) is preserved.
 *
 * @param clientId - The target client's auth user id.
 * @param rawReason - The required, free-text reason for regenerating.
 * @param generate - Object-generator seam; defaults to the SDK generator. Tests
 *   pass a fake so no network call is made.
 * @returns The new active plan and counts, or a validation/auth/AI failure.
 */
export async function regenerateClientPlanAction(
  clientId: string,
  rawReason: string,
  generate?: ObjectGenerator
): Promise<ActionResult<RegenerateResult>> {
  const adminId = await requireTrainerAdmin()

  const validation = validateRegenerationReason(rawReason)
  if (!validation.ok) return validation

  const localeTag = await activeLocaleTag()
  const result = await regeneratePlanForClient(
    {
      clientId,
      triggeredBy: adminId,
      localeTag,
      reason: validation.data.reason,
    },
    generate
  )

  if (!result.ok) {
    return fail(failureMessage(result.reason))
  }

  revalidateClientPlan(clientId)
  return ok({
    plan: result.plan,
    workoutCount: result.workoutCount,
    exerciseCount: result.exerciseCount,
  })
}
