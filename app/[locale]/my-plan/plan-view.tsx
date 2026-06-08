"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { CheckCircle2, Dumbbell } from "lucide-react"

import {
  completionPercentage,
  toDateKey,
} from "@/lib/progress/progress"
import { completeWorkout } from "@/lib/workouts/logging-actions"
import {
  DIFFICULTY_LEVELS,
  ENERGY_LEVELS,
} from "@/lib/workouts/logging-constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

/** A single exercise as rendered in the plan view (serializable, camelCase). */
export interface PlanViewExercise {
  id: string
  name: string
  sets: number | null
  reps: string | null
  duration: string | null
  rest: string | null
  instructions: string | null
  safetyNotes: string | null
}

/** A workout session as rendered in the plan view. */
export interface PlanViewWorkout {
  id: string
  dayOfWeek: string | null
  title: string | null
  focus: string | null
  notes: string | null
  exercises: PlanViewExercise[]
}

/** The serializable plan payload handed from the server page to this view. */
export interface PlanViewData {
  plan: { id: string; title: string | null }
  workouts: PlanViewWorkout[]
  /** Workout ids that already have at least one completion log. */
  completedWorkoutIds: string[]
}

/** Canonical weekday order for the calendar view. */
const WEEK_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

/**
 * The key type accepted by the `MyPlan` translator. Used to cast keys composed
 * at runtime (weekday and difficulty/energy option keys) that cannot be checked
 * statically against the message catalog.
 */
type MessageKey = Parameters<ReturnType<typeof useTranslations<"MyPlan">>>[0]

/**
 * Interactive plan view: progress summary, a weekly calendar grid and a weekly
 * list (switchable via tabs), a workout-detail dialog showing each exercise's
 * sets/reps/duration/rest/instructions/safety notes, and an inline completion
 * form (difficulty, energy, notes) that calls the {@link completeWorkout} server
 * action. Completion state is held locally and seeded from the server's logs, so
 * the UI updates immediately on success while the server cache revalidates in
 * the background.
 *
 * All copy comes from the `MyPlan` namespace; the component is identical in
 * English and Hebrew and inherits RTL from the document `dir`.
 *
 * @param data - The active plan, its workouts/exercises, and completed ids.
 */
