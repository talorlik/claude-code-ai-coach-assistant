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
import { listOnboardingSnapshots } from "@/lib/db/onboarding-snapshots"
import { clientToDefaults } from "@/components/onboarding/onboarding-details-form"
import { OnboardingHistory } from "@/components/onboarding/onboarding-history"
import { ClientOnboardingEditor } from "./client-onboarding-editor"
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
  type PlanDetailWorkout,
  type ProfileField,
} from "./client-dashboard"
import type { PlanEditorData } from "./plan-editor"

/** Recognised weekday keys under the `MyPlan.weekday` message namespace. */
const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

/** A lowercase weekday key known to the `MyPlan.weekday` catalog. */
type WeekdayKey = (typeof WEEKDAY_KEYS)[number]

/** Type guard narrowing a raw day-of-week string to a catalog weekday key. */
function isWeekdayKey(value: string): value is WeekdayKey {
  return (WEEKDAY_KEYS as readonly string[]).includes(value)
}

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
  const weekdayT = await getTranslations("MyPlan.weekday")
  const format = await getFormatter()

  let detail
  try {
    detail = await getTrainerClientDetail(clientId)
  } catch {
    return (
      <ErrorState
        title={t("error.title")}
        description={t("error.description")}
      />
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

  const { client, activePlan, recentLogs, chatMessages, notes, pushStatus } =
    detail
  const reference = new Date()

  // Onboarding edit defaults + history for this client. RLS scopes the snapshot
  // read to the trainer-admin policy (the page guard is the primary check).
  const onboardingDefaults = clientToDefaults(client)
  const snapshots = await listOnboardingSnapshots(clientId)
  const tAccount = await getTranslations("AccountOnboarding")

  // Profile fields, in display order; empty values fall back to "not provided".
  const profileFields: ProfileField[] = [
    {
      labelKey: "goal",
      value: client.goals.length ? client.goals.join(", ") : null,
    },
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
      value: format.dateTime(new Date(client.onboardedAt ?? client.createdAt), {
        dateStyle: "medium",
      }),
    },
  ]

  // Plan title + completion over the active plan's distinct workouts.
  const planTitle = activePlan?.plan.title ?? null
  const completionPercent = activePlan
    ? completionPercentage(activePlan.workouts.length, [
        ...completedWorkoutIds(activePlan.logs),
      ])
    : 0

  // Full plan detail, threaded from the data getActivePlanDetail already loaded
  // (no new query). Workouts and exercises arrive in stored `position` order; a
  // workout with no exercises is treated as a rest day. Day-of-week is localized
  // against the shared MyPlan.weekday catalog, falling back to the raw stored
  // value for any non-standard label.
  const planWorkouts: PlanDetailWorkout[] | null = activePlan
    ? activePlan.workouts.map((workout) => {
        const dayKey = workout.day_of_week?.toLowerCase() ?? null
        const dayLabel = dayKey
          ? isWeekdayKey(dayKey)
            ? weekdayT(dayKey)
            : workout.day_of_week
          : null
        return {
          id: workout.id,
          dayLabel,
          title: workout.title,
          focus: workout.focus,
          notes: workout.notes,
          isRestDay: workout.exercises.length === 0,
          exercises: workout.exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            duration: exercise.duration,
            rest: exercise.rest,
            instructions: exercise.instructions,
            safetyNotes: exercise.safety_notes,
          })),
        }
      })
    : null

  // PDF export is a pure link to the existing admin-authorized route, gated on an
  // active plan (the route 404s without one). The locale is passed as a query
  // param; the route itself is not locale-prefixed.
  const pdfHref = activePlan
    ? `/api/pdf/workout-plan?clientId=${encodeURIComponent(
        clientId
      )}&locale=${locale}`
    : null

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
    workoutTitle:
      titleByWorkout.get(log.workout_id) ?? t("log.untitledWorkout"),
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

  // Live-plan editor bundle (batch 25). Built from the already-loaded active plan
  // detail: no extra query. `hasLogs` is derived from the workout ids that appear
  // in the loaded completion logs, so the editor can disable delete on a workout
  // whose removal would cascade-destroy history. `hasLimitations` drives the
  // per-client safety-note rule the editor and its actions enforce. The editor is
  // null when there is no active plan (nothing to edit yet).
  const editor: PlanEditorData | null = activePlan
    ? {
        clientId,
        planId: activePlan.plan.id,
        hasLimitations: Boolean(
          client.limitations && client.limitations.trim() !== ""
        ),
        workouts: activePlan.workouts.map((workout) => {
          const hasLogs = activePlan.logs.some(
            (log) => log.workout_id === workout.id
          )
          return {
            id: workout.id,
            title: workout.title,
            focus: workout.focus,
            dayOfWeek: workout.day_of_week,
            notes: workout.notes,
            hasLogs,
            exercises: workout.exercises.map((exercise) => ({
              id: exercise.id,
              name: exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              duration: exercise.duration,
              rest: exercise.rest,
              instructions: exercise.instructions,
              safetyNotes: exercise.safety_notes,
            })),
          }
        }),
      }
    : null

  const data: ClientDashboardData = {
    clientId,
    displayName,
    profileFields,
    planTitle,
    completionPercent,
    planWorkouts,
    pdfHref,
    pushStatus,
    weekly,
    monthly,
    logs,
    chat,
    whatsAppHref,
    notes: noteItems,
    editor,
  }

  return (
    <div className="flex flex-col gap-10">
      <ClientDashboard data={data} />

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-medium">
            {tAccount("onboardingTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tAccount("onboardingDescription")}
          </p>
        </header>
        <ClientOnboardingEditor
          clientId={clientId}
          defaults={onboardingDefaults}
        />
      </section>

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-medium">{tAccount("historyTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {tAccount("historyDescription")}
          </p>
        </header>
        <OnboardingHistory snapshots={snapshots} />
      </section>
    </div>
  )
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
