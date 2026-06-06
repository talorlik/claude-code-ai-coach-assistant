import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the live-plan editor server actions. The auth guard,
 * data access, client lookup, and Supabase client are mocked, so the tests
 * assert the orchestration the data-layer tests do not cover:
 *
 * - Each action runs `requireTrainerAdmin` first and performs NO write when the
 *   guard rejects (Next's redirect throws).
 * - The per-client safety rule is re-validated PRE-WRITE: clearing safety notes
 *   is rejected for a client WITH limitations and accepted WITHOUT.
 * - A workout delete blocked by completion logs surfaces a typed `hasLogs`
 *   failure rather than a silent success.
 */

const requireTrainerAdmin = vi.fn<() => Promise<string>>()
const getClient = vi.fn()

const listWorkoutExercises = vi.fn()
const getWorkoutOwnerClient = vi.fn()
const getPlanOwnerClient = vi.fn()
const updateExercise = vi.fn()
const updateWorkout = vi.fn()
const addExercise = vi.fn()
const addWorkout = vi.fn()
const deleteExercise = vi.fn()
const deleteWorkout = vi.fn()

// The exercise-edit/delete actions resolve the parent workout via a small inline
// Supabase query; model it as a fixed mapping from exercise id -> workout id.
const exerciseWorkout: Record<string, string | null> = { e1: "w1" }
function supabaseMock() {
  return {
    from: () => {
      const b: Record<string, unknown> = {}
      let exId: string | null = null
      b.select = () => b
      b.eq = (_c: string, v: string) => {
        exId = v
        return b
      }
      b.maybeSingle = async () => ({
        data:
          exId != null ? { workout_id: exerciseWorkout[exId] ?? null } : null,
        error: null,
      })
      return b
    },
  }
}

vi.mock("@/lib/auth/require-user", () => ({
  requireTrainerAdmin: () => requireTrainerAdmin(),
}))
vi.mock("@/lib/db/clients", () => ({
  getClient: (...a: unknown[]) => getClient(...a),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => supabaseMock(),
}))
vi.mock("@/lib/db/plan-edits", () => ({
  listWorkoutExercises: (...a: unknown[]) => listWorkoutExercises(...a),
  getWorkoutOwnerClient: (...a: unknown[]) => getWorkoutOwnerClient(...a),
  getPlanOwnerClient: (...a: unknown[]) => getPlanOwnerClient(...a),
  updateExercise: (...a: unknown[]) => updateExercise(...a),
  updateWorkout: (...a: unknown[]) => updateWorkout(...a),
  addExercise: (...a: unknown[]) => addExercise(...a),
  addWorkout: (...a: unknown[]) => addWorkout(...a),
  deleteExercise: (...a: unknown[]) => deleteExercise(...a),
  deleteWorkout: (...a: unknown[]) => deleteWorkout(...a),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import {
  addExerciseAction,
  addWorkoutAction,
  deleteExerciseAction,
  deleteWorkoutAction,
  updateExerciseAction,
  updateWorkoutAction,
} from "@/lib/trainer/plan-edit-actions"

/** A valid exercise edit payload. */
function exerciseInput(safety: string | null = null) {
  return {
    name: "Squat",
    sets: 3,
    reps: "8-12",
    duration: null,
    rest: "90s",
    instructions: "Chest up.",
    safety_notes: safety,
  }
}

function exerciseRow(id: string, safety: string | null) {
  return {
    id,
    workout_id: "w1",
    name: "Squat",
    sets: 3,
    reps: "8-12",
    duration: null,
    rest: "90s",
    instructions: null,
    safety_notes: safety,
    position: 0,
    created_at: "x",
    updated_at: "x",
  }
}

function clientModel(limitations: string | null) {
  return { userId: "client-1", limitations }
}

beforeEach(() => {
  vi.clearAllMocks()
  requireTrainerAdmin.mockResolvedValue("admin-1")
  getWorkoutOwnerClient.mockResolvedValue("client-1")
  getPlanOwnerClient.mockResolvedValue("client-1")
})

describe("admin-only access", () => {
  it("performs no write when the guard rejects, per action", async () => {
    requireTrainerAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"))

    await expect(updateExerciseAction("e1", exerciseInput())).rejects.toThrow()
    await expect(
      updateWorkoutAction("w1", {
        title: "X",
        focus: null,
        day_of_week: null,
        notes: null,
      })
    ).rejects.toThrow()
    await expect(addExerciseAction("w1", exerciseInput())).rejects.toThrow()
    await expect(
      addWorkoutAction("plan-1", {
        title: "X",
        focus: null,
        day_of_week: null,
        notes: null,
      })
    ).rejects.toThrow()
    await expect(deleteExerciseAction("e1")).rejects.toThrow()
    await expect(deleteWorkoutAction("w1")).rejects.toThrow()

    for (const fn of [
      updateExercise,
      updateWorkout,
      addExercise,
      addWorkout,
      deleteExercise,
      deleteWorkout,
    ]) {
      expect(fn).not.toHaveBeenCalled()
    }
  })
})

describe("updateExerciseAction safety rule", () => {
  it("rejects clearing safety notes for a client WITH limitations", async () => {
    listWorkoutExercises.mockResolvedValue([exerciseRow("e1", "Old note")])
    getClient.mockResolvedValue(clientModel("Left knee injury"))

    const result = await updateExerciseAction("e1", exerciseInput(null))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.code).toBe("safetyRequired")
    expect(updateExercise).not.toHaveBeenCalled()
  })

  it("accepts clearing safety notes for a client WITHOUT limitations", async () => {
    listWorkoutExercises.mockResolvedValue([exerciseRow("e1", "Old note")])
    getClient.mockResolvedValue(clientModel(null))
    updateExercise.mockResolvedValue(exerciseRow("e1", null))

    const result = await updateExerciseAction("e1", exerciseInput(null))

    expect(result.ok).toBe(true)
    expect(updateExercise).toHaveBeenCalledOnce()
  })

  it("accepts an edit that keeps safety notes for a limited client", async () => {
    listWorkoutExercises.mockResolvedValue([exerciseRow("e1", "Old note")])
    getClient.mockResolvedValue(clientModel("Left knee injury"))
    updateExercise.mockResolvedValue(exerciseRow("e1", "Avoid deep range."))

    const result = await updateExerciseAction(
      "e1",
      exerciseInput("Avoid deep range.")
    )

    expect(result.ok).toBe(true)
    expect(updateExercise).toHaveBeenCalledOnce()
  })
})

describe("addExerciseAction safety rule", () => {
  it("rejects adding an unguarded exercise for a limited client", async () => {
    listWorkoutExercises.mockResolvedValue([exerciseRow("e1", "Note")])
    getClient.mockResolvedValue(clientModel("Shoulder issue"))

    const result = await addExerciseAction("w1", exerciseInput(null))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.code).toBe("safetyRequired")
    expect(addExercise).not.toHaveBeenCalled()
  })

  it("appends after the current max position when accepted", async () => {
    listWorkoutExercises.mockResolvedValue([
      { ...exerciseRow("e1", "Note"), position: 0 },
      { ...exerciseRow("e2", "Note"), position: 4 },
    ])
    getClient.mockResolvedValue(clientModel(null))
    addExercise.mockResolvedValue(exerciseRow("e9", null))

    const result = await addExerciseAction("w1", exerciseInput(null))

    expect(result.ok).toBe(true)
    expect(addExercise).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({ position: 5 })
    )
  })
})

describe("updateWorkoutAction", () => {
  it("updates metadata without consulting exercises or logs", async () => {
    updateWorkout.mockResolvedValue({ id: "w1", title: "Renamed" })

    const result = await updateWorkoutAction("w1", {
      title: "Renamed",
      focus: "pull",
      day_of_week: "tuesday",
      notes: null,
    })

    expect(result.ok).toBe(true)
    expect(updateWorkout).toHaveBeenCalledOnce()
    // Metadata edits don't read exercises or client limitations.
    expect(listWorkoutExercises).not.toHaveBeenCalled()
    expect(getClient).not.toHaveBeenCalled()
  })
})

describe("deleteWorkoutAction (cascade guard surfaced)", () => {
  it("returns a typed hasLogs failure when the data layer refuses", async () => {
    deleteWorkout.mockResolvedValue({
      ok: false,
      reason: "has_logs",
      logCount: 3,
    })

    const result = await deleteWorkoutAction("w1")

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.code).toBe("hasLogs")
  })

  it("succeeds when the workout has no logs", async () => {
    deleteWorkout.mockResolvedValue({ ok: true })

    const result = await deleteWorkoutAction("w1")

    expect(result.ok).toBe(true)
    expect(deleteWorkout).toHaveBeenCalledWith("w1")
  })
})

describe("deleteExerciseAction", () => {
  it("deletes and reports success", async () => {
    deleteExercise.mockResolvedValue(undefined)

    const result = await deleteExerciseAction("e1")

    expect(result.ok).toBe(true)
    expect(deleteExercise).toHaveBeenCalledWith("e1")
  })
})
