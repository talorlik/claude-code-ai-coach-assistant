import { describe, expect, it } from "vitest"

import {
  weeklyCompletions,
  monthlyCompletions,
  type CompletionPoint,
} from "@/lib/trainer/aggregation"

/**
 * Unit tests for the trainer-dashboard progress aggregation. Both helpers take
 * completion logs (each carrying a `completed_at` ISO timestamp) and bucket them
 * into a fixed-length, gap-filled series ending at a reference instant, so the
 * charts always render a stable number of bars/points with zeroes for quiet
 * periods rather than collapsing missing weeks/months.
 *
 * `reference` is injected so the windows are deterministic in tests.
 */

const reference = new Date("2026-06-15T12:00:00.000Z")

function log(completedAt: string): CompletionPoint {
  return { completed_at: completedAt }
}

describe("weeklyCompletions", () => {
  it("returns the requested number of consecutive weekly buckets, oldest first", () => {
    const series = weeklyCompletions([], reference, 4)
    expect(series).toHaveLength(4)
    // Buckets are ordered chronologically: each start precedes the next.
    for (let i = 1; i < series.length; i++) {
      expect(series[i - 1].start < series[i].start).toBe(true)
    }
    // The final bucket contains the reference day.
    const last = series[series.length - 1]
    expect(last.start <= "2026-06-15").toBe(true)
    expect("2026-06-15" <= last.end).toBe(true)
  })

  it("counts completions into the correct week and zero-fills empty weeks", () => {
    const logs = [
      log("2026-06-15T08:00:00.000Z"), // current week
      log("2026-06-14T20:00:00.000Z"), // current week
      log("2026-06-01T08:00:00.000Z"), // two weeks back
    ]
    const series = weeklyCompletions(logs, reference, 4)
    const counts = series.map((b) => b.count)
    // 4 weekly buckets ending the week of Jun 15; the empty weeks read 0.
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3)
    expect(series[series.length - 1].count).toBe(2)
    expect(counts.some((c) => c === 0)).toBe(true)
  })

  it("excludes completions older than the window", () => {
    const logs = [log("2026-01-01T08:00:00.000Z")]
    const series = weeklyCompletions(logs, reference, 4)
    expect(series.reduce((a, b) => a + b.count, 0)).toBe(0)
  })

  it("ignores logs with a missing or unparseable timestamp", () => {
    const logs = [log(""), { completed_at: "not-a-date" } as CompletionPoint]
    const series = weeklyCompletions(logs, reference, 4)
    expect(series.reduce((a, b) => a + b.count, 0)).toBe(0)
  })
})

describe("monthlyCompletions", () => {
  it("returns the requested number of consecutive month buckets, oldest first", () => {
    const series = monthlyCompletions([], reference, 6)
    expect(series).toHaveLength(6)
    for (let i = 1; i < series.length; i++) {
      expect(series[i - 1].start < series[i].start).toBe(true)
    }
    // Final bucket is June 2026.
    const last = series[series.length - 1]
    expect(last.start).toBe("2026-06-01")
    expect(last.end).toBe("2026-06-30")
  })

  it("counts completions into the correct month and zero-fills empty months", () => {
    const logs = [
      log("2026-06-10T08:00:00.000Z"), // June
      log("2026-06-02T08:00:00.000Z"), // June
      log("2026-04-20T08:00:00.000Z"), // April
    ]
    const series = monthlyCompletions(logs, reference, 6)
    expect(series.reduce((a, b) => a + b.count, 0)).toBe(3)
    expect(series[series.length - 1].count).toBe(2) // June
    // April bucket present and counted; May reads 0.
    const may = series.find((b) => b.start === "2026-05-01")!
    expect(may.count).toBe(0)
    const april = series.find((b) => b.start === "2026-04-01")!
    expect(april.count).toBe(1)
  })

  it("excludes completions older than the window", () => {
    const logs = [log("2025-01-01T08:00:00.000Z")]
    const series = monthlyCompletions(logs, reference, 6)
    expect(series.reduce((a, b) => a + b.count, 0)).toBe(0)
  })
})
