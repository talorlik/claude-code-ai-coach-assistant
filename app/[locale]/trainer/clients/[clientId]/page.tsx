import type { Metadata } from "next"
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { requireTrainerAdmin } from "@/lib/auth/require-user"
import { getTrainerClientDetail } from "@/lib/db/trainer-client-detail"
import {
  completedWorkoutIds,
  completionPercentage,
} from "@/lib/progress/progress"
import {
  weeklyCompletions,
  monthlyCompletions,
} from "@/lib/trainer/aggregation"
import { whatsAppLink } from "@/lib/trainer/phone"
import type { Locale } from "@/i18n/routing"
import {
  ClientDashboard,
  type ClientDashboardData,
  type LogEntry,
  type ProfileField,
} from "./client-dashboard"

/** Number of weekly buckets the dashboard's weekly chart shows. */
const WEEKLY_WINDOW = 12
/** Number of monthly buckets the dashboard's monthly chart shows. */
const MONTHLY_WINDOW = 6

/**
 * The trainer dashboard is a private admin surface; keep it out of search
 * indexes. The visible content is localized via the `TrainerDashboard`
 * namespace; this metadata title is a stable, non-indexed fallback.
 */
export const metadata: Metadata = {
  title: "Client dashboard",
  robots: { index: false, follow: false },
}

/**
 * Trainer-admin client dashboard at `/[locale]/trainer/clients/[clientId]`.
 * `requireTrainerAdmin()` is the authoritative guard, run before any data loads:
 * signed-out visitors go to the localized login page and authenticated
 * non-admins to home, so reaching the render proves the caller is the trainer
 * admin (RLS independently scopes every query).
 *
 * The full dashboard bundle (profile, active plan, recent logs, chat, notes) is
 * loaded server-side via {@link getTrainerClientDetail}, then shaped into a
 * plain, fully-localized structure and handed to the interactive
 * {@link ClientDashboard}. Completion percentage and the weekly/monthly chart
 * series are computed here with the tested pure helpers. A missing client
 * renders a localized "not found" state; a data-load failure renders a localized
 * error state rather than throwing an unstyled page.
 *
 * @param params - The dynamic route params: the active locale and the client id.
 */
export default async function TrainerClientDashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale; clientId: string }>
}) {
  const { locale, clientId } = await params
  setRequestLocale(locale)

  await requireTrainerAdmin()

  const t = await getTranslations("TrainerDashboard")
  const format = await getFormatter()

  let detail
  try {
    detail = await getTrainerClientDetail(clientId)
  } catch {
    return (
      <ErrorState title={t("error.title")} description={t("error.description")} />
    )
  }

  if (!detail) {
    return (
      <ErrorState
        title={t("notFound.title")}
        description={t("notFound.description")}
      />
    )
  }

  const { client, activePlan, recentLogs, chatMessages, notes } = detail
  const reference = new Date()

  // Profile fields, in display order; empty values fall back to "not provided".
  const profileFields: ProfileField[] = [
    { labelKey: "goal", value: client.goal },
    { labelKey: "fitnessLevel", value: client.fitnessLevel },
    { labelKey: "age", value: client.age != null ? String(client.age) : null },
    {
      labelKey: "availableDays",
      value: client.availableDays.length
        ? client.availableDays.join(", ")
        : null,
    },
    { labelKey: "location", value: client.preferredLocation },
    {
      labelKey: "equipment",
      value: client.equipment.length ? client.equipment.join(", ") : null,
    },
    { labelKey: "limitations", value: client.limitations },
    { labelKey: "phone", value: client.phone },
    {
      labelKey: "joined",
      value: format.dateTime(
        new Date(client.onboardedAt ?? client.createdAt),
        { dateStyle: "medium" }
      ),
    },
  ]

  // Plan title + completion over the active plan's distinct workouts.
  const planTitle = activePlan?.plan.title ?? null
  const completionPercent = activePlan
    ? completionPercentage(
        activePlan.workouts.length,
        [...completedWorkoutIds(activePlan.logs)]
      )
    : 0

  // Chart series from the recent (cross-plan) logs, with localized short labels.
  const weeklyBuckets = weeklyCompletions(recentLogs, reference, WEEKLY_WINDOW)
  const monthlyBuckets = monthlyCompletions(
    recentLogs,
    reference,
    MONTHLY_WINDOW
  )
  const weekly = weeklyBuckets.map((b) => ({
    label: format.dateTime(new Date(`${b.end}T00:00:00.000Z`), {
      day: "2-digit",
      month: "short",
    }),
    count: b.count,
  }))
  const monthly = monthlyBuckets.map((b) => ({
    label: format.dateTime(new Date(`${b.start}T00:00:00.000Z`), {
      month: "short",
    }),
    count: b.count,
  }))

  // Workout titles for the log: resolved from the active plan's workouts when
  // available, otherwise a generic localized fallback (logs may reference an
  // archived plan's workout that is not loaded here).
  const titleByWorkout = new Map(
    (activePlan?.workouts ?? []).map((w) => [
      w.id,
      w.title ?? t("log.untitledWorkout"),
    ])
  )
  const logs: LogEntry[] = recentLogs.map((log) => ({
    id: log.id,
    workoutTitle: titleByWorkout.get(log.workout_id) ?? t("log.untitledWorkout"),
    dateLabel: format.dateTime(new Date(log.completed_at), {
      dateStyle: "medium",
    }),
    difficulty: log.difficulty,
    energy: log.energy_level,
    notes: log.notes,
  }))

  const chat = chatMessages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
  }))

  const displayName = client.fullName ?? t("unnamed")

  // WhatsApp link only when the stored phone yields a valid number; otherwise the
  // button is hidden (the component renders nothing for a null href).
  const whatsAppHref = whatsAppLink(
    client.phone,
    t("whatsapp.prefill", { name: displayName })
  )

  const noteItems = notes.map((note) => ({
    id: note.id,
    body: note.body,
    updatedAtLabel: format.dateTime(new Date(note.updated_at), {
      dateStyle: "medium",
    }),
  }))

  const data: ClientDashboardData = {
    clientId,
    displayName,
    profileFields,
    planTitle,
    completionPercent,
    weekly,
    monthly,
    logs,
    chat,
    whatsAppHref,
    notes: noteItems,
  }

  return <ClientDashboard data={data} />
}

/** Localized full-page empty/error state shared by the not-found and error paths. */
function ErrorState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  )
}
