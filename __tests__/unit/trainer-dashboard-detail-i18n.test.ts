import { describe, expect, it } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"

/**
 * Key-parity guard for the batch-24 dashboard copy: the `TrainerDashboard.push`
 * and `TrainerDashboard.planDetail` namespaces, plus the `plan.exportPdf` label.
 * Each must define an identical, non-empty, translated key set across the
 * English and Hebrew catalogs; a missing key would surface as a runtime
 * next-intl error on one locale only.
 */
const en = enMessages.TrainerDashboard
const he = heMessages.TrainerDashboard

function assertParity(
  name: string,
  enGroup: Record<string, string>,
  heGroup: Record<string, string>
) {
  describe(`${name} i18n parity`, () => {
    it("defines the group in both catalogs", () => {
      expect(enGroup).toBeTruthy()
      expect(heGroup).toBeTruthy()
    })

    it("has an identical key set across en-US and he-IL", () => {
      expect(Object.keys(heGroup).sort()).toEqual(Object.keys(enGroup).sort())
    })

    it("has non-empty, translated values in both locales", () => {
      for (const key of Object.keys(enGroup)) {
        expect(enGroup[key], `en-US ${name}.${key}`).toBeTruthy()
        expect(heGroup[key], `he-IL ${name}.${key}`).toBeTruthy()
        // Hebrew must not be a copy of the English string.
        expect(
          heGroup[key],
          `he-IL ${name}.${key} should be translated`
        ).not.toBe(enGroup[key])
      }
    })
  })
}

assertParity(
  "TrainerDashboard.push",
  en.push as Record<string, string>,
  he.push as Record<string, string>
)

assertParity(
  "TrainerDashboard.planDetail",
  en.planDetail as Record<string, string>,
  he.planDetail as Record<string, string>
)

describe("TrainerDashboard.plan.exportPdf", () => {
  it("is defined, non-empty, and translated in both catalogs", () => {
    expect(en.plan.exportPdf).toBeTruthy()
    expect(he.plan.exportPdf).toBeTruthy()
    expect(he.plan.exportPdf).not.toBe(en.plan.exportPdf)
  })
})
