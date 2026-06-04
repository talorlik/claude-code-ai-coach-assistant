import type messages from "./messages/en-US.json"
import type { routing } from "./i18n/routing"

/**
 * Strictly types next-intl across the app:
 * - `Locale` narrows to the supported prefixes (`"en" | "he"`), so
 *   `getLocale()` and the navigation helpers' `locale` argument agree with the
 *   routing config (and a `redirect({locale})` call type-checks and narrows).
 * - `Messages` types translation keys against the English catalog, so `t("…")`
 *   keys are checked at compile time.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number]
    Messages: typeof messages
  }
}
