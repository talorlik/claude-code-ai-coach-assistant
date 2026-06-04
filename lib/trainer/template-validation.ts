import {
  validateGeneratedPlan,
  type GeneratedPlan,
} from "@/lib/ai/schemas"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"

/**
 * Pure validation for trainer plan templates. A template is a reusable plan
 * blueprint: trainer-authored metadata (title, optional description, optional
 * locale tag) wrapping a structured plan body. The body reuses the exact
 * {@link GeneratedPlan} contract that AI generation and persistence already
 * share, so a template can be assigned to a client and persisted through the
 * same {@link saveGeneratedPlan} path without any shape translation.
 *
 * Kept dependency-free (no Supabase, no request) so the server actions
 * (authoritative) and the integration tests use one definition of "valid".
 */

/** Maximum length of a template title, in characters. */
export const TEMPLATE_TITLE_MAX_LENGTH = 160

/** Maximum length of a template description, in characters. */
export const TEMPLATE_DESCRIPTION_MAX_LENGTH = 2000

/** Supported template locale tags, matching the app's locale identities. */
export const TEMPLATE_LOCALES = ["en-US", "he-IL"] as const

/** A locale tag a template may be authored in. */
export type TemplateLocale = (typeof TEMPLATE_LOCALES)[number]

/** The validated, ready-to-persist template fields. */
export interface ValidatedTemplate {
  /** Trimmed, non-empty title within the length limit. */
  title: string
  /** Trimmed description, or null when omitted. */
  description: string | null
  /** Locale tag the template content is written in, or null when unspecified. */
  locale: TemplateLocale | null
  /** The validated structured plan body. */
  payload: GeneratedPlan
}

/** Raw, untrusted template input as it arrives from a form or another action. */
export interface TemplateInput {
  /** Raw title text. */
  title: string
  /** Raw description text; empty/whitespace is treated as omitted. */
  description?: string | null
  /** Raw locale tag; anything outside {@link TEMPLATE_LOCALES} is rejected. */
  locale?: string | null
  /** The candidate plan body (typically parsed JSON or a generated plan). */
  payload: unknown
}

/** Narrows an arbitrary string to a supported {@link TemplateLocale}. */
function isTemplateLocale(value: string): value is TemplateLocale {
  return (TEMPLATE_LOCALES as readonly string[]).includes(value)
}

/**
 * Validates and normalizes a raw template. The title must be non-empty after
 * trimming and within {@link TEMPLATE_TITLE_MAX_LENGTH}; the description is
 * optional and length-capped; the locale, when present, must be a supported
 * tag. The plan body is validated through {@link validateGeneratedPlan} with
 * `hasLimitations` false: a template is generic (not tied to one client's
 * declared injuries), so the per-exercise safety-note rule that depends on a
 * specific client is not enforced here. It is re-enforced for that client's
 * limitations at assignment time by the assigning action.
 *
 * Returns a discriminated `ActionResult` rather than throwing, with per-field
 * error codes the form localizes (`title`, `description`, `locale`, `payload`).
 *
 * @param input - The untrusted template fields.
 * @returns The validated template, or a field-error failure.
 */
export function validateTemplate(
  input: TemplateInput
): ActionResult<ValidatedTemplate> {
  const title = input.title.trim()
  if (title === "") {
    return fail("Please correct the highlighted fields.", { title: "required" })
  }
  if (title.length > TEMPLATE_TITLE_MAX_LENGTH) {
    return fail("Please correct the highlighted fields.", { title: "tooLong" })
  }

  const rawDescription = (input.description ?? "").trim()
  if (rawDescription.length > TEMPLATE_DESCRIPTION_MAX_LENGTH) {
    return fail("Please correct the highlighted fields.", {
      description: "tooLong",
    })
  }
  const description = rawDescription === "" ? null : rawDescription

  let locale: TemplateLocale | null = null
  const rawLocale = (input.locale ?? "").trim()
  if (rawLocale !== "") {
    if (!isTemplateLocale(rawLocale)) {
      return fail("Please correct the highlighted fields.", {
        locale: "invalid",
      })
    }
    locale = rawLocale
  }

  const planValidation = validateGeneratedPlan(input.payload, false)
  if (!planValidation.ok) {
    return fail("Please correct the highlighted fields.", {
      payload: "invalid",
    })
  }

  return ok({ title, description, locale, payload: planValidation.plan })
}
