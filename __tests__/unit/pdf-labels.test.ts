import { describe, expect, it } from "vitest"

import { getPdfLabels } from "@/lib/pdf/labels"

/**
 * Unit tests for the locale-keyed PDF label resolver. The workout-plan PDF is
 * drawn outside the React tree, so it cannot use the next-intl hooks and instead
 * selects a static label set by locale prefix. These tests pin the locale
 * mapping (`/en` -> en-US, `/he` -> he-IL) and the unknown-locale fallback so the
 * document is never produced without labels.
 */
describe("getPdfLabels", () => {
  it("returns the English label set for the 'en' prefix", () => {
    const labels = getPdfLabels("en")
    expect(labels.documentTitle).toBe("Workout Plan")
    expect(labels.exercise.sets).toBe("Sets")
    expect(labels.weekday.monday).toBe("Monday")
  })

  it("returns the Hebrew label set for the 'he' prefix", () => {
    const labels = getPdfLabels("he")
    // Hebrew copy must differ from English so RTL plans read in the right
    // language; assert a couple of representative fields.
    expect(labels.documentTitle).not.toBe("Workout Plan")
    expect(labels.weekday.monday).toBe("יום שני")
    expect(labels.safetyDisclaimer.length).toBeGreaterThan(0)
  })

  it("falls back to English for any unknown locale value", () => {
    const en = getPdfLabels("en")
    expect(getPdfLabels("fr")).toEqual(en)
    expect(getPdfLabels("")).toEqual(en)
  })

  it("exposes a complete label set for both locales", () => {
    // Every advertised field must be present and non-empty in both catalogs so a
    // PDF in either locale can never render a blank label.
    for (const locale of ["en", "he"] as const) {
      const l = getPdfLabels(locale)
      const flat = [
        l.documentTitle,
        l.client,
        l.generated,
        l.weeklySchedule,
        l.restDay,
        l.unscheduled,
        l.untitledWorkout,
        l.emptyPlan,
        l.safetyDisclaimer,
        ...Object.values(l.exercise),
        ...Object.values(l.weekday),
      ]
      for (const value of flat) {
        expect(typeof value).toBe("string")
        expect(value.length).toBeGreaterThan(0)
      }
    }
  })
})
