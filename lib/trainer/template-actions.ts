"use server"

import { revalidatePath } from "next/cache"

import { requireTrainerAdmin } from "@/lib/auth/require-user"
import {
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  getTemplate,
} from "@/lib/db/plan-templates"
import { getClient } from "@/lib/db/clients"
import {
  saveGeneratedPlan,
  recordGenerationEvent,
} from "@/lib/db/plan-persistence"
import { generateWorkoutPlan, type ObjectGenerator } from "@/lib/ai/generate-plan"
import {
  validateGeneratedPlan,
  type GeneratedPlan,
} from "@/lib/ai/schemas"
import type { Client } from "@/lib/db/mappers"
import type { PlanTemplateRow, WorkoutPlanRow } from "@/lib/db/types"
import { LOCALE_TAGS, type Locale, type LocaleTag } from "@/i18n/routing"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"
import {
  validateTemplate,
  type TemplateInput,
} from "@/lib/trainer/template-validation"

/**
 * Server actions for trainer plan-template management and assignment. Every
 * action is an independently callable entry point, so each re-runs the
 * authoritative {@link requireTrainerAdmin} guard (RLS is the database
 * backstop), validates its input through the shared validators, then writes
 * through the RLS-scoped data layer.
 *
 * AI is server-side only: the AI-assisted creation action calls
 * {@link generateWorkoutPlan}, which routes through the Vercel AI Gateway, so no
 * key ever reaches the browser. Invalid or partial AI output is never saved.
 *
 * Errors are returned as `ActionResult` failures (user-safe message plus
 * per-field codes the form localizes) rather than thrown, so forms present them
 * inline.
 */

/** Revalidates the trainer plans library page in both locales after a write. */
function revalidatePlansLibrary(): void {
  // `localePrefix: "always"` means the page lives under `/en` and `/he`;
  // revalidate both so a change in one locale shows if the trainer switches.
  revalidatePath("/en/trainer/plans")
  revalidatePath("/he/trainer/plans")
}

/** Revalidates a client's surfaces after a new plan is assigned to them. */
function revalidateClientPlan(clientId: string): void {
  revalidatePath("/en/my-plan")
  revalidatePath("/he/my-plan")
  revalidatePath(`/en/trainer/clients/${clientId}`)
  revalidatePath(`/he/trainer/clients/${clientId}`)
}

/** Resolves a raw locale tag to a {@link LocaleTag}, defaulting to en-US. */
function resolveLocaleTag(locale: string | null | undefined): LocaleTag {
  const tags = Object.values(LOCALE_TAGS) as LocaleTag[]
  if (locale && tags.includes(locale as LocaleTag)) return locale as LocaleTag
  return LOCALE_TAGS.en
}

/**
 * Creates a plan template from raw form input (manual authoring). The payload
 * is the structured plan body the trainer composed; it is validated through
 * {@link validateTemplate} before any write.
 *
 * @param input - Raw title, description, locale, and plan-body payload.
 * @returns The created template, or a validation/auth failure.
 */
export async function createTemplateAction(
  input: TemplateInput
): Promise<ActionResult<PlanTemplateRow>> {
  const adminId = await requireTrainerAdmin()

  const validation = validateTemplate(input)
  if (!validation.ok) return validation

  try {
    const template = await createTemplate({
      createdBy: adminId,
      title: validation.data.title,
      description: validation.data.description,
      locale: validation.data.locale,
      payload: validation.data.payload,
    })
    revalidatePlansLibrary()
    return ok(template)
  } catch {
    return fail("Could not create the template. Please try again.")
  }
}

/**
 * Updates an existing template's metadata and plan body.
 *
 * @param templateId - The template to update.
 * @param input - Raw replacement fields.
 * @returns The updated template, or a validation/auth failure.
 */
export async function updateTemplateAction(
  templateId: string,
  input: TemplateInput
): Promise<ActionResult<PlanTemplateRow>> {
  await requireTrainerAdmin()

  const validation = validateTemplate(input)
  if (!validation.ok) return validation

  try {
    const template = await updateTemplate(templateId, {
      title: validation.data.title,
      description: validation.data.description,
      locale: validation.data.locale,
      payload: validation.data.payload,
    })
    revalidatePlansLibrary()
    return ok(template)
  } catch {
    return fail("Could not update the template. Please try again.")
  }
}

/**
 * Duplicates a template, producing an independent copy owned by the admin with
 * a "(copy)" title suffix.
 *
 * @param templateId - The template to copy.
 * @returns The created copy, or an auth/data failure.
 */
export async function duplicateTemplateAction(
  templateId: string
): Promise<ActionResult<PlanTemplateRow>> {
  const adminId = await requireTrainerAdmin()

  try {
    const copy = await duplicateTemplate(templateId, adminId, " (copy)")
    revalidatePlansLibrary()
    return ok(copy)
  } catch {
    return fail("Could not duplicate the template. Please try again.")
  }
}

/** Result of assigning a template to a client: the concrete plan and counts. */
export interface AssignTemplateResult {
  /** The inserted active `workout_plans` row for the client. */
  plan: WorkoutPlanRow
  /** Workout sessions written. */
  workoutCount: number
  /** Exercises written across all sessions. */
  exerciseCount: number
}

