"use server"

import { revalidatePath } from "next/cache"

import { requireTrainerAdmin } from "@/lib/auth/require-user"
import {
  createTrainerNote,
  updateTrainerNote,
  deleteTrainerNote,
} from "@/lib/db/trainer-notes"
import type { TrainerNoteRow } from "@/lib/db/types"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"
import { validateTrainerNote } from "@/lib/trainer/notes-validation"

/**
 * Server actions for trainer-note CRUD on the client dashboard. Each action is
 * an independently callable entry point, so it re-runs the authoritative
 * `requireTrainerAdmin` guard (RLS is the database backstop), validates input
 * through the shared {@link validateTrainerNote}, then performs the write via
 * the RLS-scoped data layer. On success the client's dashboard path is
 * revalidated so the rendered notes list reflects the change.
 *
 * Errors are returned as `ActionResult` failures with user-safe messages and
 * per-field error codes (which the form localizes) rather than thrown, so the
 * form can present them inline.
 */

/** Revalidates a client's dashboard page for both locales after a note change. */
function revalidateDashboard(clientId: string): void {
  // `localePrefix: "always"` means the page lives under `/en` and `/he`; revalidate
  // both so a note added in one locale is reflected if the trainer switches.
  revalidatePath(`/en/trainer/clients/${clientId}`)
  revalidatePath(`/he/trainer/clients/${clientId}`)
}

/**
 * Creates a private trainer note about a client.
 *
 * @param clientId - The client the note is about.
 * @param rawBody - The raw note text from the form.
 * @returns The created note on success, or a validation/auth failure.
 */
export async function createTrainerNoteAction(
  clientId: string,
  rawBody: string
): Promise<ActionResult<TrainerNoteRow>> {
  const adminId = await requireTrainerAdmin()

  const validation = validateTrainerNote(rawBody)
  if (!validation.ok) return validation

  try {
    const note = await createTrainerNote(clientId, adminId, validation.data.body)
    revalidateDashboard(clientId)
    return ok(note)
  } catch {
    return fail("Could not save the note. Please try again.")
  }
}

/**
 * Updates an existing trainer note's body.
 *
 * @param clientId - The client the note is about (used to revalidate the page).
 * @param noteId - The note's id.
 * @param rawBody - The replacement text from the form.
 * @returns The updated note on success, or a validation/auth failure.
 */
export async function updateTrainerNoteAction(
  clientId: string,
  noteId: string,
  rawBody: string
): Promise<ActionResult<TrainerNoteRow>> {
  await requireTrainerAdmin()

  const validation = validateTrainerNote(rawBody)
  if (!validation.ok) return validation

  try {
    const note = await updateTrainerNote(noteId, validation.data.body)
    revalidateDashboard(clientId)
    return ok(note)
  } catch {
    return fail("Could not update the note. Please try again.")
  }
}

/**
 * Deletes a trainer note.
 *
 * @param clientId - The client the note is about (used to revalidate the page).
 * @param noteId - The note's id.
 * @returns An empty success on completion, or an auth/database failure.
 */
export async function deleteTrainerNoteAction(
  clientId: string,
  noteId: string
): Promise<ActionResult<null>> {
  await requireTrainerAdmin()

  try {
    await deleteTrainerNote(noteId)
    revalidateDashboard(clientId)
    return ok(null)
  } catch {
    return fail("Could not delete the note. Please try again.")
  }
}
