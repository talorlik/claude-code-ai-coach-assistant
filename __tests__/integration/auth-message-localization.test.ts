import { describe, expect, it } from "vitest"

import enUS from "@/messages/en-US.json"
import heIL from "@/messages/he-IL.json"
import {
  AUTH_MESSAGE_CODES,
  resolveAuthMessage,
  type AuthMessageCode,
} from "@/lib/auth/resolve-auth-message"

/**
 * Verifies auth error/notice localization end to end against the real message
 * catalogs: every stable code has a non-empty string in both locales, the two
 * locales differ (Hebrew is actually translated, not copied), and
 * resolveAuthMessage returns the catalog text when wired to a catalog-backed
 * translator. This is the closest unit-level proxy for the rendered auth pages.
 */

type Catalog = { AuthMessages: Record<string, string> }

/** Builds a translator over a locale's AuthMessages namespace. */
function translatorFor(catalog: Catalog) {
  return (key: AuthMessageCode): string => catalog.AuthMessages[key]
}

const en = enUS as unknown as Catalog
const he = heIL as unknown as Catalog

describe("auth message localization", () => {
  it("defines every allowlisted code in both locales", () => {
    for (const code of AUTH_MESSAGE_CODES) {
      expect(en.AuthMessages[code], `en-US missing ${code}`).toBeTruthy()
      expect(he.AuthMessages[code], `he-IL missing ${code}`).toBeTruthy()
    }
  })

  it("adds no extra keys to the AuthMessages namespace", () => {
    const allowed = new Set<string>(AUTH_MESSAGE_CODES)
    for (const key of Object.keys(en.AuthMessages)) {
      expect(allowed.has(key), `unexpected en key ${key}`).toBe(true)
    }
    for (const key of Object.keys(he.AuthMessages)) {
      expect(allowed.has(key), `unexpected he key ${key}`).toBe(true)
    }
  })

  it("translates Hebrew differently from English (real translation)", () => {
    // invalidCredentials is a representative user-facing string.
    expect(he.AuthMessages.invalidCredentials).not.toBe(
      en.AuthMessages.invalidCredentials
    )
    // The Hebrew copy contains Hebrew characters.
    expect(he.AuthMessages.invalidCredentials).toMatch(/[֐-׿]/)
  })

  it("resolves a known code via the locale-bound translator", () => {
    expect(resolveAuthMessage(translatorFor(en), "invalidCredentials")).toBe(
      en.AuthMessages.invalidCredentials
    )
    expect(resolveAuthMessage(translatorFor(he), "invalidCredentials")).toBe(
      he.AuthMessages.invalidCredentials
    )
  })

  it("returns null for a forged code regardless of locale", () => {
    expect(resolveAuthMessage(translatorFor(en), "../../etc/passwd")).toBeNull()
    expect(resolveAuthMessage(translatorFor(he), "../../etc/passwd")).toBeNull()
  })
})
