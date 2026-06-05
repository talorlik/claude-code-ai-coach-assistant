import type { Metadata } from "next"
import { WifiOff } from "lucide-react"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { buttonVariants } from "@/components/ui/button"
import type { Locale } from "@/i18n/routing"

export const metadata: Metadata = {
  title: "Offline",
  // The offline fallback is an app-shell document, not indexable content.
  robots: { index: false, follow: false },
}

/**
 * Localized offline fallback. The service worker precaches this document and
 * serves it for navigations that fail while the device is offline, so the
 * installed PWA shows a branded, translatable screen instead of the browser's
 * default error page. All copy lives in the `Pwa.offline` namespace and the
 * layout inherits the document `dir`, so it works in both locales and RTL.
 *
 * It opts into static rendering via {@link setRequestLocale} so it is a pure
 * static asset the worker can cache at install time.
 */
export default async function OfflinePage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("Pwa.offline")

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <WifiOff aria-hidden className="size-12 text-muted-foreground" />
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {t("retry")}
      </Link>
    </main>
  )
}
