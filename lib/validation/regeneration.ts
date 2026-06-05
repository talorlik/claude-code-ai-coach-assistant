import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"

/**
 * Pure validation for a plan-regeneration reason. Regeneration is a destructive
 * operation (it archives the current active plan and replaces it), so the batch
 * requires a reason on every trigger: it both forces intent and seeds the
 * `plan_generation_events` audit row the trainer dashboard relies on. Kept
 * dependency-free so the server actions (authoritative) and the forms (fast
 * feedback) share one definition of "valid"; the validated reason is trimmed so
 * callers persist exactly what was checked.
 */

/** Minimum length of a regeneration reason, in characters (after trimming). */
export const REGENERATION_REASON_MIN_LENGTH = 3

/** Maximum length of a regeneration reason, in characters. */
export const REGENERATION_REASON_MAX_LENGTH = 500

/** The validated, ready-to-persist regeneration fields. */
export interface ValidatedRegeneration {
  /** Trimmed reason within the length bounds. */
  reason: string
}

/**
 * Validates and trims a regeneration reason. The reason must be present and,
 * after trimming, at least {@link REGENERATION_REASON_MIN_LENGTH} and at most
 * {@link REGENERATION_REASON_MAX_LENGTH} characters. On failure a per-field
 * `reason` error code (`required` | `tooShort` | `tooLong`) is returned so the
 * triggering form can localize it. Requiring the reason satisfies task 3 of the
 * batch ("require regeneration reason").
 *
 * @param rawReason - The raw reason text from the form.
 * @returns A success result carrying the trimmed reason, or a field-error
 *   failure.
 */
export function validateRegenerationReason(
  rawReason: string | null | undefined
): ActionResult<ValidatedRegeneration> {
  const reason = (rawReason ?? "").trim()

  if (reason === "") {
    return fail("Please correct the highlighted fields.", {
      reason: "required",
    })
  }
  if (reason.length < REGENERATION_REASON_MIN_LENGTH) {
    return fail("Please correct the highlighted fields.", {
      reason: "tooShort",
    })
  }
  if (reason.length > REGENERATION_REASON_MAX_LENGTH) {
    return fail("Please correct the highlighted fields.", {
      reason: "tooLong",
    })
  }

  return ok({ reason })
}
