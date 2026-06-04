import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { requireTrainerAdmin } from "@/lib/auth/require-user"
import { listTemplates } from "@/lib/db/plan-templates"
import { listClients } from "@/lib/db/clients"
import type { Locale } from "@/i18n/routing"
import {
  PlansManager,
  type TemplateItem,
  type ClientOption,
} from "./plans-manager"

/**
 * The trainer plans console is a private admin surface; keep it out of search
 * indexes. The visible title is localized via the `TrainerPlans` namespace;
 * this metadata title is a stable, non-indexed fallback.
 */
export const metadata: Metadata = {
  title: "Plan templates",
  robots: { index: false, follow: false },
}

/**
 * Maps a stored template row to the plain, serializable shape the manager
 * renders. The structured payload is JSON-stringified here so the client form
 * can edit it as text without the server component shipping a non-serializable
 * value or the client re-deriving it.
 */
function toTemplateItem(row: {
  id: string
  title: string
  description: string | null
  locale: string | null
  payload: unknown
}): TemplateItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    locale: row.locale,
    payloadJson: JSON.stringify(row.payload, null, 2),
  }
}

/**
 * Trainer-admin plan templates page at `/[locale]/trainer/plans`: a localized
 * template library with create, edit, duplicate, and assign-to-client actions.
 * `requireTrainerAdmin()` is the authoritative guard, run before any data
 * loads, so reaching the render proves the caller is the trainer admin (RLS
 * independently scopes the queries).
 *
 * Templates and the client list (for the assign picker) are loaded server-side
 * and handed as plain, serializable props to the interactive
 * {@link PlansManager}. A data-load failure renders a localized error state
 * rather than throwing.
 *
 * @param params - Route params carrying the active locale.
 */
export default async function TrainerPlansPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  // Opt into static rendering for this locale before any next-intl hook runs.
  setRequestLocale(locale)

  // Authoritative auth + role guard; redirects (locale-preserving) otherwise.
  await requireTrainerAdmin()

  const t = await getTranslations("TrainerPlans")

  let templates: TemplateItem[]
  let clients: ClientOption[]
  try {
    const [templateRows, clientRows] = await Promise.all([
      listTemplates(),
      listClients(),
    ])
    templates = templateRows.map(toTemplateItem)
    clients = clientRows.map((c) => ({
      userId: c.userId,
      label: c.fullName ?? t("unnamedClient"),
    }))
  } catch {
    return (
      <main className="container mx-auto flex flex-col gap-6 px-4 py-8">
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
    <main className="container mx-auto flex flex-col gap-6 px-4 py-8">
      <Header title={t("title")} subtitle={t("subtitle")} />
      <PlansManager
        locale={locale}
        initialTemplates={templates}
        clients={clients}
      />
    </main>
  )
}

/** Localized page header shared by the data and error renders. */
function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{subtitle}</p>
    </header>
  )
}
