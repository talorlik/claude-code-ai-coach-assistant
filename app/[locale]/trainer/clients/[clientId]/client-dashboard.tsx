"use client"

import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  Bell,
  BellOff,
  BellRing,
  Download,
  Dumbbell,
  MessageCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Link } from "@/i18n/navigation"
import { ProgressCharts, type ProgressDatum } from "./progress-charts"
import { TrainerNotesPanel, type TrainerNoteItem } from "./trainer-notes-panel"
import { RegenerateClientPlan } from "./regenerate-client-plan"
import { PlanEditor, type PlanEditorData } from "./plan-editor"
import { CollapsibleSection } from "./collapsible-section"

/** The label keys available under the `TrainerDashboard.profile` namespace. */
export type ProfileFieldKey =
  | "goal"
  | "fitnessLevel"
  | "age"
  | "availableDays"
  | "location"
  | "equipment"
  | "limitations"
  | "phone"
  | "joined"

/** One labelled profile field; omitted when its value is empty. */
export interface ProfileField {
  /** Message key under `TrainerDashboard.profile` for the label. */
  labelKey: ProfileFieldKey
  /** Resolved display value, or `null` to render the "not provided" fallback. */
  value: string | null
}

/** A single workout-log row, pre-shaped and localized by the page. */
export interface LogEntry {
  id: string
  workoutTitle: string
  dateLabel: string
  difficulty: string | null
  energy: string | null
  notes: string | null
}

/** A single chat message, pre-shaped by the page. */
export interface ChatEntry {
  id: string
  role: "user" | "assistant"
  content: string
}

/** A single exercise within a plan workout, serializable for the client boundary. */
export interface PlanDetailExercise {
  id: string
  name: string
  sets: number | null
  reps: string | null
  duration: string | null
  rest: string | null
  instructions: string | null
  safetyNotes: string | null
}

/** A single workout within the active plan, with its ordered exercises. */
export interface PlanDetailWorkout {
  id: string
  /** Localized day-of-week / scheduling label, or `null` when unscheduled. */
  dayLabel: string | null
  title: string | null
  focus: string | null
  notes: string | null
  /** `true` for an intentional rest day (no exercises). */
  isRestDay: boolean
  exercises: PlanDetailExercise[]
}

/** The client's reminder readiness, mirrored from `ClientPushStatus`. */
export type PushStatus = "enabled" | "disabled" | "unavailable"

/** Everything the dashboard renders, fully serializable for the client boundary. */
export interface ClientDashboardData {
  clientId: string
  displayName: string
  profileFields: ProfileField[]
  planTitle: string | null
  completionPercent: number
  /** The active plan's workouts and exercises, or `null` when there is no plan. */
  planWorkouts: PlanDetailWorkout[] | null
  /**
   * Locale-aware download URL for the client's plan PDF, or `null` when there is
   * no active plan (the export route 404s without one, so the button is hidden).
   */
  pdfHref: string | null
  pushStatus: PushStatus
  weekly: ProgressDatum[]
  monthly: ProgressDatum[]
  logs: LogEntry[]
  chat: ChatEntry[]
  whatsAppHref: string | null
  notes: TrainerNoteItem[]
  /**
   * The live-plan editor bundle, or `null` when the client has no active plan
   * (there is nothing to edit; regeneration creates the first plan).
   */
  editor: PlanEditorData | null
}

/**
 * The trainer's detailed dashboard for one client: profile summary, current plan
 * with completion, the full plan detail (each workout and exercise with sets,
 * reps, duration, rest, instructions, and safety notes) plus a PDF export link,
 * the client's push-reminder readiness, weekly/monthly progress charts, the
 * workout log, the AI chat transcript, a WhatsApp contact button (only when a
 * valid phone exists), and the private notes panel. Every value is resolved and
 * localized server-side and passed in as plain data, so this component is a pure
 * presentation layer. Copy comes from the `TrainerDashboard` namespace; the
 * layout inherits the page direction, so it reads right-to-left under Hebrew.
 *
 * @param data - The fully-shaped, serializable dashboard data.
 */
