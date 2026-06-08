import type { Metadata } from "next"
import Image from "next/image"
import { MapPin } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { buildLocaleMetadata } from "@/lib/seo/metadata"
import {
  isContactSuccess,
  resolveContactMessage,
} from "@/lib/contact/resolve-contact-message"
import { ContactForm } from "@/components/contact-form"
import { cn } from "@/lib/utils"
import type { Locale } from "@/i18n/routing"

/**
 * Localized SEO metadata for the Contact page. Delegates to
 * {@link buildLocaleMetadata} (`Metadata.contact` namespace) and passes the
 * `"contact"` path suffix so the hreflang alternates point at `/en/contact` and
 * `/he/contact`. Server-only.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildLocaleMetadata(locale, "contact", "contact")
}

/**
 * Public, localized, theme-aware Contact page. Server-rendered: it opts into
 * static rendering with {@link setRequestLocale}, renders the made-up Tel Aviv
 * studio details (address, phone, email, hours - all from the `Contact`
 * namespace), a curated side image via `next/image`, and the
 * progressive-enhancement {@link ContactForm}.
 *
 * The form's outcome arrives as a stable `?notice=`/`?error=` code that the
 * server action set; it is resolved to localized text through
 * {@link resolveContactMessage} (allowlist-guarded, so a forged param renders
 * nothing) and shown in a `role="alert"` status line. The map is a plain link to
 * Google Maps rather than an embedded iframe, which keeps the page PWA- and
 * CSP-friendly. RTL is handled by logical alignment (`text-start`); the address
 * query is URL-encoded.
 *
 * @param params - The `[locale]` route segment.
 * @param searchParams - Carries the post-submit `notice`/`error` code.
 */
export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const sp = await searchParams
  const t = await getTranslations("Contact")
  const messages = await getTranslations("Contact.messages")

  const noticeMessage = resolveContactMessage(messages, sp.notice)
  const errorMessage = resolveContactMessage(messages, sp.error)
  const status = noticeMessage ?? errorMessage
  const statusIsSuccess = isContactSuccess(sp.notice)
  const hasError = errorMessage !== null

  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    t("addressValue")
  )}`

  return (
    <main className="flex flex-1 flex-col">
      <section
        aria-labelledby="contact-heading"
        className="mx-auto grid w-full max-w-6xl items-start gap-10 px-6 py-16 text-start sm:py-20 lg:grid-cols-2"
      >
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1
              id="contact-heading"
              className="font-display text-4xl uppercase leading-[0.95] tracking-tight sm:text-5xl"
            >
              {t("heading")}
            </h1>
            <p className="max-w-xl text-muted-foreground">{t("intro")}</p>
          </div>

          {/* Studio details */}
          <div className="rounded-cards border bg-card p-6">
            <h2 className="mb-4 font-display text-xl uppercase tracking-tight">
              {t("detailsHeading")}
            </h2>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="font-medium">{t("addressLabel")}</dt>
                <dd className="text-muted-foreground">{t("addressValue")}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="font-medium">{t("phoneLabel")}</dt>
                <dd className="text-muted-foreground">
                  <a
                    href={`tel:${t("phoneValue").replace(/\s|-/g, "")}`}
                    className="hover:text-foreground hover:underline"
                  >
                    {t("phoneValue")}
                  </a>
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="font-medium">{t("emailLabel")}</dt>
                <dd className="text-muted-foreground">
                  <a
                    href={`mailto:${t("emailValue")}`}
                    className="hover:text-foreground hover:underline"
                  >
                    {t("emailValue")}
                  </a>
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="font-medium">{t("hoursLabel")}</dt>
                <dd className="text-muted-foreground">{t("hoursValue")}</dd>
              </div>
            </dl>
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {t("mapLabel")}
            </a>
          </div>
        </div>

        {/* Form + side image */}
        <div className="flex flex-col gap-8">
          <Image
            src="/images/contact-side.jpg"
            alt={t("sideImageAlt")}
            width={1200}
            height={800}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="w-full rounded-special border object-cover shadow-sm"
          />

          <div className="rounded-cards border bg-card p-6">
            <h2 className="mb-4 font-display text-xl uppercase tracking-tight">
              {t("formHeading")}
            </h2>

            {status ? (
              <p
                role="alert"
                className={cn(
                  "mb-4 rounded-lg border p-3 text-sm",
                  statusIsSuccess
                    ? "border-primary/30 bg-primary/5 text-foreground"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
                )}
              >
                {status}
              </p>
            ) : null}

            <ContactForm hasError={hasError} />
          </div>
        </div>
      </section>
    </main>
  )
}
