/**
 * Pure, dependency-free helpers for the trainer-admin client overview. They
 * turn a client's recent training into a single "activity level" with a
 * traffic-light colour, so the client list can render a consistent indicator
 * without re-deriving the thresholds at each call site.
 *
 * Kept free of any Supabase or request dependency so they are trivially
 * unit-testable and reusable from the page, server actions, and tests. The
 * underlying completion maths lives in `lib/progress/progress.ts`; this module
 * only maps a completion percentage to a discrete level and colour.
 */

/** A discrete engagement level for a client, driving the indicator colour. */
export type ActivityLevel = "active" | "atRisk" | "inactive"

/**
 * Traffic-light colour for an {@link ActivityLevel}. The values are stable
 * tokens (not CSS), so the UI maps them to theme classes and the copy layer
 * maps them to localized labels; tests assert the token, not styling.
 */
export type ActivityColor = "green" | "yellow" | "red"

/**
 * Inclusive lower bounds (in completion percent) for each activity level. A
 * client at or above `active` is green; at or above `atRisk` is yellow; below
 * that is red. Centralised here so the thresholds have one definition shared by
 * the page and its tests.
 */
export const ACTIVITY_THRESHOLDS = {
  /** >= this percent of the month's plan completed counts as fully active. */
  active: 50,
  /** >= this percent (but below `active`) counts as at-risk. */
  atRisk: 20,
} as const

/**
 * Maps a current-month completion percentage to a discrete activity level.
 *
 * The percentage is the share of the client's active-plan workouts completed in
 * the current calendar month (0-100). Boundaries are inclusive at the lower
 * bound: exactly `ACTIVITY_THRESHOLDS.active` is `active`, exactly
 * `ACTIVITY_THRESHOLDS.atRisk` is `atRisk`. A client with no active plan should
 * be passed `0`, which resolves to `inactive`.
 *
 * @param completionPercent - Current-month completion, an integer 0-100. Values
 *   outside the range are clamped by comparison (negative -> inactive,
 *   above 100 -> active).
 * @returns The discrete activity level.
 */
export function activityLevel(completionPercent: number): ActivityLevel {
  if (completionPercent >= ACTIVITY_THRESHOLDS.active) return "active"
  if (completionPercent >= ACTIVITY_THRESHOLDS.atRisk) return "atRisk"
  return "inactive"
}

/**
 * Maps an {@link ActivityLevel} to its traffic-light colour token. Kept
 * separate from {@link activityLevel} so callers that already hold a level
 * (e.g. after filtering) do not recompute it, and so the colour mapping has a
 * single source of truth.
 *
 * @param level - The activity level.
 * @returns The colour token: green (active), yellow (at-risk), red (inactive).
 */
export function activityColor(level: ActivityLevel): ActivityColor {
  switch (level) {
    case "active":
      return "green"
    case "atRisk":
      return "yellow"
    case "inactive":
      return "red"
  }
}

/**
 * Convenience that derives both the level and its colour from a completion
 * percentage in one call, for the common case where the caller needs both.
 *
 * @param completionPercent - Current-month completion, an integer 0-100.
 * @returns The activity level and its colour token.
 */
export function activityIndicator(completionPercent: number): {
  level: ActivityLevel
  color: ActivityColor
} {
  const level = activityLevel(completionPercent)
  return { level, color: activityColor(level) }
}
