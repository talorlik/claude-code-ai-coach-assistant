import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"

import { localeTag, routing, type Locale } from "./routing"

/**
 * Per-request next-intl configuration. Resolves the active locale from the
 * `[locale]` route segment, falling back to the default when the segment is
 * missing or unsupported, and loads the matching message catalog.
 *
 * Messages are keyed by the full BCP 47 tag (`en-US`, `he-IL`) so the catalog
 * filenames match the locale identities used elsewhere in the app.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale: Locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  const tag = localeTag(locale)
  const messages = (await import(`../messages/${tag}.json`)).default

  return { locale, messages }
})
