"use client"

import { useTranslations } from "next-intl"
import { ArrowLeft, MessageCircle } from "lucide-react"

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
import {
  TrainerNotesPanel,
  type TrainerNoteItem,
} from "./trainer-notes-panel"

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

/** Everything the dashboard renders, fully serializable for the client boundary. */
export interface ClientDashboardData {
  clientId: string
  displayName: string
  profileFields: ProfileField[]
  planTitle: string | null
  completionPercent: number
  weekly: ProgressDatum[]
  monthly: ProgressDatum[]
  logs: LogEntry[]
  chat: ChatEntry[]
  whatsAppHref: string | null
  notes: TrainerNoteItem[]
}

/**
 * The trainer's detailed dashboard for one client: profile summary, current plan
 * with completion, weekly/monthly progress charts, the workout log, the AI chat
 * transcript, a WhatsApp contact button (only when a valid phone exists), and
 * the private notes panel. Every value is resolved and localized server-side and
 * passed in as plain data, so this component is a pure presentation layer. Copy
 * comes from the `TrainerDashboard` namespace; the layout inherits the page
 * direction, so it reads right-to-left under Hebrew.
 *
 * @param data - The fully-shaped, serializable dashboard data.
 */
export function ClientDashboard({ data }: { data: ClientDashboardData }) {
  const t = useTranslations("TrainerDashboard")

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
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
        title={data.planTitle}
        completionPercent={data.completionPercent}
      />

      <ProgressCharts weekly={data.weekly} monthly={data.monthly} />

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

/** Current-plan card with title and a completion progress bar. */
function PlanSummary({
  title,
  completionPercent,
}: {
  title: string | null
  completionPercent: number
}) {
  const t = useTranslations("TrainerDashboard.plan")
  if (!title) {
    return (
      <section className="rounded-lg border bg-card p-4 text-card-foreground">
        <h2 className="mb-2 text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      </section>
    )
  }
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <Badge variant="secondary">{title}</Badge>
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
                <TableCell className="font-medium">{log.workoutTitle}</TableCell>
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
      <section className="rounded-lg border bg-card p-4 text-card-foreground">
        <h2 className="mb-2 text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </section>
    )
  }
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="mb-3 text-lg font-medium">{t("title")}</h2>
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
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
