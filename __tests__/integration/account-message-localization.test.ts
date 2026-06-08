import { describe, expect, it } from "vitest"

import enUS from "@/messages/en-US.json"
import heIL from "@/messages/he-IL.json"
import {
  ACCOUNT_MESSAGE_CODES,
  resolveAccountMessage,
  type AccountMessageCode,
} from "@/lib/profile/resolve-account-message"

/**
 * Verifies account form feedback localization end to end against the real
 * message catalogs: every stable code has a non-empty string in both locales,
 * the two locales differ (Hebrew is actually translated, not copied), and
 * resolveAccountMessage returns the catalog text when wired to a catalog-backed
 * translator. This is the closest unit-level proxy for the rendered profile
 * page banner.
 */

type Catalog = { Account: Record<string, string> }

/** Builds a translator over a locale's Account namespace. */
function translatorFor(catalog: Catalog) {
  return (key: AccountMessageCode): string => catalog.Account[key]
}

const en = enUS as unknown as Catalog
const he = heIL as unknown as Catalog

describe("account message localization", () => {
  it("defines every allowlisted code in both locales", () => {
    for (const code of ACCOUNT_MESSAGE_CODES) {
      expect(en.Account[code], `en-US missing ${code}`).toBeTruthy()
      expect(he.Account[code], `he-IL missing ${code}`).toBeTruthy()
    }
  })

  it("adds no extra keys to the Account namespace", () => {
    // Non-code keys that legitimately live in the Account namespace: page copy
    // that is never resolved through resolveAccountMessage. `title` is the
    // localized page heading / tab title; keeping it out of
    // ACCOUNT_MESSAGE_CODES is what prevents a forged `?notice=title` from
    // reflecting it. The guard still catches any *unexpected* key drift.
    const NON_CODE_KEYS = ["title"] as const
    const allowed = new Set<string>([...ACCOUNT_MESSAGE_CODES, ...NON_CODE_KEYS])
    for (const key of Object.keys(en.Account)) {
      expect(allowed.has(key), `unexpected en key ${key}`).toBe(true)
    }
    for (const key of Object.keys(he.Account)) {
      expect(allowed.has(key), `unexpected he key ${key}`).toBe(true)
    }
  })

  it("translates Hebrew differently from English (real translation)", () => {
    // detailsSaved is a representative user-facing string.
    expect(he.Account.detailsSaved).not.toBe(en.Account.detailsSaved)
    // The Hebrew copy contains Hebrew characters.
    expect(he.Account.detailsSaved).toMatch(/[֐-׿]/)
  })

  it("resolves a known code via the locale-bound translator", () => {
    expect(resolveAccountMessage(translatorFor(en), "detailsSaved")).toBe(
      en.Account.detailsSaved
    )
    expect(resolveAccountMessage(translatorFor(he), "detailsSaved")).toBe(
      he.Account.detailsSaved
    )
  })

  it("returns null for a forged code regardless of locale", () => {
    expect(
      resolveAccountMessage(translatorFor(en), "../../etc/passwd")
    ).toBeNull()
    expect(
      resolveAccountMessage(translatorFor(he), "../../etc/passwd")
    ).toBeNull()
  })
})
