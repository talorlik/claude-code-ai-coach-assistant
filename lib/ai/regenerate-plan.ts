import { getClient } from "@/lib/db/clients"
import {
  saveGeneratedPlan,
  recordGenerationEvent,
} from "@/lib/db/plan-persistence"
import { generateWorkoutPlan, type ObjectGenerator } from "@/lib/ai/generate-plan"
import type { LocaleTag } from "@/i18n/routing"
import type { WorkoutPlanRow } from "@/lib/db/types"

/**
 * Server-only orchestration for regenerating a client's workout plan while
 * preserving history. This is the single shared core behind both the client
 * self-service and trainer-triggered regeneration entry points, so the
 * archive-only-after-validation guarantee is defined in exactly one place.
 *
 * The flow, in order (batch tasks 4-9):
 *
 * 1. Load the latest onboarding/client profile (`getClient`) so the new plan
 *    reflects any profile edits since the last generation.
 * 2. Generate a plan via the server-side AI flow ({@link generateWorkoutPlan}),
 *    which validates the model output (including the per-exercise safety rule
 *    when the client has limitations) and never returns a partial plan.
 * 3. Only when generation succeeds, persist through {@link saveGeneratedPlan}
 *    with `archivePrevious: true` and `source: "regeneration"`: it archives the
 *    current active plan and inserts the new one as active in one shared
 *    never-save-a-partial-plan write path.
 * 4. Record a `plan_generation_events` audit row carrying the reason, on both
 *    success and failure, so the trainer dashboard's history is complete.
 *
 * Old plans and workout logs are preserved: archiving flips the prior plan's
 * `status`/`archived_at` rather than deleting it, and `workout_logs` reference
 * workouts under the archived plan, which remain in place. A failed AI call or
 * invalid output leaves the current active plan untouched, because archiving
 * happens only on the success branch.
 *
 * This module is server-only and must not be imported into a Client Component.
 * The AI call routes through the Vercel AI Gateway, so no key reaches the
 * browser. The `generate` seam lets tests inject a fake generator (no network).
 */

/** Why a regeneration attempt failed, for the caller's localizable error. */
export type RegenerationFailureReason =
  | "no_client"
  | "ai_error"
  | "save_error"

/** Outcome of a regeneration attempt; never carries a partial plan on failure. */
export type RegenerationResult =
  | {
      ok: true
      /** The newly inserted active plan row. */
      plan: WorkoutPlanRow
      /** Workout sessions written. */
      workoutCount: number
      /** Exercises written across all sessions. */
      exerciseCount: number
    }
  | { ok: false; reason: RegenerationFailureReason }

/** Inputs for {@link regeneratePlanForClient}. */
export interface RegeneratePlanInput {
  /** The owning client's auth user id (the plan is regenerated for them). */
  clientId: string
  /** The user who triggered it (the client themselves, or the trainer admin). */
  triggeredBy: string
  /** The plan's locale tag, driving the generated output language. */
  localeTag: LocaleTag
  /** The validated regeneration reason, recorded on the audit event. */
  reason: string
}

/**
 * Regenerates and persists a new active plan for a client, archiving the prior
 * active plan only after the new one validates, and recording an audit event.
 * See the module docstring for the full ordering and history-preservation
 * guarantees.
 *
 * @param input - Target client, trigger, locale, and the validated reason.
 * @param generate - Object-generator seam; defaults to the SDK generator so
 *   production goes through the AI Gateway and tests can inject a fake.
 * @returns The saved plan and counts, or a typed regeneration failure. Auth and
 *   reason validation are the caller's responsibility (the server actions).
 */
export async function regeneratePlanForClient(
  input: RegeneratePlanInput,
  generate?: ObjectGenerator
): Promise<RegenerationResult> {
  const { clientId, triggeredBy, localeTag, reason } = input

  // Load the latest profile so regeneration reflects any onboarding edits. A
  // missing client (or one hidden by RLS) cannot be regenerated for.
  const client = await getClient(clientId)
  if (!client) {
    return { ok: false, reason: "no_client" }
  }

  const generation = generate
    ? await generateWorkoutPlan(client, localeTag, generate)
    : await generateWorkoutPlan(client, localeTag)

  // AI errored or returned invalid output: record the failure and leave the
  // current active plan untouched (nothing is archived on this branch).
  if (!generation.ok) {
    await recordGenerationEvent({
      clientId,
      triggeredBy,
      source: "regeneration",
      status: "failed",
      reason,
    })
    return { ok: false, reason: "ai_error" }
  }

  try {
    const saved = await saveGeneratedPlan({
      clientId,
      plan: generation.plan,
      localeTag,
      // Archive the prior active plan, then insert the new one as active. Done
      // only here, after the plan has validated, so a bad generation never
      // replaces a working plan.
      archivePrevious: true,
      source: "regeneration",
    })
    await recordGenerationEvent({
      clientId,
      triggeredBy,
      source: "regeneration",
      status: "succeeded",
      planId: saved.plan.id,
      reason,
    })
    return {
      ok: true,
      plan: saved.plan,
      workoutCount: saved.workoutCount,
      exerciseCount: saved.exerciseCount,
    }
  } catch {
    // saveGeneratedPlan rolls back any partial plan before throwing; nothing
    // half-written is visible. Record the failure and report it.
    await recordGenerationEvent({
      clientId,
      triggeredBy,
      source: "regeneration",
      status: "failed",
      reason,
    })
    return { ok: false, reason: "save_error" }
  }
}
