"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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
import {
  deleteClientAction,
  setPlanActiveAction,
} from "@/lib/db/trainer-clients-actions"
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
  /** The client's selected goals. */
  goals: string[]
  /** ISO timestamp used as the sortable/raw join date. */
  joinDate: string
  /** Locale-formatted join date for display. */
  joinDateLabel: string
  /** Whether the client has an active workout plan. */
  hasActivePlan: boolean
  /** Whether the client has any plan at all (active or archived). */
  hasAnyPlan: boolean
  /** Current-month completion percentage (0-100). */
  completionPercent: number
  /** Discrete activity level driving the indicator. */
  activityLevel: ActivityLevel
  /** Traffic-light colour token for the indicator. */
  activityColor: ActivityColor
}

/**
 * A valid message key within the `TrainerClients` namespace. The row actions'
 * server actions return localizable failure *keys* (e.g. `"plan.updateError"`,
 * `"delete.error"`) as plain strings on `ActionResult.error`; this cast target
 * lets us feed those back into the namespace-typed `t` to resolve the copy. This
 * follows the repo's established dynamic-key pattern (see `onboarding-form.tsx`).
 */
type TrainerClientsMessageKey = Parameters<
  ReturnType<typeof useTranslations<"TrainerClients">>
>[0]

/** Tailwind classes for each activity colour's indicator dot. */
const DOT_CLASS: Record<ActivityColor, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-500",
}

/**
 * Inline plan active/inactive toggle. Reflects state in both colour and word:
 * an active plan shows an emerald indicator and the active label; an inactive
 * plan a muted indicator and the inactive label. Disabled when the client has
 * no plan at all, since there is nothing to activate. Optimistically flips,
 * calls {@link setPlanActiveAction}, and reverts with a toast on failure.
 */
function PlanToggle({
  clientId,
  name,
  hasActivePlan,
  hasAnyPlan,
}: {
  clientId: string
  name: string
  hasActivePlan: boolean
  hasAnyPlan: boolean
}) {
  const t = useTranslations("TrainerClients")
  const [active, setActive] = useState(hasActivePlan)
  const [pending, startTransition] = useTransition()

  const disabled = pending || (!active && !hasAnyPlan)

  const onChange = (next: boolean) => {
    setActive(next)
    startTransition(async () => {
      const result = await setPlanActiveAction(clientId, next)
      if (!result.ok) {
        setActive(!next)
        toast.error(t(result.error as TrainerClientsMessageKey))
      }
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          "size-2.5 rounded-full",
          active ? "bg-emerald-500" : "bg-muted-foreground/40"
        )}
      />
      <Switch
        checked={active}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={t("plan.toggleLabel", { name })}
      />
      <span className={cn("text-sm", !active && "text-muted-foreground")}>
        {active ? t("plan.active") : t("plan.none")}
      </span>
    </span>
  )
}

/**
 * The trailing edit/delete controls for a client. Edit is a link to the
 * client's dashboard (the edit surface); delete opens a confirm dialog and
 * calls {@link deleteClientAction}. Both controls carry a name-interpolated
 * accessible label so screen-reader users can tell the rows apart.
 */
function RowActions({ clientId, name }: { clientId: string; name: string }) {
  const t = useTranslations("TrainerClients")
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteClientAction(clientId)
      if (result.ok) {
        toast.success(t("delete.success"))
        setOpen(false)
      } else {
        toast.error(t(result.error as TrainerClientsMessageKey))
      }
    })
  }

  return (
    <span className="inline-flex items-center justify-end gap-1">
      <Link
        href={`/trainer/clients/${clientId}`}
        aria-label={t("actions.editLabel", { name })}
        title={t("actions.edit")}
        className={buttonVariants({ variant: "ghost", size: "icon" })}
      >
        <Pencil className="size-4" aria-hidden />
      </Link>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("actions.deleteLabel", { name })}
              title={t("actions.delete")}
            >
              <Trash2 className="size-4 text-destructive" aria-hidden />
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.confirmDescription", { name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                onConfirm()
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("delete.confirmCta")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  )
}

/**
 * Interactive trainer client list. Renders a table on wide viewports and a
 * stacked card layout on narrow ones (the table is hidden below `md`, the cards
 * above it), so the same data reads well on a phone or a desktop. Each client
 * has explicit row actions: an edit link to their dashboard at
 * `/trainer/clients/[clientId]`, a delete control (confirmed), and an inline
 * plan active/inactive toggle. The row itself is no longer clickable; only the
 * controls act. All copy is localized through the `TrainerClients` namespace;
 * the activity indicator's colour is decided server-side and only mapped to a
 * class here.
 *
 * @param rows - The clients to render, already shaped and localized by the page.
 */
export function TrainerClients({ rows }: { rows: TrainerClientRow[] }) {
  const t = useTranslations("TrainerClients")

  const goalLabel = (goals: string[]) =>
    goals.length > 0 ? goals.join(", ") : t("noGoal")
  const activityLabel = (level: ActivityLevel) => t(`activity.${level}`)
  const nameOf = (row: TrainerClientRow) => row.fullName ?? t("unnamed")

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
              <TableHead>
                <span className="sr-only">{t("columns.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId}>
                <TableCell className="font-medium">{nameOf(row)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {goalLabel(row.goals)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.joinDateLabel}
                </TableCell>
                <TableCell>
                  {/*
                    Key on the server-resolved hasActivePlan so a revalidated
                    value forces a remount and reseeds PlanToggle's optimistic
                    local state. Without this, React keeps the existing instance
                    on prop change and the local state can silently desync from
                    server truth.
                  */}
                  <PlanToggle
                    key={`${row.userId}:${row.hasActivePlan}`}
                    clientId={row.userId}
                    name={nameOf(row)}
                    hasActivePlan={row.hasActivePlan}
                    hasAnyPlan={row.hasAnyPlan}
                  />
                </TableCell>
                <TableCell>
                  {t("percent", { value: row.completionPercent })}
                </TableCell>
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
                <TableCell className="text-end">
                  <RowActions clientId={row.userId} name={nameOf(row)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.userId}
            className="rounded-lg border bg-card p-4 text-card-foreground"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{nameOf(row)}</span>
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
                <dd>{goalLabel(row.goals)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("columns.joinDate")}
                </dt>
                <dd>{row.joinDateLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("columns.plan")}</dt>
                <dd>
                  <PlanToggle
                    key={`${row.userId}:${row.hasActivePlan}`}
                    clientId={row.userId}
                    name={nameOf(row)}
                    hasActivePlan={row.hasActivePlan}
                    hasAnyPlan={row.hasAnyPlan}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("columns.completion")}
                </dt>
                <dd>{t("percent", { value: row.completionPercent })}</dd>
              </div>
            </dl>
            <div className="mt-3 flex justify-end">
              <RowActions clientId={row.userId} name={nameOf(row)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
