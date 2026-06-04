import type { Metadata } from "next"
import {
  ArrowRight,
  Dumbbell,
  LineChart,
  Sparkles,
} from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { buildLocaleMetadata } from "@/lib/seo/metadata"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Locale } from "@/i18n/routing"

/**
 * Localized SEO metadata for the homepage. Delegates to
 * {@link buildLocaleMetadata}, which reads the `Metadata.home` namespace for the
 * active locale and emits title, description, Open Graph, and hreflang
 * alternates. Runs on the server only.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildLocaleMetadata(locale, "home")
}

/**
 * Static, ordered feature list rendered as the "How it works" section. Keys map
 * to the `Home` message namespace so all copy stays translatable, and each step
 * carries its own icon. Defined module-level so it is allocated once, not per
 * render.
 */
const FEATURES = [
  { icon: Sparkles, titleKey: "feature1Title", bodyKey: "feature1Body" },
  { icon: Dumbbell, titleKey: "feature2Title", bodyKey: "feature2Body" },
  { icon: LineChart, titleKey: "feature3Title", bodyKey: "feature3Body" },
] as const

/**
 * Public localized landing page for Studio Itai. Presents the product pitch, a
 * primary call-to-action for new clients (locale-preserving link to `/register`)
 * and a secondary login link for returning users, plus a "How it works"
 * section. The header (language switcher, theme toggle, auth-aware nav) is
 * supplied by the shared `SiteHeader` in the locale layout, so this page focuses
 * on landmark content.
 *
 * All copy comes from the `Home` namespace; CTAs use the locale-aware
 * {@link Link} so they keep the active language (`/en/register`, `/he/register`).
 * Landmarks (`<main>`, labelled `<section>`s, a single `<h1>`) give assistive
 * tech a navigable structure. The layout is responsive: a single column on
 * mobile, a multi-column feature grid from the `sm` breakpoint up.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  // Enable static rendering before invoking any translation API.
  setRequestLocale(locale)

  const t = await getTranslations("Home")

  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex flex-1 flex-col">
        <section
          aria-labelledby="hero-heading"
          className="flex flex-col items-center px-6 py-16 text-center sm:py-24"
        >
          <div className="flex max-w-2xl flex-col items-center gap-6">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {t("badge")}
            </Badge>

            <h1
              id="hero-heading"
              className="text-4xl font-bold tracking-tight sm:text-5xl"
            >
              {t("title")}
            </h1>

            <p className="max-w-xl text-lg text-muted-foreground">
              {t("description")}
            </p>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/register" className={buttonVariants({ size: "lg" })}>
                {t("primaryCta")}
                <ArrowRight
                  className="h-4 w-4 rtl:rotate-180"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/login"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                {t("secondaryCta")}
              </Link>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="features-heading"
          className="mx-auto w-full max-w-5xl px-6 pb-20"
        >
          <h2
            id="features-heading"
            className="mb-8 text-center text-2xl font-semibold tracking-tight"
          >
            {t("featuresHeading")}
          </h2>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, titleKey, bodyKey }) => (
              <li
                key={titleKey}
                className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 text-center"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="font-medium">{t(titleKey)}</h3>
                <p className="text-sm text-muted-foreground">{t(bodyKey)}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        {t("footer")}
      </footer>
    </div>
  )
}
