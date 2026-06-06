import { describe, expect, it } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"

/**
 * Key-parity guard for the batch-25 authoring copy: the new `TrainerPlans.ai`
 * AI-template block (and its `actions.createAi` label) and the whole
 * `PlanEditor` namespace. Each flat group must define an identical, non-empty,
 * translated key set across the English and Hebrew catalogs; a missing key would
 * surface as a runtime next-intl error on one locale only.
 */

/** Recursively flattens a nested message object to dotted leaf keys. */
function flatten(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object") {
      Object.assign(out, flatten(value as Record<string, unknown>, path))
    } else {
      out[path] = String(value)
    }
  }
  return out
}

function assertParity(
  name: string,
  enGroup: Record<string, unknown>,
  heGroup: Record<string, unknown>
) {
  describe(`${name} i18n parity`, () => {
    const enFlat = flatten(enGroup)
    const heFlat = flatten(heGroup)

    it("defines the group in both catalogs", () => {
      expect(enGroup).toBeTruthy()
      expect(heGroup).toBeTruthy()
    })

    it("has an identical leaf-key set across en-US and he-IL", () => {
      expect(Object.keys(heFlat).sort()).toEqual(Object.keys(enFlat).sort())
    })

    it("has non-empty, translated values in both locales", () => {
      for (const key of Object.keys(enFlat)) {
        expect(enFlat[key], `en-US ${name}.${key}`).toBeTruthy()
        expect(heFlat[key], `he-IL ${name}.${key}`).toBeTruthy()
        expect(
          heFlat[key],
          `he-IL ${name}.${key} should be translated`
        ).not.toBe(enFlat[key])
      }
    })
  })
}

assertParity(
  "TrainerPlans.ai",
  enMessages.TrainerPlans.ai as unknown as Record<string, unknown>,
  heMessages.TrainerPlans.ai as unknown as Record<string, unknown>
)

assertParity(
  "PlanEditor",
  enMessages.PlanEditor as unknown as Record<string, unknown>,
  heMessages.PlanEditor as unknown as Record<string, unknown>
)

describe("TrainerPlans.actions.createAi", () => {
  it("is defined, non-empty, and translated in both catalogs", () => {
    expect(enMessages.TrainerPlans.actions.createAi).toBeTruthy()
    expect(heMessages.TrainerPlans.actions.createAi).toBeTruthy()
    expect(heMessages.TrainerPlans.actions.createAi).not.toBe(
      enMessages.TrainerPlans.actions.createAi
    )
  })
})
