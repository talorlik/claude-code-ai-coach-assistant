"use client"

import { useLocale, useTranslations } from "next-intl"
import { Languages } from "lucide-react"

import { Link, usePathname } from "@/i18n/navigation"
import { routing, type Locale } from "@/i18n/routing"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

/**
 * Inline locale switcher. It links to the current pathname under each supported
 * locale, so switching language keeps the visitor on the equivalent route
 * (`/en/login` <-> `/he/login`). `usePathname` from the locale-aware navigation
 * returns the path without its locale prefix, and {@link Link} re-applies the
 * target locale, so no manual prefix manipulation is needed.
 */
export function LanguageSwitcher() {
  const pathname = usePathname()
  const active = useLocale() as Locale
  const t = useTranslations("LanguageSwitcher")

  return (
    <nav aria-label={t("label")} className="flex items-center gap-1">
      <Languages className="h-4 w-4 text-muted-foreground" aria-hidden />
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          aria-current={locale === active ? "true" : undefined}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "px-2",
            locale === active && "font-semibold text-foreground"
          )}
        >
          {t(locale)}
        </Link>
      ))}
    </nav>
  )
}
