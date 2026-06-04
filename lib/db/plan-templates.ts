import { createClient } from "@/lib/supabase/server"
import type { PlanTemplateRow } from "@/lib/db/types"

/**
 * Server-only data access for the `plan_templates` table. Every call goes
 * through the request-scoped Supabase client, so the "Trainer admin manages
 * templates" RLS policy applies: only the trainer admin can read or write
 * templates, and clients have no access at all. The secret/admin client is
 * never used here.
 *
 * A template stores trainer-authored metadata (`title`, `description`,
 * `locale`) and a structured `payload` (a validated plan body). Callers must
 * validate the payload (see `validateTemplate`) before writing; this module
 * does not re-validate shape.
 */

/** Fields accepted when creating a plan template. */
export interface CreateTemplateInput {
  /** The trainer admin's auth user id (template owner). */
  createdBy: string
  /** Template title. */
  title: string
  /** Optional description. */
  description: string | null
  /** Optional locale tag the content is authored in. */
  locale: string | null
  /** The structured plan body to store as JSON. */
  payload: unknown
}

/** Fields accepted when updating a plan template (full metadata + body). */
export interface UpdateTemplateInput {
  /** New title. */
  title: string
  /** New description, or null to clear it. */
  description: string | null
  /** New locale tag, or null to clear it. */
  locale: string | null
  /** Replacement structured plan body. */
  payload: unknown
}

/**
 * Lists every plan template, newest first. RLS returns rows only for the
 * trainer admin; a non-admin session sees none. Throws loudly on a database
 * error so callers fail visibly rather than treating an error as "no
 * templates".
 *
 * @returns All templates ordered by creation time, newest first.
 */
export async function listTemplates(): Promise<PlanTemplateRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("plan_templates")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw new Error(`Failed to list plan templates: ${error.message}`)
  return data as PlanTemplateRow[]
}

/**
 * Loads a single template by id, or `null` when it does not exist or RLS hides
 * it. Throws on an unexpected database error.
 *
 * @param templateId - The template's id.
 * @returns The template row, or `null`.
 */
export async function getTemplate(
  templateId: string
): Promise<PlanTemplateRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("plan_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load plan template: ${error.message}`)
  return (data as PlanTemplateRow | null) ?? null
}

/**
 * Inserts a new plan template and returns the saved row. RLS enforces that the
 * caller is the trainer admin. Throws on a database error.
 *
 * @param input - Owner id, metadata, and the structured payload.
 * @returns The inserted template row.
 */
export async function createTemplate(
  input: CreateTemplateInput
): Promise<PlanTemplateRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("plan_templates")
    .insert({
      created_by: input.createdBy,
      title: input.title,
      description: input.description,
      locale: input.locale,
      payload: input.payload,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to create plan template: ${error?.message ?? "no row returned"}`
    )
  }
  return data as PlanTemplateRow
}

/**
 * Updates an existing template's metadata and payload, returning the saved row.
 * `updated_at` is maintained by the table's trigger. Throws on a database
 * error.
 *
 * @param templateId - The template to update.
 * @param input - Replacement metadata and payload.
 * @returns The updated template row.
 */
export async function updateTemplate(
  templateId: string,
  input: UpdateTemplateInput
): Promise<PlanTemplateRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("plan_templates")
    .update({
      title: input.title,
      description: input.description,
      locale: input.locale,
      payload: input.payload,
    })
    .eq("id", templateId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to update plan template: ${error?.message ?? "no row returned"}`
    )
  }
  return data as PlanTemplateRow
}

/**
 * Duplicates a template: reads the source row (RLS-scoped), then inserts a copy
 * owned by `createdBy` with a derived title. The copy is independent; later
 * edits to either template do not affect the other. Throws when the source does
 * not exist (or RLS hides it) or on a database error.
 *
 * @param templateId - The template to copy.
 * @param createdBy - The trainer admin's auth user id (owner of the copy).
 * @param titleSuffix - Appended to the source title to label the copy (e.g.
 *   `" (copy)"`); the result is length-clamped to the title column limit.
 * @returns The inserted copy.
 */
export async function duplicateTemplate(
  templateId: string,
  createdBy: string,
  titleSuffix: string
): Promise<PlanTemplateRow> {
  const source = await getTemplate(templateId)
  if (!source) {
    throw new Error(`Failed to duplicate plan template: source not found`)
  }

  // The title column is text with no hard cap in the schema, but the validator
  // caps it at 160; clamp here so a duplicated-then-edited template still
  // round-trips through validation.
  const title = `${source.title}${titleSuffix}`.slice(0, 160)

  return createTemplate({
    createdBy,
    title,
    description: source.description,
    locale: source.locale,
    payload: source.payload,
  })
}

/**
 * Deletes a template by id. RLS restricts this to the trainer admin. Throws on
 * a database error.
 *
 * @param templateId - The template to delete.
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("plan_templates")
    .delete()
    .eq("id", templateId)

  if (error) throw new Error(`Failed to delete plan template: ${error.message}`)
}
