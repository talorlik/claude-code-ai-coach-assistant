import { generateObject } from "ai"

import type { Client } from "@/lib/db/mappers"
import type { LocaleTag } from "@/i18n/routing"
import {
  workoutPlanSchema,
  validateGeneratedPlan,
  type GeneratedPlan,
} from "@/lib/ai/schemas"
import {
  PLAN_SYSTEM_PROMPT,
  buildPlanUserPrompt,
  clientHasLimitations,
} from "@/lib/ai/prompts"

/**
 * Server-side AI workout-plan generation. The model call runs through the
 * Vercel AI SDK and the AI Gateway (configured via `AI_GATEWAY_API_KEY`),
 * exactly like the chat route, so no key ever reaches the browser. This module
 * is server-only: it must not be imported into a Client Component.
 */

/**
 * The model used for plan generation, routed through the AI Gateway by passing
 * a `provider/model` string (the Gateway is the default global provider). Plan
 * generation is a structured, reasoning-heavy task (and the same call backs
 * template creation and regeneration), so a stronger general-purpose model is
 * used here than for chat. GPT-4o is free-tier-eligible on the Gateway; the
 * previously configured `anthropic/claude-sonnet-4-6` is a paid-tier model that
 * the account cannot reach (see docs/AI_VERIFICATION.md).
 */
export const PLAN_MODEL = "openai/gpt-4o"

/**
 * Minimal shape of an object-generation call, matching the AI SDK's
 * `generateObject` for the fields this module uses. Declared as a seam so tests
 * can inject a fake generator and never touch the network or the Gateway.
 */
export type ObjectGenerator = (args: {
  model: string
  system: string
  prompt: string
  schema: typeof workoutPlanSchema
}) => Promise<{ object: unknown }>

/** Why a generation attempt failed, for logging and audit (`failed` events). */
export type GenerationFailureReason = "ai_error" | "invalid_output"

/** Outcome of a generation attempt. Never carries a partial plan on failure. */
export type GenerationResult =
  | { ok: true; plan: GeneratedPlan }
  | { ok: false; reason: GenerationFailureReason; issues?: string[] }

/**
 * Generates and validates a workout plan for a client. Builds the prompt from
 * the client's onboarding context, calls the model for a structured object,
 * then validates it with {@link validateGeneratedPlan} (including the stricter
 * per-exercise safety-note rule when the client reported limitations). Returns
 * a validated plan only when every check passes; otherwise a typed failure with
 * issue paths. Persistence is the caller's responsibility, so an invalid plan
 * is simply never handed onward to be saved.
 *
 * The `generate` parameter defaults to the SDK's `generateObject`; tests pass a
 * fake. Any throw from the model call (network, Gateway, timeout, refusal) is
 * caught and reported as `ai_error` rather than propagated, so the calling
 * server action can return a clean, localizable error.
 *
 * @param client - The onboarding profile to base the plan on.
 * @param localeTag - The plan's locale tag (drives output language).
 * @param generate - Object generator seam; defaults to `generateObject`.
 * @returns A validated plan, or a typed generation failure.
 */
export async function generateWorkoutPlan(
  client: Client,
  localeTag: LocaleTag,
  generate: ObjectGenerator = generateObject as unknown as ObjectGenerator
): Promise<GenerationResult> {
  const prompt = buildPlanUserPrompt(client, localeTag)

  let raw: unknown
  try {
    const result = await generate({
      model: PLAN_MODEL,
      system: PLAN_SYSTEM_PROMPT,
      prompt,
      schema: workoutPlanSchema,
    })
    raw = result.object
  } catch {
    // Network/Gateway/timeout/refusal: surface a typed failure, never throw.
    return { ok: false, reason: "ai_error" }
  }

  const validation = validateGeneratedPlan(raw, clientHasLimitations(client))
  if (!validation.ok) {
    return { ok: false, reason: "invalid_output", issues: validation.issues }
  }

  return { ok: true, plan: validation.plan }
}
