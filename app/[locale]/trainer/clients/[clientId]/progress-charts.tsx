"use client"

import { useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

/**
 * A single chart datum: a short x-axis label and the completion count for that
 * bucket. Buckets are pre-computed server-side by the aggregation helpers, so
 * this component only renders; it derives no business logic.
 */
export interface ProgressDatum {
  /** Short bucket label for the x-axis (e.g. a week-ending date or month). */
  label: string
  /** Number of completed workouts in the bucket. */
  count: number
}

/**
 * Two responsive Recharts bar charts (weekly and monthly) of a client's
 * completed-workout counts. Colours come from the theme token
 * `--color-completions`, supplied through {@link ChartContainer}'s config, so
 * the bars adapt to light and dark mode automatically. The charts inherit the
 * page's text direction, so they read right-to-left under the Hebrew locale
 * without any per-locale branching here. When a series has no completions at all
 * a localized empty hint is shown in place of an empty chart.
 *
 * @param weekly - Weekly buckets, oldest first.
 * @param monthly - Monthly buckets, oldest first.
 */
export function ProgressCharts({
  weekly,
  monthly,
}: {
  weekly: ProgressDatum[]
  monthly: ProgressDatum[]
}) {
  const t = useTranslations("TrainerDashboard.charts")

  const config: ChartConfig = {
    count: {
      label: t("completions"),
      // Use a stable chart palette token so both themes resolve a readable bar.
      color: "var(--chart-1)",
    },
  }

  const hasWeekly = weekly.some((d) => d.count > 0)
  const hasMonthly = monthly.some((d) => d.count > 0)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard
        title={t("weeklyTitle")}
        subtitle={t("weeklySubtitle")}
        empty={!hasWeekly}
        emptyLabel={t("empty")}
      >
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart accessibilityLayer data={weekly}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title={t("monthlyTitle")}
        subtitle={t("monthlySubtitle")}
        empty={!hasMonthly}
        emptyLabel={t("empty")}
      >
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart accessibilityLayer data={monthly}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  )
}

/** Card wrapper giving each chart a localized title, subtitle, and empty state. */
function ChartCard({
  title,
  subtitle,
  empty,
  emptyLabel,
  children,
}: {
  title: string
  subtitle: string
  empty: boolean
  emptyLabel: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <header className="mb-3 flex flex-col gap-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>
      {empty ? (
        <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        children
      )}
    </section>
  )
}
