import { describe, expect, it } from "vitest"

import {
  activityPeriod,
  completedWorkoutIds,
  completionPercentage,
  currentMonthPeriod,
  isDuplicateCompletion,
  logsInPeriod,
  toDateKey,
} from "@/lib/progress/progress"

describe("completionPercentage", () => {
  it("returns 0 for a plan with no workouts", () => {
    expect(completionPercentage(0, [])).toBe(0)
    expect(completionPercentage(0, ["a"])).toBe(0)
  })

  it("returns 0 when nothing is completed", () => {
    expect(completionPercentage(4, [])).toBe(0)
  })

  it("rounds the share of distinct completed workouts to an integer", () => {
    // 1 of 3 = 33.33 -> 33
    expect(completionPercentage(3, ["a"])).toBe(33)
    // 2 of 3 = 66.67 -> 67
    expect(completionPercentage(3, ["a", "b"])).toBe(67)
  })

  it("counts distinct workouts, ignoring duplicate ids", () => {
    expect(completionPercentage(4, ["a", "a", "b"])).toBe(50)
  })

  it("clamps to 100 when more ids than workouts are passed", () => {
    expect(completionPercentage(2, ["a", "b", "c"])).toBe(100)
  })

  it("returns 100 when every workout is completed", () => {
    expect(completionPercentage(2, ["a", "b"])).toBe(100)
  })
})

describe("completedWorkoutIds", () => {
  it("collects distinct workout ids from logs", () => {
    const logs = [
      { workout_id: "a" },
      { workout_id: "a" },
      { workout_id: "b" },
    ]
    const ids = completedWorkoutIds(logs)
    expect([...ids].sort()).toEqual(["a", "b"])
  })

  it("returns an empty set for no logs", () => {
    expect(completedWorkoutIds([]).size).toBe(0)
  })
})

describe("isDuplicateCompletion", () => {
  const existing = [
    { workout_id: "w1", planned_date: "2026-06-05" },
    { workout_id: "w2", planned_date: null },
  ]

  it("detects a duplicate for the same workout and date", () => {
    expect(
      isDuplicateCompletion(existing, {
        workoutId: "w1",
        plannedDate: "2026-06-05",
      })
    ).toBe(true)
  })

  it("allows the same workout on a different date", () => {
    expect(
      isDuplicateCompletion(existing, {
        workoutId: "w1",
        plannedDate: "2026-06-06",
      })
    ).toBe(false)
  })

  it("treats a null planned date as its own distinct key", () => {
    expect(
      isDuplicateCompletion(existing, { workoutId: "w2", plannedDate: null })
    ).toBe(true)
    expect(
      isDuplicateCompletion(existing, {
        workoutId: "w2",
        plannedDate: "2026-06-05",
      })
    ).toBe(false)
  })

  it("allows a new workout id entirely", () => {
    expect(
      isDuplicateCompletion(existing, {
        workoutId: "w3",
        plannedDate: "2026-06-05",
      })
    ).toBe(false)
  })
})

describe("toDateKey", () => {
  it("formats a date as YYYY-MM-DD in UTC", () => {
    expect(toDateKey(new Date("2026-06-05T23:30:00.000Z"))).toBe("2026-06-05")
  })
})

describe("activityPeriod", () => {
  const reference = new Date("2026-06-05T12:00:00.000Z")

  it("computes an inclusive 7-day window ending on the reference day", () => {
    expect(activityPeriod(reference, 7)).toEqual({
      start: "2026-05-30",
      end: "2026-06-05",
    })
  })

  it("treats a 1-day window as just the reference day", () => {
    expect(activityPeriod(reference, 1)).toEqual({
      start: "2026-06-05",
      end: "2026-06-05",
    })
  })

  it("treats non-positive day counts as a single day", () => {
    expect(activityPeriod(reference, 0)).toEqual({
      start: "2026-06-05",
      end: "2026-06-05",
    })
  })

  it("crosses a month boundary correctly", () => {
    const start = new Date("2026-03-02T00:00:00.000Z")
    expect(activityPeriod(start, 7)).toEqual({
      start: "2026-02-24",
      end: "2026-03-02",
    })
  })
})

describe("currentMonthPeriod", () => {
  it("spans the first to the last day of the reference month", () => {
    expect(currentMonthPeriod(new Date("2026-06-15T12:00:00.000Z"))).toEqual({
      start: "2026-06-01",
      end: "2026-06-30",
    })
  })

  it("handles February in a non-leap year", () => {
    expect(currentMonthPeriod(new Date("2026-02-10T00:00:00.000Z"))).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    })
  })

  it("handles February in a leap year", () => {
    expect(currentMonthPeriod(new Date("2024-02-10T00:00:00.000Z"))).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    })
  })

  it("handles December (year rollover for the end bound)", () => {
    expect(currentMonthPeriod(new Date("2026-12-25T00:00:00.000Z"))).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
    })
  })
})

describe("logsInPeriod", () => {
  const period = { start: "2026-06-01", end: "2026-06-30" }

  it("keeps logs completed within the inclusive window", () => {
    const logs = [
      { completed_at: "2026-06-01T00:00:00.000Z" },
      { completed_at: "2026-06-30T23:00:00.000Z" },
      { completed_at: "2026-06-15T10:00:00.000Z" },
    ]
    expect(logsInPeriod(logs, period)).toHaveLength(3)
  })

  it("drops logs outside the window on either side", () => {
    const logs = [
      { completed_at: "2026-05-31T23:00:00.000Z" },
      { completed_at: "2026-07-01T00:00:00.000Z" },
    ]
    expect(logsInPeriod(logs, period)).toEqual([])
  })

  it("excludes logs with no timestamp", () => {
    const logs = [{ completed_at: "" }, { completed_at: "2026-06-10T00:00:00Z" }]
    expect(logsInPeriod(logs, period)).toHaveLength(1)
  })
})
