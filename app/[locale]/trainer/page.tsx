import type { Metadata } from "next"
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server"
import { ArrowLeft, ClipboardList, Users } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { requireTrainerAdmin } from "@/lib/auth/require-user"
import { listClientsWithActivity } from "@/lib/db/trainer-clients"
import { activityIndicator } from "@/lib/trainer/activity"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { TrainerClients, type TrainerClientRow } from "./trainer-clients"

/**
 * The trainer console is a private admin surface; keep it out of search
 * indexes. The visible title is localized via the `TrainerClients` namespace;
 * this metadata title is a stable, non-indexed fallback.
 */
export const metadata: Metadata = {
  title: "Trainer",
  robots: { index: false, follow: false },
}

/**
 * Trainer-specific dashboard at `/[locale]/trainer`, reached from the top-level
 * admin dashboard (`/[locale]/admin`). This is the hub for managing every client
 * and their workout plans: it leads with a localized dashboard header and a
 * navigation region (cards) into the client list overview (this page) and the
 * plan-template manager at `/trainer/plans`, plus a back-link to `/admin` so the
 * two-level admin/trainer hub is navigable both ways. The page's primary content
 * remains the client list - a localized overview of all clients with active-plan
 * status, current-month completion, and a traffic-light activity indicator.
 *
 * `requireTrainerAdmin()` is the authoritative guard, run before any data loads:
 * signed-out visitors are sent to the localized login page and authenticated
 * non-admins to home, so reaching the render proves the caller is the trainer
 * admin (RLS independently scopes the queries). This per-page guard is the single
 * authorization point; no `/trainer/layout.tsx` guard is added. All navigation
 * uses the locale-aware {@link Link} so the active locale is preserved.
 *
 * The client rows are shaped into a plain, serializable structure here and
 * handed to the interactive {@link TrainerClients} component, which renders the
 * responsive table/card layout and links each client to their dashboard. An
 * empty client list renders a localized empty state; a data-load failure renders
 * a localized error state rather than throwing an unstyled page.
 *
 * @param params - The dynamic route params carrying the active locale.
 */
export default async function TrainerPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  // Opt into static rendering for this locale before any next-intl hook runs.
  setRequestLocale(locale)

  // Authoritative auth + role guard; redirects (locale-preserving) otherwise.
  await requireTrainerAdmin()

  const t = await getTranslations("TrainerClients")
  const hub = await getTranslations("TrainerHub")
  const format = await getFormatter()

  let rows: TrainerClientRow[]
  try {
    const clients = await listClientsWithActivity()
    rows = clients.map(({ client, hasActivePlan, monthCompletionPercent }) => {
      const { level, color } = activityIndicator(monthCompletionPercent)
      return {
        userId: client.userId,
        fullName: client.fullName,
        goals: client.goals,
        joinDate: client.onboardedAt ?? client.createdAt,
        joinDateLabel: format.dateTime(
          new Date(client.onboardedAt ?? client.createdAt),
          { dateStyle: "medium" }
        ),
        hasActivePlan,
        completionPercent: monthCompletionPercent,
        activityLevel: level,
        activityColor: color,
      }
    })
  } catch {
    // Fail visibly with a localized error rather than a blank crash; the
    // underlying cause is logged by the data layer's thrown Error.
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
        <DashboardHeader
          title={hub("title")}
          subtitle={hub("subtitle")}
          backToAdmin={hub("backToAdmin")}
        />
        <DashboardNav
          clientsTitle={hub("clientsTitle")}
          clientsDescription={hub("clientsDescription")}
          plansTitle={hub("plansTitle")}
          plansDescription={hub("plansDescription")}
        />
        <section id="trainer-clients" className="flex flex-col gap-8">
          <Header title={t("title")} subtitle={t("subtitle")} />
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("error.title")}</EmptyTitle>
              <EmptyDescription>{t("error.description")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <DashboardHeader
        title={hub("title")}
        subtitle={hub("subtitle")}
        backToAdmin={hub("backToAdmin")}
      />
      <DashboardNav
        clientsTitle={hub("clientsTitle")}
        clientsDescription={hub("clientsDescription")}
        plansTitle={hub("plansTitle")}
        plansDescription={hub("plansDescription")}
      />
      <section id="trainer-clients" className="flex flex-col gap-8">
        <Header title={t("title")} subtitle={t("subtitle")} />
        {rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("empty.title")}</EmptyTitle>
              <EmptyDescription>{t("empty.description")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <TrainerClients rows={rows} />
        )}
      </section>
    </main>
  )
}

/**
 * Localized dashboard header for the trainer hub: the dashboard title and a short
 * subtitle, plus a locale-aware back-link to the top-level admin dashboard at
 * `/admin` (the path is locale-agnostic; {@link Link} prefixes the active locale).
 */
function DashboardHeader({
  title,
  subtitle,
  backToAdmin,
}: {
  title: string
  subtitle: string
  backToAdmin: string
}) {
  return (
    <header className="flex flex-col gap-3">
      <Link
        href="/admin"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {backToAdmin}
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{subtitle}</p>
    </header>
  )
}

/**
 * Localized navigation region for the trainer hub: cards linking to the client
 * list overview (this page's list section) and the plan-template manager at
 * `/trainer/plans`, the latter closing the gap where `/trainer/plans` was only
 * reachable by typing the URL. Both links use the locale-aware {@link Link}.
 */
function DashboardNav({
  clientsTitle,
  clientsDescription,
  plansTitle,
  plansDescription,
}: {
  clientsTitle: string
  clientsDescription: string
  plansTitle: string
  plansDescription: string
}) {
  const items = [
    {
      href: "/trainer#trainer-clients",
      icon: Users,
      title: clientsTitle,
      description: clientsDescription,
    },
    {
      href: "/trainer/plans",
      icon: ClipboardList,
      title: plansTitle,
      description: plansDescription,
    },
  ] as const

  return (
    <nav aria-label={clientsTitle} className="grid gap-4 sm:grid-cols-2">
      {items.map(({ href, icon: Icon, title, description }) => (
        <Link
          key={href}
          href={href}
          className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="h-full transition-shadow group-hover:ring-foreground/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <CardTitle>{title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{description}</CardDescription>
            </CardContent>
          </Card>
        </Link>
      ))}
    </nav>
  )
}

/** Localized client-list section header shared by the data, empty, and error renders. */
function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground">{subtitle}</p>
    </header>
  )
}
