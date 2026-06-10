import { beforeEach, describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"

/**
 * Integration tests for the trainer-note server actions' failure contract. The
 * data layer is mocked to throw so the catch branch runs; each action must
 * return a localizable `errors.*` message key (not a raw English string),
 * matching the key-based convention in `trainer-clients-actions`. The keys are
 * asserted to resolve under `TrainerDashboard.notes.errors` in both locale
 * message files, so the notes panel toasts a localized string under `/he`.
 */

const requireTrainerAdmin = vi.fn<() => Promise<string>>()

vi.mock("@/lib/auth/require-user", () => ({
  requireTrainerAdmin: () => requireTrainerAdmin(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const createTrainerNote = vi.fn()
const updateTrainerNote = vi.fn()
const deleteTrainerNote = vi.fn()

vi.mock("@/lib/db/trainer-notes", () => ({
  createTrainerNote: (...args: unknown[]) => createTrainerNote(...args),
  updateTrainerNote: (...args: unknown[]) => updateTrainerNote(...args),
  deleteTrainerNote: (...args: unknown[]) => deleteTrainerNote(...args),
}))

import {
  createTrainerNoteAction,
  updateTrainerNoteAction,
  deleteTrainerNoteAction,
} from "@/lib/trainer/notes-actions"

/** Resolves a dotted `errors.x` key against the notes namespace of a message map. */
function resolveNotesKey(
  messages: typeof enMessages,
  key: string
): string | undefined {
  const errors = messages.TrainerDashboard?.notes?.errors as
    | Record<string, string>
    | undefined
  return errors?.[key.replace(/^errors\./, "")]
}

beforeEach(() => {
  vi.clearAllMocks()
  requireTrainerAdmin.mockResolvedValue("admin-1")
})

describe("notes-actions failure keys", () => {
  it("create returns errors.saveError when the write throws", async () => {
    createTrainerNote.mockRejectedValue(new Error("db boom"))
    const result = await createTrainerNoteAction("c1", "a note")
    expect(result).toEqual({ ok: false, error: "errors.saveError" })
  })

  it("update returns errors.updateError when the write throws", async () => {
    updateTrainerNote.mockRejectedValue(new Error("db boom"))
    const result = await updateTrainerNoteAction("c1", "n1", "edited")
    expect(result).toEqual({ ok: false, error: "errors.updateError" })
  })

  it("delete returns errors.deleteError when the write throws", async () => {
    deleteTrainerNote.mockRejectedValue(new Error("db boom"))
    const result = await deleteTrainerNoteAction("c1", "n1")
    expect(result).toEqual({ ok: false, error: "errors.deleteError" })
  })

  it("every returned error key resolves in both locale files", () => {
    for (const key of [
      "errors.saveError",
      "errors.updateError",
      "errors.deleteError",
      "errors.generic",
    ]) {
      expect(resolveNotesKey(enMessages, key)).toBeTruthy()
      expect(resolveNotesKey(heMessages, key)).toBeTruthy()
    }
  })
})
