import { toDateKey } from "@/lib/progress/progress"

/**
 * Pure progress-aggregation helpers for the trainer client dashboard. They turn
 * a client's completion logs into fixed-length, gap-filled time series the
 * Recharts weekly/monthly charts render directly. "Fixed-length and gap-filled"
 * means a quiet week or month appears as a zero bar rather than vanishing, so
 * the chart's x-axis stays stable and readable.
 *
 * All date maths is done in UTC via {@link toDateKey} so the same instant maps
 * to the same calendar bucket regardless of server timezone, matching how the
 * rest of the progress logic treats dates. The `reference` instant is injected
 * so windows are deterministic and unit-testable.
 */

/** The single field these helpers need from a completion log. */
export interface CompletionPoint {
  /** ISO timestamp of when the workout was completed. */
  completed_at: string
}

/** One bucket of a completion series: an inclusive date window and its count. */
export interface CompletionBucket {
  /** Inclusive bucket start, `YYYY-MM-DD` (UTC). Stable chart x-key. */
  start: string
  /** Inclusive bucket end, `YYYY-MM-DD` (UTC). */
  end: string
  /** Number of completions whose `completed_at` falls in the window. */
  count: number
}

/** Parses a log's timestamp to a UTC date key, or `null` if unparseable. */
function toKey(point: CompletionPoint): string | null {
  if (!point.completed_at) return null
  const date = new Date(point.completed_at)
  if (Number.isNaN(date.getTime())) return null
  return toDateKey(date)
}

/**
 * Tallies completions into a pre-built, chronologically ordered set of buckets.
 * Each completion is placed in the first bucket whose inclusive `[start, end]`
 * window contains its date key; completions outside every window are dropped.
 * Buckets are assumed non-overlapping and sorted ascending.
 */
function tally(
  buckets: CompletionBucket[],
  logs: readonly CompletionPoint[]
): CompletionBucket[] {
  for (const log of logs) {
    const key = toKey(log)
    if (!key) continue
    const bucket = buckets.find((b) => key >= b.start && key <= b.end)
    if (bucket) bucket.count += 1
  }
  return buckets
}

/**
 * Builds a `weeks`-long series of 7-day buckets ending on the `reference` day,
 * ordered oldest first, then counts each completion into its week. The final
 * bucket always contains the reference day; earlier buckets are the preceding
 * seven-day spans. Empty weeks are kept with `count: 0`.
 *
 * @param logs - The client's completion logs.
 * @param reference - The day the most recent week ends on (typically "now").
 * @param weeks - Number of weekly buckets to produce; values below 1 yield 1.
 * @returns The weekly completion series, oldest week first.
 */
export function weeklyCompletions(
  logs: readonly CompletionPoint[],
  reference: Date,
  weeks: number
): CompletionBucket[] {
  const span = Math.max(1, Math.floor(weeks))
  const buckets: CompletionBucket[] = []

  // Bucket i counts back from the most recent week (i = 0) to the oldest.
  for (let i = 0; i < span; i++) {
    const end = new Date(reference)
    end.setUTCDate(end.getUTCDate() - i * 7)
    const start = new Date(end)
    // Inclusive 7-day window: the end day plus the six prior days.
    start.setUTCDate(start.getUTCDate() - 6)
    buckets.push({ start: toDateKey(start), end: toDateKey(end), count: 0 })
  }

  // Built newest-first; reverse to chronological (oldest first) for the chart.
  buckets.reverse()
  return tally(buckets, logs)
}

/**
 * Builds a `months`-long series of calendar-month buckets ending in the month
 * containing `reference`, ordered oldest first, then counts each completion into
 * its month. Each bucket spans the full calendar month (first to last day).
 * Empty months are kept with `count: 0`.
 *
 * @param logs - The client's completion logs.
 * @param reference - Any instant in the most recent month (typically "now").
 * @param months - Number of month buckets to produce; values below 1 yield 1.
 * @returns The monthly completion series, oldest month first.
 */
export function monthlyCompletions(
  logs: readonly CompletionPoint[],
  reference: Date,
  months: number
): CompletionBucket[] {
  const span = Math.max(1, Math.floor(months))
  const year = reference.getUTCFullYear()
  const month = reference.getUTCMonth()
  const buckets: CompletionBucket[] = []

  // Walk back from the reference month (offset 0) to the oldest.
  for (let i = 0; i < span; i++) {
    const start = new Date(Date.UTC(year, month - i, 1))
    // Day 0 of the following month is the last day of this bucket's month.
    const end = new Date(Date.UTC(year, month - i + 1, 0))
    buckets.push({ start: toDateKey(start), end: toDateKey(end), count: 0 })
  }

  buckets.reverse()
  return tally(buckets, logs)
}
