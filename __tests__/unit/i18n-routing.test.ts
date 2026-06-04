import { describe, expect, it } from "vitest"

import {
  LOCALE_TAGS,
  isSupportedLocale,
  localeDirection,
  localeTag,
  routing,
} from "@/i18n/routing"

/**
 * Unit coverage for the locale configuration: prefix support, prefix->tag
 * mapping, writing-direction mapping, and unsupported-locale rejection (the
 * decision the `[locale]` layout uses to 404 and the middleware uses to fall
 * back to the default).
 */

describe("routing configuration", () => {
  it("supports exactly the en and he prefixes with en as default", () => {
    expect(routing.locales).toEqual(["en", "he"])
    expect(routing.defaultLocale).toBe("en")
  })

  it("always prefixes the locale in the URL", () => {
    expect(routing.localePrefix).toBe("always")
  })
})

describe("localeTag", () => {
  it("maps en to en-US and he to he-IL", () => {
    expect(localeTag("en")).toBe("en-US")
    expect(localeTag("he")).toBe("he-IL")
  })

  it("matches the LOCALE_TAGS table", () => {
    expect(localeTag("en")).toBe(LOCALE_TAGS.en)
    expect(localeTag("he")).toBe(LOCALE_TAGS.he)
  })
})

describe("localeDirection", () => {
  it("returns ltr for English", () => {
    expect(localeDirection("en")).toBe("ltr")
  })

  it("returns rtl for Hebrew", () => {
    expect(localeDirection("he")).toBe("rtl")
  })
})

describe("isSupportedLocale", () => {
  it("accepts supported prefixes", () => {
    expect(isSupportedLocale("en")).toBe(true)
    expect(isSupportedLocale("he")).toBe(true)
  })

  it("rejects unsupported or malformed prefixes", () => {
    for (const value of ["fr", "EN", "en-US", "", "de", "h"]) {
      expect(isSupportedLocale(value)).toBe(false)
    }
  })
})
