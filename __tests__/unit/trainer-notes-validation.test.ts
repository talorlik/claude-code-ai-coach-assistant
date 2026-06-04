import { describe, expect, it } from "vitest"

import {
  validateTrainerNote,
  TRAINER_NOTE_MAX_LENGTH,
} from "@/lib/trainer/notes-validation"

/**
 * Unit tests for trainer-note validation. A note body is trimmed and must be
 * non-empty and within {@link TRAINER_NOTE_MAX_LENGTH}. The validator returns
 * the shared `ActionResult` so the server action and form share one definition
 * of "valid", and the trimmed body is what gets persisted.
 */

describe("validateTrainerNote", () => {
  it("accepts a normal note and returns the trimmed body", () => {
    const result = validateTrainerNote("  Focus on squat depth next session  ")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.body).toBe("Focus on squat depth next session")
  })

  it("rejects an empty body", () => {
    const result = validateTrainerNote("")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.body).toBeDefined()
  })

  it("rejects a whitespace-only body", () => {
    const result = validateTrainerNote("    \n\t  ")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.body).toBeDefined()
  })

  it("accepts a body exactly at the maximum length", () => {
    const result = validateTrainerNote("a".repeat(TRAINER_NOTE_MAX_LENGTH))
    expect(result.ok).toBe(true)
  })

  it("rejects a body over the maximum length", () => {
    const result = validateTrainerNote("a".repeat(TRAINER_NOTE_MAX_LENGTH + 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.body).toBeDefined()
  })
})
