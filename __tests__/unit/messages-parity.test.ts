import { describe, expect, it } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"

/**
 * Guards locale catalog parity: the English and Hebrew message files must expose
 * the exact same set of leaf keys. A missing key in either locale surfaces at
 * runtime as next-intl rendering the raw key path, so this test fails the build
 * the moment the two catalogs drift - the failure message lists the offending
 * dotted key paths so the gap is obvious.
 */

/** Collects every leaf key as a dotted path (e.g. `Onboarding.errors.phone.required`). */
function leafKeys(value: unknown, prefix = ""): Set<string> {
  const keys = new Set<string>()
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key
      for (const leaf of leafKeys(child, path)) keys.add(leaf)
    }
  } else {
    keys.add(prefix)
  }
  return keys
}

describe("message catalog parity", () => {
  it("en-US and he-IL expose identical leaf keys", () => {
    const en = leafKeys(enMessages)
    const he = leafKeys(heMessages)

    const missingInHe = [...en].filter((k) => !he.has(k)).sort()
    const missingInEn = [...he].filter((k) => !en.has(k)).sort()

    expect(missingInHe, "keys present in en-US but missing in he-IL").toEqual([])
    expect(missingInEn, "keys present in he-IL but missing in en-US").toEqual([])
  })
})
