import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import type enMessages from "@/messages/en-US.json"
import { localeTag, routing, type Locale } from "@/i18n/routing"

/** A page key under the `Metadata` message namespace (e.g. `"home"`). */
type MetadataKey = keyof (typeof enMessages)["Metadata"]

/**
 * Resolves the absolute site origin used as the metadata base.
 *
 * `NEXT_PUBLIC_APP_URL` is the canonical public origin (set per environment in
 * Vercel). When it is absent - local `next build` without an env file, or a
 * test runner - we fall back to localhost so `new URL(...)` never throws and the
 * build stays green. The base lets Next.js resolve the relative Open Graph and
 * canonical URLs below into absolute ones.
 */
function resolveMetadataBase(): URL {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return new URL(origin)
}

/**
 * Builds the locale-aware `alternates.languages` map (`en-US` -> `/en`,
 * `he-IL` -> `/he`) so search engines can discover every localized variant of a
 * path. Keyed by the full BCP 47 tag to match the `lang` attribute the layout
 * emits.
 *
 * @param path - The locale-agnostic path suffix (e.g. `""` for the homepage),
 *   prefixed onto each locale segment.
 * @returns A map from BCP 47 tag to its locale-prefixed absolute-from-root path.
 */
function buildLanguageAlternates(path: string): Record<string, string> {
  const suffix = path.replace(/^\/+/, "")
  return Object.fromEntries(
    routing.locales.map((locale) => [
      localeTag(locale),
      suffix ? `/${locale}/${suffix}` : `/${locale}`,
    ])
  )
}

/**
 * Produces localized page {@link Metadata} (title, description, Open Graph, and
 * hreflang alternates) from the `Metadata` message namespace for the given
 * locale. Server-only: it calls {@link getTranslations}, so it must run inside a
 * `generateMetadata` export, never in client code.
 *
 * Open Graph `locale` uses the underscore form (`en_US`, `he_IL`) the OG spec
 * expects, derived from the BCP 47 tag.
 *
 * @param locale - The active URL locale prefix from the `[locale]` segment.
 * @param key - The `Metadata` sub-namespace to read (e.g. `"home"`).
 * @param path - Locale-agnostic path suffix for the canonical/alternate links.
 * @returns A Next.js {@link Metadata} object with localized fields.
 */
export async function buildLocaleMetadata(
  locale: Locale,
  key: MetadataKey,
  path = ""
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `Metadata.${key}` })
  const tag = localeTag(locale)
  const ogLocale = tag.replace("-", "_")
  const title = t("title")
  const description = t("description")
  const canonical = path ? `/${locale}/${path.replace(/^\/+/, "")}` : `/${locale}`

  return {
    metadataBase: resolveMetadataBase(),
    title,
    description,
    alternates: {
      canonical,
      languages: buildLanguageAlternates(path),
    },
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title,
      description,
      url: canonical,
      locale: ogLocale,
    },
  }
}