export function ClientDashboard({ data }: { data: ClientDashboardData }) {
  const t = useTranslations("TrainerDashboard")

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-12">
      <div className="flex flex-col gap-4">
        <Link
          href="/trainer"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {data.displayName}
          </h1>
          {data.whatsAppHref ? (
            <a
              href={data.whatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <MessageCircle className="size-4" />
              {t("whatsapp.contact")}
            </a>
          ) : null}
        </div>
      </div>

      <ProfileSummary fields={data.profileFields} />

      <PlanSummary
        clientId={data.clientId}
        title={data.planTitle}
        completionPercent={data.completionPercent}
        pdfHref={data.pdfHref}
      />

      <PushStatus status={data.pushStatus} />

      <PlanDetail workouts={data.planWorkouts} />

      {data.editor ? <PlanEditor data={data.editor} /> : null}

      <CollapsibleSection
        title={t("charts.title")}
        storageKey="trainer-section:activity"
        data-testid="section-activity"
      >
        <ProgressCharts weekly={data.weekly} monthly={data.monthly} />
      </CollapsibleSection>

      <WorkoutLog logs={data.logs} />

      <ChatTranscript chat={data.chat} />

      <TrainerNotesPanel clientId={data.clientId} initialNotes={data.notes} />
    </main>
  )
}

/** Labelled grid of the client's profile fields. */
function ProfileSummary({ fields }: { fields: ProfileField[] }) {
  const t = useTranslations("TrainerDashboard.profile")
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="mb-3 text-lg font-medium">{t("title")}</h2>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div key={field.labelKey}>
            <dt className="text-sm text-muted-foreground">
              {t(field.labelKey)}
            </dt>
            <dd className="mt-0.5 break-words">{field.value ?? t("none")}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * Current-plan card with title, a completion progress bar, plan regeneration,
 * and (only when an active plan exists) a localized PDF export link. The PDF
 * link is gated on `pdfHref`: the page passes `null` when there is no active
 * plan, because the export route 404s without one, so the control never appears
 * in a dead state.
 */
function PlanSummary({
  clientId,
  title,
  completionPercent,
  pdfHref,
}: {
  clientId: string
  title: string | null
  completionPercent: number
  pdfHref: string | null
}) {
  const t = useTranslations("TrainerDashboard.plan")
  if (!title) {
    return (
      <section className="rounded-lg border bg-card p-4 text-card-foreground">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">{t("title")}</h2>
          {/* The client may not have a plan yet; regeneration generates one from
              their latest profile (it requires an onboarded client). */}
          <RegenerateClientPlan clientId={clientId} />
        </div>
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      </section>
    )
  }
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{title}</Badge>
          {pdfHref ? (
            <a
              href={pdfHref}
              download
              data-testid="trainer-export-plan-pdf"
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Download className="size-4" aria-hidden="true" />
              {t("exportPdf")}
            </a>
          ) : null}
          <RegenerateClientPlan clientId={clientId} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("completion")}</span>
          <span className="font-medium">
            {t("percent", { value: completionPercent })}
          </span>
        </div>
        <Progress value={completionPercent} />
      </div>
    </section>
  )
}

/**
 * Push-reminder readiness indicator. Renders one of three localized states with
 * a matching icon and tone: `enabled` (reminders fire), `disabled` (the client
 * has subscriptions but turned them off), `unavailable` (no subscription at all,
 * e.g. never opted in or unsupported browser). Copy comes from
 * `TrainerDashboard.push`.
 */
function PushStatus({ status }: { status: PushStatus }) {
  const t = useTranslations("TrainerDashboard.push")
  const presentation = {
    enabled: {
      Icon: BellRing,
      className: "text-emerald-700 dark:text-emerald-500",
    },
    disabled: {
      Icon: BellOff,
      className: "text-amber-700 dark:text-amber-500",
    },
    unavailable: {
      Icon: Bell,
      className: "text-muted-foreground",
    },
  }[status]
  const { Icon, className } = presentation
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="mb-2 text-lg font-medium">{t("title")}</h2>
      <p
        className={`inline-flex items-center gap-2 text-sm font-medium ${className}`}
        data-testid="push-status"
        data-status={status}
      >
        <Icon className="size-4" aria-hidden="true" />
        {t(status)}
      </p>
    </section>
  )
}

/**
 * Full active-plan detail: every workout (with its localized day label, focus,
 * and notes) and every exercise's sets, reps, duration, rest, instructions, and
 * safety notes, in stored order. Rest days render an explicit rest indicator
 * instead of an exercise list. Inherits the page direction, so it reads
 * right-to-left under Hebrew. When there is no active plan, renders the localized
 * empty state. Copy comes from `TrainerDashboard.planDetail`.
 */
