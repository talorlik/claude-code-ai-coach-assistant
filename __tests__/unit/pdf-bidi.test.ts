import { describe, expect, it } from "vitest"

import { fixRtlNumerals } from "@/lib/pdf/bidi"

/**
 * Unit tests for the RTL numeral fix. `pdf-lib`/fontkit shape Hebrew runs
 * correctly but paint embedded digit runs in the surrounding RTL visual order,
 * so the helper pre-reverses each numeric run for an RTL base; the renderer's
 * own reversal then cancels out, leaving numbers readable. LTR text and pure
 * Hebrew letters must be untouched.
 */

describe("fixRtlNumerals", () => {
  it("leaves LTR text unchanged", () => {
    const line = "Sets: 4 Reps: 8-10"
    expect(fixRtlNumerals(line, "ltr")).toBe(line)
  })

  it("returns an empty string unchanged", () => {
    expect(fixRtlNumerals("", "rtl")).toBe("")
  })

  it("does not alter Hebrew letters", () => {
    expect(fixRtlNumerals("בניית כוח", "rtl")).toBe("בניית כוח")
  })

  it("pre-reverses a standalone number run in an RTL line", () => {
    // "10" -> "01" so fontkit's RTL reversal restores "10".
    expect(fixRtlNumerals("התחממו 10 דקות", "rtl")).toBe("התחממו 01 דקות")
  })

  it("pre-reverses a range and a date", () => {
    expect(fixRtlNumerals("חזרות: 8-10", "rtl")).toBe("חזרות: 01-8")
    expect(fixRtlNumerals("בתאריך 2026-06-05", "rtl")).toBe("בתאריך 50-60-6202")
  })

  it("preserves the character multiset", () => {
    const input = "יום שני: 8-10 חזרות"
    const sorted = (s: string) => Array.from(s).sort().join("")
    expect(sorted(fixRtlNumerals(input, "rtl"))).toBe(sorted(input))
  })
})
