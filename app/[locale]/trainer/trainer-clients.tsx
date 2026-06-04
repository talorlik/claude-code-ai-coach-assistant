"use client"

import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import type { ActivityColor, ActivityLevel } from "@/lib/trainer/activity"

/**
 * One client's row as rendered by the trainer client list. A plain,
 * serializable shape: the server page resolves the locale-formatted join date
 * and the activity level/colour so this component renders without re-deriving
 * any business logic.
 */
export interface TrainerClientRow {
  /** The client's auth user id; also the dashboard route segment. */
  userId: string
  /** Display name, or `null` if onboarding did not capture one. */
  fullName: string | null
  /** The client's primary goal, or `null`. */
  goal: string | null
  /** ISO timestamp used as the sortable/raw join date. */
  joinDate: string
  /** Locale-formatted join date for display. */
  joinDateLabel: string
  /** Whether the client has an active workout plan. */
  hasActivePlan: boolean
  /** Current-month completion percentage (0-100). */
  completionPercent: number
  /** Discrete activity level driving the indicator. */
  activityLevel: ActivityLevel
  /** Traffic-light colour token for the indicator. */
  activityColor: ActivityColor
}

/** Tailwind classes for each activity colour's indicator dot. */
const DOT_CLASS: Record<ActivityColor, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-500",
}

/**
 * Interactive trainer client list. Renders a table on wide viewports and a
 * stacked card layout on narrow ones (the table is hidden below `md`, the cards
 * above it), so the same data reads well on a phone or a desktop. Each client
 * links to their detailed dashboard at `/trainer/clients/[clientId]`. All copy is
 * localized through the `TrainerClients` namespace; the activity indicator's
 * colour is decided server-side and only mapped to a class here.
 *
 * @param rows - The clients to render, already shaped and localized by the page.
 */
export function TrainerClients({ rows }: { rows: TrainerClientRow[] }) {
  const t = useTranslations("TrainerClients")

  const goalLabel = (goal: string | null) => goal ?? t("noGoal")
  const planLabel = (hasActivePlan: boolean) =>
    hasActivePlan ? t("plan.active") : t("plan.none")
  const activityLabel = (level: ActivityLevel) => t(`activity.${level}`)

  return (
    <div>
      {/* Desktop / tablet: table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead>{t("columns.goal")}</TableHead>
              <TableHead>{t("columns.joinDate")}</TableHead>
              <TableHead>{t("columns.plan")}</TableHead>
              <TableHead>{t("columns.completion")}</TableHead>
              <TableHead>{t("columns.activity")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link
                    href={`/trainer/clients/${row.userId}`}
                    className="hover:underline"
                  >
                    {row.fullName ?? t("unnamed")}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {goalLabel(row.goal)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.joinDateLabel}
                </TableCell>
                <TableCell>
                  <Badge variant={row.hasActivePlan ? "secondary" : "outline"}>
                    {planLabel(row.hasActivePlan)}
                  </Badge>
                </TableCell>
                <TableCell>{t("percent", { value: row.completionPercent })}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "size-2.5 rounded-full",
                        DOT_CLASS[row.activityColor]
                      )}
                    />
                    <span>{activityLabel(row.activityLevel)}</span>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.userId}>
            <Link
              href={`/trainer/clients/${row.userId}`}
              className="block rounded-lg border bg-card p-4 text-card-foreground transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">
                  {row.fullName ?? t("unnamed")}
                </span>
                <span className="inline-flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 rounded-full",
                      DOT_CLASS[row.activityColor]
                    )}
                  />
                  <span>{activityLabel(row.activityLevel)}</span>
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("columns.goal")}</dt>
                  <dd>{goalLabel(row.goal)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("columns.joinDate")}
                  </dt>
                  <dd>{row.joinDateLabel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("columns.plan")}</dt>
                  <dd>{planLabel(row.hasActivePlan)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("columns.completion")}
                  </dt>
                  <dd>{t("percent", { value: row.completionPercent })}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
