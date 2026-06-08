import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"

/**
 * Locale-aware site footer rendered once in the locale layout so every page
 * inherits it. Server-rendered: it reads the `Footer` message namespace for the
 * active locale and emits the app tagline, a small set of locale-preserving
 * navigation links (Home, About, Contact via the locale-aware {@link Link}), and
 * a copyright line whose year is computed server-side at render time.
 *
 * The About and Contact routes are introduced in Batch 28; the footer links to
 * them ahead of time so the shared chrome is complete the moment those pages
 * ship. All styling uses semantic tokens (`bg-background`, `border-border`,
 * `text-muted-foreground`) so the footer holds contrast in both themes and stays
 * correct under RTL without per-direction overrides.
 */
export async function SiteFooter() {
  const t = await getTranslations("Footer")
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display uppercase tracking-wide text-foreground">
          {t("tagline")}
        </p>

        <nav
          aria-label={t("tagline")}
          className="flex items-center gap-6"
        >
          <Link href="/" className="hover:text-foreground hover:underline">
            {t("home")}
          </Link>
          <Link href="/about" className="hover:text-foreground hover:underline">
            {t("about")}
          </Link>
          <Link
            href="/contact"
            className="hover:text-foreground hover:underline"
          >
            {t("contact")}
          </Link>
        </nav>

        <p className="text-xs">{t("rights", { year })}</p>
      </div>
    </footer>
  )
}