function PlanDetail({ workouts }: { workouts: PlanDetailWorkout[] | null }) {
  const t = useTranslations("TrainerDashboard.planDetail")
  if (!workouts || workouts.length === 0) {
    return (
      <CollapsibleSection
        title={t("title")}
        storageKey="trainer-section:plan-detail"
        data-testid="section-plan-detail"
      >
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </CollapsibleSection>
    )
  }
  return (
    <CollapsibleSection
      title={t("title")}
      storageKey="trainer-section:plan-detail"
      data-testid="section-plan-detail"
    >
      <ol className="flex flex-col gap-4">
        {workouts.map((workout) => (
          <li
            key={workout.id}
            className="rounded-md border p-4"
            data-testid="plan-detail-workout"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">
                {workout.title ?? t("untitledWorkout")}
              </h3>
              {workout.dayLabel ? (
                <span className="text-sm text-muted-foreground">
                  {workout.dayLabel}
                </span>
              ) : null}
            </div>
            {workout.focus ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("focus")}: {workout.focus}
              </p>
            ) : null}
            {workout.notes ? (
              <p className="mt-2 text-sm">{workout.notes}</p>
            ) : null}

            {workout.isRestDay ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("restDay")}
              </p>
            ) : (
              <ol className="mt-3 flex flex-col gap-3">
                {workout.exercises.map((exercise) => (
                  <li
                    key={exercise.id}
                    className="flex flex-col gap-1 rounded-md border p-3"
                    data-testid="plan-detail-exercise"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <Dumbbell
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {exercise.name}
                    </div>
                    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {exercise.sets != null ? (
                        <Detail
                          label={t("sets")}
                          value={String(exercise.sets)}
                        />
                      ) : null}
                      {exercise.reps ? (
                        <Detail label={t("reps")} value={exercise.reps} />
                      ) : null}
                      {exercise.duration ? (
                        <Detail
                          label={t("duration")}
                          value={exercise.duration}
                        />
                      ) : null}
                      {exercise.rest ? (
                        <Detail label={t("rest")} value={exercise.rest} />
                      ) : null}
                    </dl>
                    {exercise.instructions ? (
                      <p className="text-sm">
                        <span className="text-muted-foreground">
                          {t("instructions")}:
                        </span>{" "}
                        {exercise.instructions}
                      </p>
                    ) : null}
                    {exercise.safetyNotes ? (
                      <p className="text-sm text-amber-700 dark:text-amber-500">
                        {t("safety")}: {exercise.safetyNotes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </CollapsibleSection>
  )
}

/** A single inline label/value pair within an exercise's metadata list. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}

/** Workout-log table (desktop) / stacked list (mobile) with an empty state. */
function WorkoutLog({ logs }: { logs: LogEntry[] }) {
  const t = useTranslations("TrainerDashboard.log")
  if (logs.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-4 text-card-foreground">
        <h2 className="mb-2 text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </section>
    )
  }
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="mb-3 text-lg font-medium">{t("title")}</h2>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("workout")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("difficulty")}</TableHead>
              <TableHead>{t("energy")}</TableHead>
              <TableHead>{t("notes")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">
                  {log.workoutTitle}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {log.dateLabel}
                </TableCell>
                <TableCell>{log.difficulty ?? "—"}</TableCell>
                <TableCell>{log.energy ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {log.notes ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {logs.map((log) => (
          <li key={log.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{log.workoutTitle}</span>
              <span className="text-sm text-muted-foreground">
                {log.dateLabel}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">{t("difficulty")}</dt>
                <dd>{log.difficulty ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("energy")}</dt>
                <dd>{log.energy ?? "—"}</dd>
              </div>
            </dl>
            {log.notes ? <p className="mt-2 text-sm">{log.notes}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** AI chat transcript, client/assistant bubbles, with an empty state. */
function ChatTranscript({ chat }: { chat: ChatEntry[] }) {
  const t = useTranslations("TrainerDashboard.chat")
  if (chat.length === 0) {
    return (
      <CollapsibleSection
        title={t("title")}
        storageKey="trainer-section:ai-chat"
        data-testid="section-ai-chat"
      >
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </CollapsibleSection>
    )
  }
  return (
    <CollapsibleSection
      title={t("title")}
      storageKey="trainer-section:ai-chat"
      data-testid="section-ai-chat"
    >
      <ul className="flex flex-col gap-3">
        {chat.map((message) => (
          <li
            key={message.id}
            className={
              message.role === "user"
                ? "flex flex-col items-end"
                : "flex flex-col items-start"
            }
          >
            <span className="mb-1 text-xs text-muted-foreground">
              {message.role === "user" ? t("client") : t("assistant")}
            </span>
            <div
              className={
                message.role === "user"
                  ? "max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm"
              }
            >
              <p className="break-words whitespace-pre-wrap">
                {message.content}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  )
}
