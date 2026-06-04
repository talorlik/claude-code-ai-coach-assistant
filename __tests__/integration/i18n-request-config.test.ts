import { describe, expect, it } from "vitest"
import { hasLocale } from "next-intl"

import { localeTag, routing } from "@/i18n/routing"

/**
 * Covers the locale-resolution decision the next-intl request config makes and
 * the catalog wiring it relies on. `getRequestConfig` itself runs only in a
 * server context (it throws in the jsdom/client build Vitest loads), so its two
 * moving parts are exercised directly here:
 *   1. `hasLocale(routing.locales, requested) ? requested : defaultLocale` -
 *      the supported / unsupported / missing fallback.
 *   2. that each resolved locale has a loadable, non-empty message catalog at
 *      `messages/<tag>.json`.
 */

/** Mirrors the resolution in `i18n/request.ts`. */
function resolveLocale(requested: string | undefined): string {
  return hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale
}

describe("locale resolution (request config)", () => {
  it("keeps a supported locale", () => {
    expect(resolveLocale("he")).toBe("he")
    expect(resolveLocale("en")).toBe("en")
  })

  it("falls back to the default for an unsupported value", () => {
    expect(resolveLocale("fr")).toBe("en")
  })

  it("falls back to the default when none is provided", () => {
    expect(resolveLocale(undefined)).toBe("en")
  })
})

describe("message catalogs", () => {
  it("loads a non-empty catalog for every supported locale", async () => {
    for (const locale of routing.locales) {
      const tag = localeTag(locale)
      const messages = (await import(`../../messages/${tag}.json`)).default
      expect(Object.keys(messages).length).toBeGreaterThan(0)
      // A representative key both catalogs must define.
      expect(messages.Home?.title).toBeTruthy()
    }
  })
})