export function PlanView({ data }: { data: PlanViewData }) {
  const t = useTranslations("MyPlan")

  // Local completion set, seeded from server logs. Adding to it on success gives
  // an immediate UI update without waiting for the revalidated render.
  const [completed, setCompleted] = React.useState<Set<string>>(
    () => new Set(data.completedWorkoutIds)
  )
  const [openWorkoutId, setOpenWorkoutId] = React.useState<string | null>(null)

  const percent = completionPercentage(data.workouts.length, [...completed])

  const openWorkout =
    data.workouts.find((w) => w.id === openWorkoutId) ?? null

  // Group workouts by weekday for the calendar; sessions without a recognised
  // day fall into an "unscheduled" bucket rendered after the week.
  const byDay = new Map<string, PlanViewWorkout[]>()
  const unscheduled: PlanViewWorkout[] = []
  for (const workout of data.workouts) {
    const day = workout.dayOfWeek?.toLowerCase() ?? ""
    if ((WEEK_ORDER as readonly string[]).includes(day)) {
      const list = byDay.get(day) ?? []
      list.push(workout)
      byDay.set(day, list)
    } else {
      unscheduled.push(workout)
    }
  }

  function markCompleted(workoutId: string) {
    setCompleted((prev) => {
      const next = new Set(prev)
      next.add(workoutId)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label={t("progress.label")}
        className="flex flex-col gap-2 rounded-lg border bg-card p-4"
      >
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{t("progress.label")}</span>
          <span className="text-muted-foreground" data-testid="progress-value">
            {t("progress.summary", {
              done: completed.size,
              total: data.workouts.length,
              percent,
            })}
          </span>
        </div>
        <Progress value={percent} />
      </section>

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">{t("views.calendar")}</TabsTrigger>
          <TabsTrigger value="list">{t("views.list")}</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WEEK_ORDER.map((day) => (
              <div key={day} className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {t(`weekday.${day}` as MessageKey)}
                </h2>
                {(byDay.get(day) ?? []).map((workout) => (
                  <WorkoutCard
                    key={workout.id}
                    t={t}
                    workout={workout}
                    done={completed.has(workout.id)}
                    onOpen={() => setOpenWorkoutId(workout.id)}
                  />
                ))}
                {(byDay.get(day) ?? []).length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    {t("calendar.rest")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {unscheduled.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t("calendar.unscheduled")}
              </h2>
              {unscheduled.map((workout) => (
                <WorkoutCard
                  key={workout.id}
                  t={t}
                  workout={workout}
                  done={completed.has(workout.id)}
                  onOpen={() => setOpenWorkoutId(workout.id)}
                />
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="list">
          <div className="flex flex-col gap-3">
            {data.workouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                t={t}
                workout={workout}
                done={completed.has(workout.id)}
                onOpen={() => setOpenWorkoutId(workout.id)}
                showDay
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={openWorkout !== null}
        onOpenChange={(open) => {
          if (!open) setOpenWorkoutId(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {openWorkout ? (
            <WorkoutDetail
              t={t}
              workout={openWorkout}
              done={completed.has(openWorkout.id)}
              onCompleted={() => markCompleted(openWorkout.id)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

type Translator = ReturnType<typeof useTranslations<"MyPlan">>

/** Compact card summarising a workout, with a completed badge and open action. */
function WorkoutCard({
  t,
  workout,
  done,
  onOpen,
  showDay = false,
}: {
  t: Translator
  workout: PlanViewWorkout
  done: boolean
  onOpen: () => void
  showDay?: boolean
}) {
  const day =
    showDay && workout.dayOfWeek
      ? t(`weekday.${workout.dayOfWeek.toLowerCase()}` as MessageKey)
      : null
  return (
    <Card className="gap-3">
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            {workout.title ?? t("untitledWorkout")}
          </CardTitle>
          {done ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              {t("status.completed")}
            </Badge>
          ) : null}
        </div>
        {workout.focus || day ? (
          <CardDescription>
            {[day, workout.focus].filter(Boolean).join(" · ")}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="sm" onClick={onOpen}>
          {t("actions.view")}
        </Button>
      </CardContent>
    </Card>
  )
}

/** Full workout detail: exercises and the completion feedback form. */
function WorkoutDetail({
  t,
  workout,
  done,
  onCompleted,
}: {
  t: Translator
  workout: PlanViewWorkout
  done: boolean
  onCompleted: () => void
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{workout.title ?? t("untitledWorkout")}</DialogTitle>
        {workout.focus ? (
          <DialogDescription>{workout.focus}</DialogDescription>
        ) : null}
      </DialogHeader>

      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
        {workout.notes ? (
          <p className="text-sm text-muted-foreground">{workout.notes}</p>
        ) : null}

        <ol className="flex flex-col gap-3">
          {workout.exercises.map((exercise) => (
            <li
              key={exercise.id}
              className="flex flex-col gap-1 rounded-md border p-3"
            >
              <div className="flex items-center gap-2 font-medium">
                <Dumbbell className="size-4 text-muted-foreground" aria-hidden />
                {exercise.name}
              </div>
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {exercise.sets != null ? (
                  <Detail label={t("exercise.sets")} value={String(exercise.sets)} />
                ) : null}
                {exercise.reps ? (
                  <Detail label={t("exercise.reps")} value={exercise.reps} />
                ) : null}
                {exercise.duration ? (
                  <Detail
                    label={t("exercise.duration")}
                    value={exercise.duration}
                  />
                ) : null}
                {exercise.rest ? (
                  <Detail label={t("exercise.rest")} value={exercise.rest} />
                ) : null}
              </dl>
              {exercise.instructions ? (
                <p className="text-sm">{exercise.instructions}</p>
              ) : null}
              {exercise.safetyNotes ? (
                <p className="text-sm text-amber-700 dark:text-amber-500">
                  {t("exercise.safety")}: {exercise.safetyNotes}
                </p>
              ) : null}
            </li>
          ))}
        </ol>

        {done ? (
          <p
            className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm"
            role="status"
          >
            <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
            {t("status.alreadyCompleted")}
          </p>
        ) : (
          <CompletionForm
            t={t}
            workoutId={workout.id}
            onCompleted={onCompleted}
          />
        )}
      </div>
    </>
  )
}

/** A `term: value` inline detail pair. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt className="font-medium text-foreground">{label}:</dt>
      <dd>{value}</dd>
    </div>
  )
}

/** Inline completion form: difficulty, energy, notes, then submit. */
function CompletionForm({
  t,
  workoutId,
  onCompleted,
}: {
  t: Translator
  workoutId: string
  onCompleted: () => void
}) {
  const [difficulty, setDifficulty] = React.useState("")
  const [energy, setEnergy] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const result = await completeWorkout({
      workoutId,
      // Stamp the completion against today's calendar date so the unique
      // constraint distinguishes repeats on different days.
      plannedDate: toDateKey(new Date()),
      difficulty: difficulty || null,
      energyLevel: energy || null,
      notes: notes || null,
    })

    setPending(false)

    if (!result.ok) {
      // Map known codes to localized copy; fall back to a generic message.
      const code = result.error
      const known = new Set([
        "signedOut",
        "duplicate",
        "invalidWorkout",
        "invalidDate",
        "invalidDifficulty",
        "invalidEnergy",
        "notesTooLong",
        "saveFailed",
      ])
      setError(
        known.has(code)
          ? t(`errors.${code}` as MessageKey)
          : t("errors.saveFailed")
      )
      return
    }

    onCompleted()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t pt-4">
      <h3 className="text-sm font-medium">{t("completion.title")}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="difficulty">{t("completion.difficulty")}</Label>
          <NativeSelect
            id="difficulty"
            className="w-full"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <NativeSelectOption value="">
              {t("completion.unselected")}
            </NativeSelectOption>
            {DIFFICULTY_LEVELS.map((level) => (
              <NativeSelectOption key={level} value={level}>
                {t(`difficulty.${level}` as MessageKey)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="energy">{t("completion.energy")}</Label>
          <NativeSelect
            id="energy"
            className="w-full"
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
          >
            <NativeSelectOption value="">
              {t("completion.unselected")}
            </NativeSelectOption>
            {ENERGY_LEVELS.map((level) => (
              <NativeSelectOption key={level} value={level}>
                {t(`energy.${level}` as MessageKey)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">{t("completion.notes")}</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} data-testid="complete-workout">
        {pending ? t("completion.saving") : t("completion.submit")}
      </Button>
    </form>
  )
}
