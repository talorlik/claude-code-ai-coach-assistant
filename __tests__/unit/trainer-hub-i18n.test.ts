import { describe, expect, it } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"

/**
 * Key-parity guard for the `TrainerHub` namespace added in batch 23. The trainer
 * dashboard renders the same keys regardless of locale, so the English and
 * Hebrew catalogs must define an identical, non-empty key set; a missing key
 * would surface as a runtime next-intl error on one locale only.
 */
describe("TrainerHub i18n parity", () => {
  const en = enMessages.TrainerHub as Record<string, string>
  const he = heMessages.TrainerHub as Record<string, string>

  it("defines the namespace in both catalogs", () => {
    expect(en).toBeTruthy()
    expect(he).toBeTruthy()
  })

  it("has an identical key set across en-US and he-IL", () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort())
  })

  it("has non-empty values for every key in both locales", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en-US TrainerHub.${key}`).toBeTruthy()
    }
    for (const [key, value] of Object.entries(he)) {
      expect(value, `he-IL TrainerHub.${key}`).toBeTruthy()
    }
  })

  it("does not leave Hebrew values identical to English (untranslated)", () => {
    for (const key of Object.keys(en)) {
      expect(he[key], `he-IL TrainerHub.${key} should be translated`).not.toBe(
        en[key]
      )
    }
  })
})
