import { createClient } from "@/lib/supabase/server"
import type { TrainerNoteRow } from "@/lib/db/types"

/**
 * Server-only data access for the `trainer_notes` table. Every call goes through
 * the request-scoped Supabase client, so the "Trainer admin manages notes" RLS
 * policy applies: only the trainer admin's session can read or write these
 * private notes, and a non-admin session sees nothing. The secret/admin client
 * is never used here, so an accidental call from a client context returns no
 * rows rather than leaking. RLS is the authoritative guard; the server action
 * layer adds an explicit `requireTrainerAdmin` check on top.
 */

/**
 * Lists a client's trainer notes, newest first. Returns an empty array when the
 * client has no notes or when RLS hides them from a non-admin caller. Throws a
 * descriptive error on an unexpected database failure so callers fail loudly.
 *
 * @param clientId - The client the notes are about.
 * @returns The client's trainer notes, newest first.
 */
export async function listTrainerNotes(
  clientId: string
): Promise<TrainerNoteRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("trainer_notes")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to load trainer notes: ${error.message}`)
  }
  return (data as TrainerNoteRow[]) ?? []
}

/**
 * Inserts a private trainer note about a client and returns the persisted row.
 * The body is trimmed and must be non-empty; an empty insert is rejected before
 * hitting the database so a blank note is never stored. RLS enforces that only
 * the trainer admin can insert. Throws on a database error or empty body.
 *
 * @param clientId - The client the note is about.
 * @param authorId - The authoring trainer admin's auth user id.
 * @param body - The note text; trimmed, must be non-empty.
 * @returns The inserted trainer note row.
 */
export async function createTrainerNote(
  clientId: string,
  authorId: string,
  body: string
): Promise<TrainerNoteRow> {
  const trimmed = body.trim()
  if (trimmed === "") {
    throw new Error("Refusing to store an empty trainer note")
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("trainer_notes")
    .insert({ client_id: clientId, author_id: authorId, body: trimmed })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to create trainer note: ${error?.message ?? "no row returned"}`
    )
  }
  return data as TrainerNoteRow
}

/**
 * Updates a trainer note's body and returns the updated row. The body is
 * trimmed and must be non-empty. RLS restricts the update to the trainer admin.
 * Throws on a database error, an empty body, or when no row matches the id.
 *
 * @param noteId - The note's id.
 * @param body - The replacement text; trimmed, must be non-empty.
 * @returns The updated trainer note row.
 */
export async function updateTrainerNote(
  noteId: string,
  body: string
): Promise<TrainerNoteRow> {
  const trimmed = body.trim()
  if (trimmed === "") {
    throw new Error("Refusing to store an empty trainer note")
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("trainer_notes")
    .update({ body: trimmed })
    .eq("id", noteId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to update trainer note: ${error?.message ?? "no row returned"}`
    )
  }
  return data as TrainerNoteRow
}

/**
 * Deletes a trainer note by id. RLS restricts the delete to the trainer admin,
 * so a non-admin call is a no-op at the database. Throws on a database error.
 *
 * @param noteId - The note's id.
 */
export async function deleteTrainerNote(noteId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("trainer_notes")
    .delete()
    .eq("id", noteId)

  if (error) {
    throw new Error(`Failed to delete trainer note: ${error.message}`)
  }
}
