import type { Metadata } from "next"
import Image from "next/image"
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
import { cn } from "@/lib/utils"
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
 * Shared pill-CTA shape. DESIGN.md wants the home CTAs pill-shaped, but the
 * shared `Button`/`buttonVariants` use `rounded-lg` and must stay untouched
 * (they back the whole app). So the pill is applied as a scoped `rounded-full`
 * override layered on top of `buttonVariants`, only here.
 */
const HERO_CTA = "rounded-full"

/**
 * Public localized landing page for Studio Itai, styled as a DESIGN.md editorial
 * poster: a left/start-aligned display headline, the provided hero banner
 * rendered with `next/image`, pill-shaped CTAs, and a token-radius feature grid.
 * The primary CTA is a locale-preserving link to `/register`, the secondary to
 * `/login`; both keep the active language via the locale-aware {@link Link}
 * (`/en/register`, `/he/register`). The header and footer are supplied by the
 * shared chrome in the locale layout, so this page owns only its landmark
 * content.
 *
 * All copy comes from the `Home` namespace. Landmarks (`<main>`, labelled
 * `<section>`s, a single `<h1>`) give assistive tech a navigable structure.
 * Layout is responsive: stacked on mobile, a two-column poster from `lg` up.
 * Theme contrast is carried entirely by semantic tokens, including the scrim on
 * the accent band, so the overlay headline holds in both light and dark.
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
    <main className="flex flex-1 flex-col">
      <section
        aria-labelledby="hero-heading"
        className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 text-start sm:py-24 lg:grid-cols-2"
      >
        <div className="flex flex-col items-start gap-6">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {t("badge")}
          </Badge>

          <h1
            id="hero-heading"
            className="font-display text-5xl uppercase leading-[0.9] tracking-tight sm:text-6xl lg:text-7xl"
          >
            {t("title")}
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground">
            {t("description")}
          </p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "lg" }), HERO_CTA)}
            >
              {t("primaryCta")}
              <ArrowRight
                className="h-4 w-4 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                HERO_CTA
              )}
            >
              {t("secondaryCta")}
            </Link>
          </div>
        </div>

        <Image
          src="/header-banner.png"
          alt=""
          aria-hidden="true"
          width={1672}
          height={941}
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="w-full rounded-special border object-cover shadow-sm"
        />
      </section>

      <section
        aria-labelledby="features-heading"
        className="mx-auto w-full max-w-5xl px-6 pb-20"
      >
        <h2
          id="features-heading"
          className="mb-8 text-start font-display text-3xl uppercase tracking-tight"
        >
          {t("featuresHeading")}
        </h2>
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, titleKey, bodyKey }) => (
            <li
              key={titleKey}
              className="flex flex-col items-start gap-3 rounded-cards border bg-card p-6 text-start"
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

      <section
        aria-labelledby="cta-band-heading"
        className="mx-auto w-full max-w-6xl px-6 pb-20"
      >
        <div className="relative isolate overflow-hidden rounded-special border">
          <Image
            src="/images/home-accent.jpg"
            alt=""
            aria-hidden="true"
            width={1400}
            height={933}
            sizes="(min-width: 1152px) 1104px, 100vw"
            className="h-64 w-full object-cover sm:h-80"
          />
          {/* Token scrim (no rgba literal): guarantees overlay contrast in BOTH
              themes because `bg-background` follows the active theme token. */}
          <div className="absolute inset-0 bg-background/60" aria-hidden="true" />
          <div className="absolute inset-0 flex flex-col items-start justify-center gap-4 p-6 text-start sm:p-10">
            <h2
              id="cta-band-heading"
              className="max-w-lg font-display text-3xl uppercase leading-[0.95] tracking-tight text-foreground sm:text-4xl"
            >
              {t("bandHeading")}
            </h2>
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "lg" }), HERO_CTA)}
            >
              {t("bandCta")}
              <ArrowRight
                className="h-4 w-4 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
