import { defineRouting } from "next-intl/routing"

/**
 * Maps a URL locale prefix to its IETF BCP 47 tag.
 *
 * The app routes under `/en` and `/he` for short, friendly URLs, while the
 * underlying locale identities are `en-US` and `he-IL`. Keeping the prefixes
 * and the full tags separate lets the URLs stay terse without losing the
 * region information that formatting (dates, numbers) depends on.
 */
export const LOCALE_TAGS = {
  en: "en-US",
  he: "he-IL",
} as const

/** A supported URL locale prefix (`"en"` or `"he"`). */
export type Locale = keyof typeof LOCALE_TAGS

/** A supported full locale tag (`"en-US"` or `"he-IL"`). */
export type LocaleTag = (typeof LOCALE_TAGS)[Locale]

/** Locales rendered right-to-left. Hebrew is the only RTL locale here. */
const RTL_LOCALES = new Set<Locale>(["he"])

/**
 * next-intl routing configuration: the supported locale prefixes, the default,
 * and `localePrefix: "always"` so every path carries an explicit locale (`/en`,
 * `/he`). An explicit prefix keeps locale unambiguous for SEO and for the
 * locale-preserving navigation helpers in `i18n/navigation.ts`.
 */
export const routing = defineRouting({
  locales: Object.keys(LOCALE_TAGS) as Locale[],
  defaultLocale: "en",
  localePrefix: "always",
})

/**
 * Returns the BCP 47 tag for a locale prefix (e.g. `"he"` -> `"he-IL"`).
 *
 * @param locale - A supported locale prefix.
 * @returns The full locale tag used for the `lang` attribute and formatting.
 */
export function localeTag(locale: Locale): LocaleTag {
  return LOCALE_TAGS[locale]
}

/**
 * Returns the writing direction for a locale prefix.
 *
 * @param locale - A supported locale prefix.
 * @returns `"rtl"` for right-to-left locales (Hebrew), otherwise `"ltr"`.
 */
export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr"
}

/**
 * Type guard narrowing an arbitrary string to a supported {@link Locale}.
 *
 * @param value - Any string, typically a `[locale]` route segment.
 * @returns `true` when `value` is a supported locale prefix.
 */
export function isSupportedLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value)
}
