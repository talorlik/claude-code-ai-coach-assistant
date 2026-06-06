import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { ArrowRight, MessageCircle, UserCog, Users } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"

/**
 * The admin dashboard is a private surface; keep it out of search indexes. The
 * visible title is localized via the `AdminDashboard` namespace; this metadata
 * title is a stable, non-indexed fallback.
 */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
}

/** One navigation card on the admin dashboard. */
interface AdminCard {
  /** Locale-agnostic in-app path; the locale-aware {@link Link} prefixes it. */
  href: string
  /** Lucide icon rendered in the card header. */
  icon: typeof Users
  /** `AdminDashboard` message key prefix (e.g. `trainer` -> `trainerTitle`). */
  key: "trainer" | "chat" | "account"
}

/**
 * Top-level admin landing dashboard at `/[locale]/admin`. This is the admin's
 * post-login home (`resolvePostAuthDestination` returns `/admin` for admins) and
 * the hub linking to every admin capability. Access is already enforced by the
 * `/admin` layout's `requireAdmin()` guard, so reaching this render proves the
 * visitor is an admin; the page itself adds no further authorization.
 *
 * The dashboard is a two-level model: `/admin` is the hub, and the primary card
 * links to the trainer area at `/trainer` for client and plan management. The
 * admin and trainer surfaces are authorization-identical (the single `admin`
 * role) and differ only in purpose. Settings is deliberately omitted (no
 * admin-settings model exists yet). All copy comes from the `AdminDashboard`
 * namespace and all links use the locale-aware {@link Link} so the active
 * locale is preserved; the layout's container handles RTL under `/he`.
 *
 * @param params - The dynamic route params carrying the active locale.
 */
export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  // Opt into static rendering for this locale before any next-intl hook runs.
  setRequestLocale(locale)

  const t = await getTranslations("AdminDashboard")

  const cards: AdminCard[] = [
    { href: "/trainer", icon: Users, key: "trainer" },
    { href: "/chat", icon: MessageCircle, key: "chat" },
    { href: "/profile", icon: UserCog, key: "account" },
  ]

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ href, icon: Icon, key }) => (
          <Link
            key={key}
            href={href}
            className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full transition-shadow group-hover:ring-foreground/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <CardTitle>{t(`${key}Title`)}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <CardDescription>{t(`${key}Description`)}</CardDescription>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {t(`${key}Cta`)}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
