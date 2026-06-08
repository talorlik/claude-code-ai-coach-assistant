import type { Metadata } from "next"
import Image from "next/image"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { buildLocaleMetadata } from "@/lib/seo/metadata"
import type { Locale } from "@/i18n/routing"

/**
 * Localized SEO metadata for the About page. Delegates to
 * {@link buildLocaleMetadata}, which reads the `Metadata.about` namespace and
 * emits the title, description, Open Graph, and hreflang alternates. Passing the
 * `"about"` path suffix makes the `alternates.languages` map point at
 * `/en/about` and `/he/about`. Server-only.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildLocaleMetadata(locale, "about", "about")
}

/**
 * The five training principles, in display order. Keys map into the `About`
 * namespace so every line stays translatable. Defined module-level so the array
 * is allocated once, not per render.
 */
const PRINCIPLES = [
  { titleKey: "principle1Title", bodyKey: "principle1Body" },
  { titleKey: "principle2Title", bodyKey: "principle2Body" },
  { titleKey: "principle3Title", bodyKey: "principle3Body" },
  { titleKey: "principle4Title", bodyKey: "principle4Body" },
  { titleKey: "principle5Title", bodyKey: "principle5Body" },
] as const

/**
 * Public, localized, theme-aware About page for Studio Itai. Server-rendered
 * following the home-page pattern: it opts into static rendering with
 * {@link setRequestLocale} before reading any translation, exposes a single
 * `<h1>` plus labelled `<section>` landmarks for assistive tech, and renders the
 * three curated section images with `next/image` and localized `alt` text. All
 * copy comes from the `About` message namespace, mirroring the long-form
 * structure of `docs/content/ABOUT_{EN,HE}.md`: intro, story, what we do, the
 * five-principle training philosophy, why AI, what makes us different, for
 * clients, for the trainer, and the mission. The header and footer are supplied
 * by the locale layout chrome, so this page owns only its landmark content and
 * stays correct under RTL via logical (`text-start`) alignment.
 */
export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("About")

  return (
    <main className="flex flex-1 flex-col">
      {/* Intro / hero */}
      <section
        aria-labelledby="about-heading"
        className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 text-start sm:py-24 lg:grid-cols-2"
      >
        <div className="flex flex-col items-start gap-6">
          <h1
            id="about-heading"
            className="font-display text-4xl uppercase leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl"
          >
            {t("introTitle")}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {t("introLead")}
          </p>
          <p className="max-w-xl text-muted-foreground">{t("introBody")}</p>
        </div>

        <Image
          src="/images/about-hero.jpg"
          alt={t("heroImageAlt")}
          width={1600}
          height={1066}
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="w-full rounded-special border object-cover shadow-sm"
        />
      </section>

      {/* The story */}
      <section
        aria-labelledby="about-story-heading"
        className="mx-auto w-full max-w-3xl px-6 pb-16 text-start"
      >
        <h2
          id="about-story-heading"
          className="mb-6 font-display text-3xl uppercase tracking-tight"
        >
          {t("storyTitle")}
        </h2>
        <div className="flex flex-col gap-4 text-muted-foreground">
          <p>{t("storyBody1")}</p>
          <p>{t("storyBody2")}</p>
          <p>{t("storyBody3")}</p>
        </div>
      </section>

      {/* What we do */}
      <section
        aria-labelledby="about-what-heading"
        className="mx-auto w-full max-w-3xl px-6 pb-16 text-start"
      >
        <h2
          id="about-what-heading"
          className="mb-6 font-display text-3xl uppercase tracking-tight"
        >
          {t("whatTitle")}
        </h2>
        <p className="text-muted-foreground">{t("whatBody")}</p>
      </section>

      {/* Training philosophy + the five principles */}
      <section
        aria-labelledby="about-philosophy-heading"
        className="mx-auto grid w-full max-w-6xl items-start gap-10 px-6 pb-16 text-start lg:grid-cols-2"
      >
        <div className="flex flex-col gap-6">
          <h2
            id="about-philosophy-heading"
            className="font-display text-3xl uppercase tracking-tight"
          >
            {t("philosophyTitle")}
          </h2>
          <p className="text-muted-foreground">{t("philosophyLead")}</p>
          <ul className="flex flex-col gap-5">
            {PRINCIPLES.map(({ titleKey, bodyKey }) => (
              <li
                key={titleKey}
                className="rounded-cards border bg-card p-5 text-start"
              >
                <h3 className="mb-1 font-medium">{t(titleKey)}</h3>
                <p className="text-sm text-muted-foreground">{t(bodyKey)}</p>
              </li>
            ))}
          </ul>
        </div>

        <Image
          src="/images/about-philosophy.jpg"
          alt={t("philosophyImageAlt")}
          width={1200}
          height={1500}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="w-full rounded-special border object-cover shadow-sm lg:sticky lg:top-24"
        />
      </section>

      {/* Why AI */}
      <section
        aria-labelledby="about-ai-heading"
        className="mx-auto w-full max-w-3xl px-6 pb-16 text-start"
      >
        <h2
          id="about-ai-heading"
          className="mb-6 font-display text-3xl uppercase tracking-tight"
        >
          {t("aiTitle")}
        </h2>
        <p className="text-muted-foreground">{t("aiBody")}</p>
      </section>

      {/* What makes us different */}
      <section
        aria-labelledby="about-different-heading"
        className="mx-auto w-full max-w-3xl px-6 pb-16 text-start"
      >
        <h2
          id="about-different-heading"
          className="mb-6 font-display text-3xl uppercase tracking-tight"
        >
          {t("differentTitle")}
        </h2>
        <p className="text-muted-foreground">{t("differentBody")}</p>
      </section>

      {/* For clients / for the trainer */}
      <section
        aria-labelledby="about-audiences-heading"
        className="mx-auto w-full max-w-6xl px-6 pb-16 text-start"
      >
        <h2 id="about-audiences-heading" className="sr-only">
          {t("forClientsTitle")} / {t("forTrainerTitle")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-cards border bg-card p-6">
            <h3 className="mb-2 font-display text-xl uppercase tracking-tight">
              {t("forClientsTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("forClientsBody")}
            </p>
          </div>
          <div className="rounded-cards border bg-card p-6">
            <h3 className="mb-2 font-display text-xl uppercase tracking-tight">
              {t("forTrainerTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("forTrainerBody")}
            </p>
          </div>
        </div>
      </section>

      {/* The mission */}
      <section
        aria-labelledby="about-mission-heading"
        className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pb-24 text-start lg:grid-cols-2"
      >
        <Image
          src="/images/about-mission.jpg"
          alt={t("missionImageAlt")}
          width={1600}
          height={1066}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="order-last w-full rounded-special border object-cover shadow-sm lg:order-first"
        />
        <div className="flex flex-col gap-4">
          <h2
            id="about-mission-heading"
            className="font-display text-3xl uppercase tracking-tight"
          >
            {t("missionTitle")}
          </h2>
          <p className="text-muted-foreground">{t("missionBody")}</p>
          <p className="font-display text-lg uppercase tracking-wide text-foreground">
            {t("missionPillars")}
          </p>
        </div>
      </section>
    </main>
  )
}
