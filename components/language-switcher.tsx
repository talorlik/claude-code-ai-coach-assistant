"use client"

import { useLocale, useTranslations } from "next-intl"
import { Check, Languages } from "lucide-react"

import { Link, usePathname } from "@/i18n/navigation"
import { routing, type Locale } from "@/i18n/routing"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Icon-triggered locale switcher. It links to the current pathname under each
 * supported locale, so switching language keeps the visitor on the equivalent
 * route (`/en/login` <-> `/he/login`). `usePathname` from the locale-aware
 * navigation returns the path without its locale prefix, and {@link Link}
 * re-applies the target locale, so no manual prefix manipulation is needed.
 */
export function LanguageSwitcher() {
  const pathname = usePathname()
  const active = useLocale() as Locale
  const t = useTranslations("LanguageSwitcher")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon">
            <Languages aria-hidden />
            <span className="sr-only">{t("label")}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {routing.locales.map((locale) => (
            <DropdownMenuItem
              key={locale}
              render={
                <Link
                  href={pathname}
                  locale={locale}
                  aria-current={locale === active ? "true" : undefined}
                />
              }
              className={cn(
                "justify-between",
                locale === active && "font-semibold"
              )}
            >
              {t(locale)}
              {locale === active ? <Check aria-hidden /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
