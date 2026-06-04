import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Integration tests for the completeWorkout server action. Auth, the workout
 * data-access checks, and log persistence are mocked so the tests exercise the
 * action's validation, authorization, duplicate-prevention, and revalidation
 * branches without a live database.
 */

let currentUser: { id: string } | null
const clientOwnsWorkout = vi.fn()
const listLogsForWorkouts = vi.fn()
const insertWorkoutLog = vi.fn()
const revalidatePath = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}))

vi.mock("@/lib/db/workouts", () => ({
  clientOwnsWorkout: (...args: unknown[]) => clientOwnsWorkout(...args),
}))

vi.mock("@/lib/db/workout-logs", () => ({
  listLogsForWorkouts: (...args: unknown[]) => listLogsForWorkouts(...args),
  insertWorkoutLog: (...args: unknown[]) => insertWorkoutLog(...args),
}))

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

import { completeWorkout } from "@/lib/workouts/logging-actions"

beforeEach(() => {
  currentUser = { id: "client-1" }
  clientOwnsWorkout.mockReset().mockResolvedValue(true)
  listLogsForWorkouts.mockReset().mockResolvedValue([])
  insertWorkoutLog.mockReset()
  revalidatePath.mockReset()
})

describe("completeWorkout", () => {
  it("saves a workout log and revalidates the plan page", async () => {
    const row = { id: "log-1", workout_id: "w1" }
    insertWorkoutLog.mockResolvedValue(row)

    const result = await completeWorkout({
      workoutId: "w1",
      plannedDate: "2026-06-05",
      difficulty: "hard",
      energyLevel: "high",
      notes: "felt strong",
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.log).toEqual(row)
    expect(insertWorkoutLog).toHaveBeenCalledWith({
      clientId: "client-1",
      workoutId: "w1",
      plannedDate: "2026-06-05",
      difficulty: "hard",
      energyLevel: "high",
      notes: "felt strong",
    })
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/my-plan", "page")
  })

  it("rejects when signed out", async () => {
    currentUser = null
    const result = await completeWorkout({ workoutId: "w1" })
    expect(result).toEqual({ ok: false, error: "signedOut" })
    expect(insertWorkoutLog).not.toHaveBeenCalled()
  })

  it("rejects a missing workout id", async () => {
    const result = await completeWorkout({ workoutId: "  " })
    expect(result).toEqual({ ok: false, error: "invalidWorkout" })
  })

  it("rejects a malformed planned date", async () => {
    const result = await completeWorkout({
      workoutId: "w1",
      plannedDate: "06/05/2026",
    })
    expect(result).toEqual({ ok: false, error: "invalidDate" })
  })

  it("rejects an out-of-set difficulty", async () => {
    const result = await completeWorkout({
      workoutId: "w1",
      difficulty: "brutal",
    })
    expect(result).toEqual({ ok: false, error: "invalidDifficulty" })
  })

  it("rejects an out-of-set energy level", async () => {
    const result = await completeWorkout({
      workoutId: "w1",
      energyLevel: "infinite",
    })
    expect(result).toEqual({ ok: false, error: "invalidEnergy" })
  })

  it("rejects a workout the client does not own", async () => {
    clientOwnsWorkout.mockResolvedValue(false)
    const result = await completeWorkout({ workoutId: "w1" })
    expect(result).toEqual({ ok: false, error: "invalidWorkout" })
    expect(insertWorkoutLog).not.toHaveBeenCalled()
  })

  it("prevents a duplicate completion for the same workout and date", async () => {
    listLogsForWorkouts.mockResolvedValue([
      { workout_id: "w1", planned_date: "2026-06-05" },
    ])
    const result = await completeWorkout({
      workoutId: "w1",
      plannedDate: "2026-06-05",
    })
    expect(result).toEqual({ ok: false, error: "duplicate" })
    expect(insertWorkoutLog).not.toHaveBeenCalled()
  })

  it("allows the same workout on a different date", async () => {
    listLogsForWorkouts.mockResolvedValue([
      { workout_id: "w1", planned_date: "2026-06-04" },
    ])
    insertWorkoutLog.mockResolvedValue({ id: "log-2", workout_id: "w1" })
    const result = await completeWorkout({
      workoutId: "w1",
      plannedDate: "2026-06-05",
    })
    expect(result.ok).toBe(true)
    expect(insertWorkoutLog).toHaveBeenCalledOnce()
  })

  it("maps a unique-violation insert error to a duplicate result", async () => {
    insertWorkoutLog.mockRejectedValue(
      new Error("duplicate key value violates unique constraint")
    )
    const result = await completeWorkout({
      workoutId: "w1",
      plannedDate: "2026-06-05",
    })
    expect(result).toEqual({ ok: false, error: "duplicate" })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("maps an unexpected insert error to saveFailed", async () => {
    insertWorkoutLog.mockRejectedValue(new Error("connection reset"))
    const result = await completeWorkout({ workoutId: "w1" })
    expect(result).toEqual({ ok: false, error: "saveFailed" })
  })
})
