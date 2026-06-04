import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Link } from "@/i18n/navigation"
import { requireClient } from "@/lib/auth/require-user"
import { getActivePlanDetail } from "@/lib/db/workouts"
import type { Locale } from "@/i18n/routing"
import { PlanView, type PlanViewData } from "./plan-view"

/**
 * The plan view is a private, per-user surface; keep it out of search indexes.
 * The visible title is localized via the `MyPlan` namespace; this metadata title
 * is a stable, non-indexed fallback.
 */
export const metadata: Metadata = {
  title: "My Plan",
  robots: { index: false, follow: false },
}

/**
 * Localized client plan page at `/[locale]/my-plan`. `requireClient()` is the
 * authoritative guard: signed-out visitors are redirected to the localized login
 * page before any content renders. The active plan (with its workouts,
 * exercises, and completion logs) is loaded server-side and handed to the
 * interactive {@link PlanView}; when the client has no active plan, a localized
 * empty state points them to onboarding.
 *
 * @param params - The dynamic route params carrying the active locale.
 */
export default async function MyPlanPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  // Opt into static rendering for this locale before any next-intl hook runs.
  setRequestLocale(locale)

  // Authoritative auth guard; redirects (locale-preserving) when signed out.
  const userId = await requireClient()

  const detail = await getActivePlanDetail(userId)
  const t = await getTranslations("MyPlan")

  if (!detail) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("empty.title")}</EmptyTitle>
            <EmptyDescription>{t("empty.description")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href="/join" className={buttonVariants()}>
              {t("empty.cta")}
            </Link>
          </EmptyContent>
        </Empty>
      </main>
    )
  }

  // Shape the server rows into the plain, serializable structure the client
  // component renders. Only the fields the UI needs cross the boundary.
  const data: PlanViewData = {
    plan: {
      id: detail.plan.id,
      title: detail.plan.title,
    },
    workouts: detail.workouts.map((workout) => ({
      id: workout.id,
      dayOfWeek: workout.day_of_week,
      title: workout.title,
      focus: workout.focus,
      notes: workout.notes,
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
    })),
    completedWorkoutIds: detail.logs.map((log) => log.workout_id),
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {detail.plan.title ?? t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </header>

      <PlanView data={data} />
    </main>
  )
}
