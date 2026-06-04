"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  createTrainerNoteAction,
  updateTrainerNoteAction,
  deleteTrainerNoteAction,
} from "@/lib/trainer/notes-actions"

/**
 * A plain, serializable trainer note for the client list. The page maps the
 * stored row into this shape (resolving the localized `updated_at` label) so the
 * panel renders without re-deriving formatting.
 */
export interface TrainerNoteItem {
  /** The note's id. */
  id: string
  /** The note body. */
  body: string
  /** Locale-formatted "last updated" label. */
  updatedAtLabel: string
}

/** Validator field-error codes the notes form knows how to localize. */
const ERROR_KEYS = ["required", "tooLong"] as const
type NoteErrorKey = (typeof ERROR_KEYS)[number]

/** Narrows an arbitrary field-error code to a known, localizable note error. */
function isNoteErrorKey(code: string | undefined): code is NoteErrorKey {
  return code != null && (ERROR_KEYS as readonly string[]).includes(code)
}

/**
 * Private trainer-notes CRUD panel. Seeds its list from the server-rendered
 * notes and then adds, edits, and deletes through the trainer-note server
 * actions, updating the in-memory list from each action's returned row so the
 * UI stays responsive without a full reload (the actions also revalidate the
 * page on the server). Only the trainer admin ever reaches this surface; the
 * actions independently re-check that, and RLS is the database backstop.
 *
 * All copy comes from the `TrainerDashboard.notes` namespace; validator error
 * codes are mapped to localized messages so failures read naturally in both
 * locales.
 *
 * @param clientId - The client these notes are about.
 * @param initialNotes - Server-rendered notes to seed the list, newest first.
 */
export function TrainerNotesPanel({
  clientId,
  initialNotes,
}: {
  clientId: string
  initialNotes: TrainerNoteItem[]
}) {
  const t = useTranslations("TrainerDashboard.notes")
  const [notes, setNotes] = React.useState<TrainerNoteItem[]>(initialNotes)
  const [draft, setDraft] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingBody, setEditingBody] = React.useState("")

  /** Translates a server failure (field code or generic) to display copy. */
  function messageFor(result: {
    error: string
    fieldErrors?: Record<string, string>
  }): string {
    const code = result.fieldErrors?.body
    if (isNoteErrorKey(code)) return t(`errors.${code}`)
    return t("errors.generic")
  }

  async function onAdd(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const result = await createTrainerNoteAction(clientId, draft)
    setPending(false)

    if (!result.ok) {
      setError(messageFor(result))
      return
    }

    setNotes((prev) => [
      { id: result.data.id, body: result.data.body, updatedAtLabel: "" },
      ...prev,
    ])
    setDraft("")
  }

  async function onSaveEdit(noteId: string) {
    setPending(true)
    setError(null)

    const result = await updateTrainerNoteAction(clientId, noteId, editingBody)
    setPending(false)

    if (!result.ok) {
      setError(messageFor(result))
      return
    }

    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId ? { ...n, body: result.data.body } : n
      )
    )
    setEditingId(null)
    setEditingBody("")
  }

  async function onDelete(noteId: string) {
    setPending(true)
    setError(null)

    const result = await deleteTrainerNoteAction(clientId, noteId)
    setPending(false)

    if (!result.ok) {
      setError(t("errors.generic"))
      return
    }

    setNotes((prev) => prev.filter((n) => n.id !== noteId))
  }

  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <header className="mb-3 flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <form onSubmit={onAdd} className="flex flex-col gap-2">
        <Textarea
          aria-label={t("placeholder")}
          placeholder={t("placeholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
        />
        <div className="flex items-center justify-between gap-2">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={pending || draft.trim() === ""}>
            {pending ? t("saving") : t("add")}
          </Button>
        </div>
      </form>

      <ul className="mt-4 flex flex-col gap-3">
        {notes.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t("empty")}</li>
        ) : (
          notes.map((note) => (
            <li key={note.id} className="rounded-md border p-3">
              {editingId === note.id ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    aria-label={t("edit")}
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(null)
                        setEditingBody("")
                      }}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      type="button"
                      disabled={pending || editingBody.trim() === ""}
                      onClick={() => onSaveEdit(note.id)}
                    >
                      {pending ? t("saving") : t("save")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {note.body}
                    </p>
                    {note.updatedAtLabel ? (
                      <span className="text-xs text-muted-foreground">
                        {t("updatedAt", { date: note.updatedAtLabel })}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("edit")}
                      onClick={() => {
                        setEditingId(note.id)
                        setEditingBody(note.body)
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("delete")}
                      disabled={pending}
                      onClick={() => onDelete(note.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
