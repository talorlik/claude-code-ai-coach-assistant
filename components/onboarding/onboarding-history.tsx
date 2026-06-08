import { useFormatter, useTranslations } from "next-intl"

import type { OnboardingSnapshot } from "@/lib/db/mappers"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Read-only history of a client's onboarding snapshots, newest first. Each row
 * is one plan-producing generation: the details captured at that moment plus
 * when they were saved. The newest snapshot corresponds to the client's current
 * active plan (snapshots are written once per generation), so it carries a
 * "Current" badge; older rows are prior generations.
 *
 * Pure presentational server component: it renders the snapshots handed to it
 * and reads no data itself. Labels come from the `Account` and `Onboarding`
 * namespaces so it is identical in both locales and inherits RTL from the
 * document direction.
 *
 * @param snapshots - The client's snapshots, newest first.
 */
export function OnboardingHistory({
  snapshots,
}: {
  snapshots: OnboardingSnapshot[]
}) {
  const t = useTranslations("AccountOnboarding")
  const tOnboarding = useTranslations("Onboarding")
  const format = useFormatter()

  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      {snapshots.map((snap, index) => {
        const goals = snap.goals
          .map((g) => tOnboarding(`options.goal.${g}` as never))
          .join(", ")
        const days = snap.availableDays
          .map((d) => tOnboarding(`options.day.${d}` as never))
          .join(", ")
        const equipment = [
          ...snap.equipment.map((e) =>
            tOnboarding(`options.equipment.${e}` as never)
          ),
          ...snap.equipmentOther,
        ].join(", ")
        return (
          <li key={snap.id}>
            <Card className="gap-2">
              <CardHeader className="gap-1">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {t("historyDate", {
                      date: format.dateTime(new Date(snap.createdAt), {
                        dateStyle: "medium",
                      }),
                    })}
                  </CardTitle>
                  <Badge variant={index === 0 ? "default" : "secondary"}>
                    {index === 0 ? t("historyCurrent") : t("historyArchived")}
                  </Badge>
                </div>
                {goals ? <CardDescription>{goals}</CardDescription> : null}
              </CardHeader>
              <CardContent>
                <dl className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                  <HistoryDetail
                    label={tOnboarding("fields.availableDays")}
                    value={days}
                  />
                  {snap.sessionDurationMinutes != null ? (
                    <HistoryDetail
                      label={tOnboarding("fields.sessionDuration")}
                      value={tOnboarding("availability.minutes", {
                        minutes: snap.sessionDurationMinutes,
                      })}
                    />
                  ) : null}
                  {snap.fitnessLevel ? (
                    <HistoryDetail
                      label={tOnboarding("fields.fitnessLevel")}
                      value={tOnboarding(
                        `options.fitnessLevel.${snap.fitnessLevel}` as never
                      )}
                    />
                  ) : null}
                  {equipment ? (
                    <HistoryDetail
                      label={tOnboarding("fields.equipment")}
                      value={equipment}
                    />
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ol>
  )
}

/** A `label: value` detail pair within a history card. */
function HistoryDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt className="font-medium text-foreground">{label}:</dt>
      <dd>{value}</dd>
    </div>
  )
}
