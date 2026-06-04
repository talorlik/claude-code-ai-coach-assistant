import { use } from "react"
import { ArrowRight, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Locale } from "@/i18n/routing"

/**
 * Localized landing page. Copy comes from the `Home` message namespace and the
 * call-to-action links use the locale-aware {@link Link}, so they preserve the
 * active language (`/en/login`, `/he/login`).
 */
export default function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = use(params)
  // Enable static rendering before invoking the translation hook.
  setRequestLocale(locale)

  const t = useTranslations("Home")

  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex max-w-2xl flex-col items-center gap-6">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            {t("badge")}
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {t("title")}
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground">
            {t("description")}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              {t("getStarted")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              {t("signIn")}
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        {t("footer")}
      </footer>
    </div>
  )
}