/**
 * Assigns a template to a client, materializing it into a concrete, active
 * workout plan with its workouts and exercises. The template payload is
 * re-validated against the client's own limitations: if the client reported
 * injuries/limitations, every exercise must carry safety notes (the same rule
 * AI generation enforces), so a generic template that lacks them is rejected
 * for that client rather than silently assigned.
 *
 * The new plan archives the client's previous active plan (history preserved),
 * is stamped `source: "template"`, and a `plan_generation_events` audit row is
 * recorded. Persistence reuses {@link saveGeneratedPlan}, the single
 * never-save-a-partial-plan write path.
 *
 * @param templateId - The template to assign.
 * @param clientId - The target client's auth user id.
 * @returns The assigned plan and counts, or a validation/auth/data failure.
 */
export async function assignTemplateAction(
  templateId: string,
  clientId: string
): Promise<ActionResult<AssignTemplateResult>> {
  const adminId = await requireTrainerAdmin()

  let template: PlanTemplateRow | null
  let client: Client | null
  try {
    template = await getTemplate(templateId)
    client = await getClient(clientId)
  } catch {
    return fail("Could not load the template or client. Please try again.")
  }

  if (!template) return fail("That template no longer exists.")
  if (!client) return fail("That client could not be found.")

  // Re-validate the template body against THIS client's limitations. A template
  // is generic, so it may omit per-exercise safety notes; assigning it to a
  // client with declared limitations must still satisfy the safety rule.
  const hasLimitations = Boolean(client.limitations && client.limitations.trim())
  const validation = validateGeneratedPlan(template.payload, hasLimitations)
  if (!validation.ok) {
    return fail(
      "This template is missing safety notes required for this client. Edit the template before assigning."
    )
  }

  const localeTag = resolveLocaleTag(template.locale)

  try {
    const saved = await saveGeneratedPlan({
      clientId,
      plan: validation.plan,
      localeTag,
      archivePrevious: true,
      source: "template",
    })
    await recordGenerationEvent({
      clientId,
      triggeredBy: adminId,
      source: "template",
      status: "succeeded",
      planId: saved.plan.id,
      reason: `Assigned template "${template.title}"`,
    })
    revalidateClientPlan(clientId)
    return ok({
      plan: saved.plan,
      workoutCount: saved.workoutCount,
      exerciseCount: saved.exerciseCount,
    })
  } catch {
    await recordGenerationEvent({
      clientId,
      triggeredBy: adminId,
      source: "template",
      status: "failed",
      reason: `Failed to assign template "${template.title}"`,
    })
    return fail("Could not assign the template. Please try again.")
  }
}

/**
 * Builds a synthetic {@link Client} context from template metadata, so an
 * AI-assisted template can be generated without a real onboarded client. Only
 * the fields the plan prompt reads are populated; identity fields are
 * placeholders since the template is client-agnostic.
 */
function templateClientContext(input: {
  goal: string | null
  fitnessLevel: string | null
  location: string | null
  equipment: string[]
}): Client {
  return {
    userId: "template",
    fullName: null,
    phone: null,
    age: null,
    ageRange: null,
    goals: input.goal ? [input.goal] : [],
    fitnessLevel: input.fitnessLevel,
    limitations: null,
    availableDays: [],
    preferredLocation: input.location,
    equipment: input.equipment,
    notes: null,
    onboardedAt: null,
    createdAt: "",
    updatedAt: "",
  }
}

/** Raw inputs for AI-assisted template creation. */
export interface AiTemplateInput {
  /** Template title (required; AI fills the body, not the label). */
  title: string
  /** Optional description. */
  description?: string | null
  /** URL locale prefix (`"en"`/`"he"`) driving the generated content language. */
  locale: Locale
  /** Optional training goal to steer generation. */
  goal?: string | null
  /** Optional fitness level. */
  fitnessLevel?: string | null
  /** Optional preferred location (gym/home/outdoor). */
  location?: string | null
  /** Optional available equipment. */
  equipment?: string[]
}

/**
 * Creates a plan template whose body is generated by the AI plan service from
 * the trainer's goal/level/equipment inputs, then validated and saved. The
 * model call runs server-side through the AI Gateway; on any AI error or
 * invalid output nothing is saved and a localizable failure is returned. The
 * `generate` seam lets tests inject a fake generator (no network).
 *
 * @param input - Title, locale, and optional plan-shaping fields.
 * @param generate - Object-generator seam; defaults to the SDK generator.
 * @returns The created template, or an AI/validation/auth failure.
 */
export async function createAiTemplateAction(
  input: AiTemplateInput,
  generate?: ObjectGenerator
): Promise<ActionResult<PlanTemplateRow>> {
  const adminId = await requireTrainerAdmin()

  const title = input.title.trim()
  if (title === "") {
    return fail("Please correct the highlighted fields.", { title: "required" })
  }

  const localeTag = LOCALE_TAGS[input.locale]
  const context = templateClientContext({
    goal: input.goal ?? null,
    fitnessLevel: input.fitnessLevel ?? null,
    location: input.location ?? null,
    equipment: input.equipment ?? [],
  })

  const result = generate
    ? await generateWorkoutPlan(context, localeTag, generate)
    : await generateWorkoutPlan(context, localeTag)

  if (!result.ok) {
    return fail("The AI could not produce a valid plan. Please try again.")
  }

  const payload: GeneratedPlan = result.plan

  try {
    const template = await createTemplate({
      createdBy: adminId,
      title,
      description: (input.description ?? "").trim() || null,
      locale: localeTag,
      payload,
    })
    revalidatePlansLibrary()
    return ok(template)
  } catch {
    return fail("Could not save the generated template. Please try again.")
  }
}
