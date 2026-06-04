import { describe, expect, it, vi } from "vitest"

import enMessages from "../../messages/en-US.json"
import heMessages from "../../messages/he-IL.json"

/**
 * Resolve `Metadata.<key>` lookups against the real catalogs so the test
 * exercises the helper's wiring (which namespace it reads, how it shapes the
 * result) against the same copy the app ships, rather than against fixtures
 * that could drift. `getTranslations({ locale, namespace })` is the only part of
 * next-intl/server the helper uses.
 */
const catalogs = { en: enMessages, he: heMessages } as const

vi.mock("next-intl/server", () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: "en" | "he"
    namespace: string
  }) => {
    const [root, sub] = namespace.split(".")
    const messages = catalogs[locale] as unknown as Record<
      string,
      Record<string, Record<string, string>>
    >
    const table = messages[root][sub]
    return (key: string) => table[key]
  },
}))

import { buildLocaleMetadata } from "@/lib/seo/metadata"

describe("buildLocaleMetadata", () => {
  it("returns the English title and description from the Metadata namespace", async () => {
    const metadata = await buildLocaleMetadata("en", "home")
    expect(metadata.title).toBe(enMessages.Metadata.home.title)
    expect(metadata.description).toBe(enMessages.Metadata.home.description)
  })

  it("returns the Hebrew title and description from the Metadata namespace", async () => {
    const metadata = await buildLocaleMetadata("he", "home")
    expect(metadata.title).toBe(heMessages.Metadata.home.title)
    expect(metadata.description).toBe(heMessages.Metadata.home.description)
  })

  it("emits Open Graph fields with the OG locale form", async () => {
    const en = await buildLocaleMetadata("en", "home")
    expect(en.openGraph?.locale).toBe("en_US")
    expect(en.openGraph).toMatchObject({
      type: "website",
      siteName: enMessages.Metadata.home.siteName,
      title: enMessages.Metadata.home.title,
      url: "/en",
    })

    const he = await buildLocaleMetadata("he", "home")
    expect(he.openGraph?.locale).toBe("he_IL")
  })

  it("sets canonical and hreflang alternates for both locales", async () => {
    const metadata = await buildLocaleMetadata("he", "home")
    expect(metadata.alternates?.canonical).toBe("/he")
    expect(metadata.alternates?.languages).toEqual({
      "en-US": "/en",
      "he-IL": "/he",
    })
  })

  it("builds alternates for a nested path", async () => {
    const metadata = await buildLocaleMetadata("en", "home", "about")
    expect(metadata.alternates?.canonical).toBe("/en/about")
    expect(metadata.alternates?.languages).toEqual({
      "en-US": "/en/about",
      "he-IL": "/he/about",
    })
  })

  it("derives metadataBase from NEXT_PUBLIC_APP_URL when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://studio-itai.example.com")
    const metadata = await buildLocaleMetadata("en", "home")
    expect(metadata.metadataBase?.toString()).toBe(
      "https://studio-itai.example.com/"
    )
    vi.unstubAllEnvs()
  })
})
