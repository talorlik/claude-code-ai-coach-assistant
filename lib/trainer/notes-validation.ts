import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"

/**
 * Pure validation for a private trainer note's body. Kept dependency-free so it
 * is shared verbatim by the server action (authoritative) and the form (for
 * fast feedback), guaranteeing one definition of "valid". The validated body is
 * trimmed, so callers persist exactly what was checked.
 */

/** Maximum length of a trainer note body, in characters. */
export const TRAINER_NOTE_MAX_LENGTH = 2000

/** The validated, ready-to-persist note fields. */
export interface ValidatedTrainerNote {
  /** Trimmed, non-empty note body within the length limit. */
  body: string
}

/**
 * Validates and trims a trainer-note body. The body must be non-empty after
 * trimming and at most {@link TRAINER_NOTE_MAX_LENGTH} characters. On failure a
 * per-field `body` error code is returned so the form can localize it.
 *
 * @param rawBody - The raw note text from the form.
 * @returns A success result carrying the trimmed body, or a field-error failure.
 */
export function validateTrainerNote(
  rawBody: string
): ActionResult<ValidatedTrainerNote> {
  const body = rawBody.trim()

  if (body === "") {
    return fail("Please correct the highlighted fields.", {
      body: "required",
    })
  }
  if (body.length > TRAINER_NOTE_MAX_LENGTH) {
    return fail("Please correct the highlighted fields.", {
      body: "tooLong",
    })
  }

  return ok({ body })
}
