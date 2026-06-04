import type { Metadata } from "next"
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { requireTrainerAdmin } from "@/lib/auth/require-user"
import { listClientsWithActivity } from "@/lib/db/trainer-clients"
import { activityIndicator } from "@/lib/trainer/activity"
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
 * Trainer-admin landing page at `/[locale]/trainer`: a localized overview of all
 * clients with active-plan status, current-month completion, and a traffic-light
 * activity indicator. `requireTrainerAdmin()` is the authoritative guard, run
 * before any data loads: signed-out visitors are sent to the localized login
 * page and authenticated non-admins to home, so reaching the render proves the
 * caller is the trainer admin (RLS independently scopes the queries).
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
  const format = await getFormatter()

  let rows: TrainerClientRow[]
  try {
    const clients = await listClientsWithActivity()
    rows = clients.map(({ client, hasActivePlan, monthCompletionPercent }) => {
      const { level, color } = activityIndicator(monthCompletionPercent)
      return {
        userId: client.userId,
        fullName: client.fullName,
        goal: client.goal,
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
        <Header title={t("title")} subtitle={t("subtitle")} />
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("error.title")}</EmptyTitle>
            <EmptyDescription>{t("error.description")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
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
    </main>
  )
}

/** Localized page header shared by the data, empty, and error renders. */
function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{subtitle}</p>
    </header>
  )
}
