"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Pencil, Plus, Save, Trash2, X } from "lucide-react"

import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  addExerciseAction,
  addWorkoutAction,
  deleteExerciseAction,
  deleteWorkoutAction,
  updateExerciseAction,
  updateWorkoutAction,
  type ExerciseInput,
  type WorkoutInput,
} from "@/lib/trainer/plan-edit-actions"
import type { ActionResult } from "@/lib/types/action-result"
import { CollapsibleSection } from "./collapsible-section"

/** One editable exercise as the editor receives it from the server. */
export interface EditableExercise {
  id: string
  name: string
  sets: number | null
  reps: string | null
  duration: string | null
  rest: string | null
  instructions: string | null
  safetyNotes: string | null
}

/** One editable workout with its exercises and a logs-present flag. */
export interface EditableWorkout {
  id: string
  title: string | null
  focus: string | null
  dayOfWeek: string | null
  notes: string | null
  /**
   * `true` when completion logs reference this workout. A workout with logs
   * cannot be hard-deleted (the cascade would destroy history), so the editor
   * disables its delete control and explains why.
   */
  hasLogs: boolean
  exercises: EditableExercise[]
}

/** The serializable bundle the dashboard passes into the editor. */
export interface PlanEditorData {
  clientId: string
  planId: string
  /** Whether the client declared limitations; drives the safety-note rule. */
  hasLimitations: boolean
  workouts: EditableWorkout[]
}

/** Field-error codes the editor actions can return, mapped to localized copy. */
const KNOWN_CODES = [
  "invalid",
  "safetyRequired",
  "hasLogs",
  "missing",
  "loadError",
  "saveError",
] as const
type KnownCode = (typeof KNOWN_CODES)[number]

function isKnownCode(code: string | undefined): code is KnownCode {
  return code != null && (KNOWN_CODES as readonly string[]).includes(code)
}

/** Mutable working copy of an exercise's editable fields. */
interface ExerciseDraft {
  name: string
  sets: string
  reps: string
  duration: string
  rest: string
  instructions: string
  safetyNotes: string
}

/** Mutable working copy of a workout's editable metadata. */
interface WorkoutDraft {
  title: string
  focus: string
  dayOfWeek: string
  notes: string
}

/** Parses a free-text sets value into the nullable integer the schema expects. */
function parseSets(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === "") return null
  const n = Number.parseInt(trimmed, 10)
  return Number.isNaN(n) ? null : n
}

/** Normalises a trimmed string to `null` when empty (matches the row columns). */
function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

/** Builds the action input for an exercise from its draft. */
function exerciseInput(draft: ExerciseDraft): ExerciseInput {
  return {
    name: draft.name.trim(),
    sets: parseSets(draft.sets),
    reps: orNull(draft.reps),
    duration: orNull(draft.duration),
    rest: orNull(draft.rest),
    instructions: orNull(draft.instructions),
    safety_notes: orNull(draft.safetyNotes),
  }
}

/** Builds the action input for a workout from its draft. */
function workoutInput(draft: WorkoutDraft): WorkoutInput {
  return {
    title: draft.title.trim(),
    focus: orNull(draft.focus),
    day_of_week: orNull(draft.dayOfWeek),
    notes: orNull(draft.notes),
  }
}

/**
 * The trainer's in-place live-plan editor. Renders each workout of the client's
 * active plan with controls to edit its metadata, edit/add/remove its exercises,
 * remove the workout (blocked with a localized message when it has logged
 * sessions), and add a new workout to the plan. Every mutation calls a guarded
 * server action; on success the route is refreshed (like
 * {@link RegenerateClientPlan}) so the server-rendered plan reflects the change.
 *
 * The editor never hard-deletes a workout with completion logs: the dashboard
 * passes `hasLogs` per workout, and the action independently refuses, so history
 * is protected at both layers. Validation and the per-client safety rule are
 * authoritative in the actions; the editor only surfaces their localized result.
 *
 * Copy comes from the `PlanEditor` namespace; the component inherits the page
 * direction, so it reads right-to-left under Hebrew.
 *
 * @param data - The plan, its workouts/exercises, and the limitations flag.
 */
export function PlanEditor({ data }: { data: PlanEditorData }) {
  const t = useTranslations("PlanEditor")
  const router = useRouter()

  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [editingWorkout, setEditingWorkout] = React.useState<string | null>(
    null
  )
  const [workoutDraft, setWorkoutDraft] = React.useState<WorkoutDraft | null>(
    null
  )
  const [editingExercise, setEditingExercise] = React.useState<string | null>(
    null
  )
  const [exerciseDraft, setExerciseDraft] =
    React.useState<ExerciseDraft | null>(null)
  const [addingTo, setAddingTo] = React.useState<string | null>(null)

  /** Maps an action failure to localized copy. */
  function messageFor(result: {
    error: string
    fieldErrors?: Record<string, string>
  }): string {
    const code = result.fieldErrors?.code
    if (isKnownCode(code)) return t(`errors.${code}`)
    return result.error || t("errors.generic")
  }

  /** Runs an action, refreshing on success and surfacing a localized failure. */
  async function run<T>(
    action: () => Promise<ActionResult<T>>
  ): Promise<boolean> {
    setPending(true)
    setError(null)
    try {
      const result = await action()
      if (!result.ok) {
        setError(messageFor(result))
        return false
      }
      router.refresh()
      return true
    } finally {
      setPending(false)
    }
  }

  function startEditWorkout(workout: EditableWorkout) {
    setError(null)
    setEditingWorkout(workout.id)
    setWorkoutDraft({
      title: workout.title ?? "",
      focus: workout.focus ?? "",
      dayOfWeek: workout.dayOfWeek ?? "",
      notes: workout.notes ?? "",
    })
  }

  function startEditExercise(exercise: EditableExercise) {
    setError(null)
    setEditingExercise(exercise.id)
    setExerciseDraft({
      name: exercise.name,
      sets: exercise.sets != null ? String(exercise.sets) : "",
      reps: exercise.reps ?? "",
      duration: exercise.duration ?? "",
      rest: exercise.rest ?? "",
      instructions: exercise.instructions ?? "",
      safetyNotes: exercise.safetyNotes ?? "",
    })
  }

  function startAddExercise(workoutId: string) {
    setError(null)
    setAddingTo(workoutId)
    setExerciseDraft({
      name: "",
      sets: "",
      reps: "",
      duration: "",
      rest: "",
      instructions: "",
      safetyNotes: "",
    })
  }

  async function saveWorkout(workoutId: string) {
    if (!workoutDraft) return
    const okSaved = await run(() =>
      updateWorkoutAction(workoutId, workoutInput(workoutDraft))
    )
    if (okSaved) {
      setEditingWorkout(null)
      setWorkoutDraft(null)
    }
  }

  async function saveExercise(exerciseId: string) {
    if (!exerciseDraft) return
    const okSaved = await run(() =>
      updateExerciseAction(exerciseId, exerciseInput(exerciseDraft))
    )
    if (okSaved) {
      setEditingExercise(null)
      setExerciseDraft(null)
    }
  }

  async function saveNewExercise(workoutId: string) {
    if (!exerciseDraft) return
    const okSaved = await run(() =>
      addExerciseAction(workoutId, exerciseInput(exerciseDraft))
    )
    if (okSaved) {
      setAddingTo(null)
      setExerciseDraft(null)
    }
  }

  async function removeExercise(exerciseId: string) {
    await run(() => deleteExerciseAction(exerciseId))
  }

  async function removeWorkout(workoutId: string) {
    await run(() => deleteWorkoutAction(workoutId))
  }

  async function addNewWorkout() {
    await run(() =>
      addWorkoutAction(data.planId, {
        title: t("newWorkoutTitle"),
        focus: null,
        day_of_week: null,
        notes: null,
      })
    )
  }

  return (
    <CollapsibleSection
      title={t("title")}
      storageKey="trainer-section:edit-live-plan"
      data-testid="section-edit-live-plan"
      subtitle={t("intro")}
      headerAction={
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addNewWorkout}
          disabled={pending}
          data-testid="add-workout"
        >
          <Plus className="size-4" />
          {t("addWorkout")}
        </Button>
      }
    >

      {data.hasLimitations ? (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-500">
          {t("limitationsNotice")}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ol className="flex flex-col gap-4">
        {data.workouts.map((workout) => (
          <li
            key={workout.id}
            className="rounded-md border p-4"
            data-testid="editor-workout"
          >
            {editingWorkout === workout.id && workoutDraft ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`w-title-${workout.id}`}>
                    {t("fields.workoutTitle")}
                  </Label>
                  <Input
                    id={`w-title-${workout.id}`}
                    value={workoutDraft.title}
                    onChange={(e) =>
                      setWorkoutDraft({
                        ...workoutDraft,
                        title: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`w-focus-${workout.id}`}>
                      {t("fields.focus")}
                    </Label>
                    <Input
                      id={`w-focus-${workout.id}`}
                      value={workoutDraft.focus}
                      onChange={(e) =>
                        setWorkoutDraft({
                          ...workoutDraft,
                          focus: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`w-day-${workout.id}`}>
                      {t("fields.dayOfWeek")}
                    </Label>
                    <Input
                      id={`w-day-${workout.id}`}
                      value={workoutDraft.dayOfWeek}
                      onChange={(e) =>
                        setWorkoutDraft({
                          ...workoutDraft,
                          dayOfWeek: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`w-notes-${workout.id}`}>
                    {t("fields.notes")}
                  </Label>
                  <Textarea
                    id={`w-notes-${workout.id}`}
                    rows={2}
                    value={workoutDraft.notes}
                    onChange={(e) =>
                      setWorkoutDraft({
                        ...workoutDraft,
                        notes: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveWorkout(workout.id)}
                    disabled={pending}
                    data-testid="save-workout"
                  >
                    <Save className="size-4" />
                    {t("save")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingWorkout(null)
                      setWorkoutDraft(null)
                    }}
                    disabled={pending}
                  >
                    <X className="size-4" />
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">
                    {workout.title ?? t("untitledWorkout")}
                  </h3>
                  {workout.focus ? (
                    <p className="text-sm text-muted-foreground">
                      {t("fields.focus")}: {workout.focus}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEditWorkout(workout)}
                    disabled={pending}
                    data-testid="edit-workout"
                  >
                    <Pencil className="size-4" />
                    {t("editWorkout")}
                  </Button>
                  {workout.hasLogs ? (
                    <span
                      className="text-xs text-muted-foreground"
                      data-testid="workout-locked"
                    >
                      {t("errors.hasLogs")}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeWorkout(workout.id)}
                      disabled={pending}
                      data-testid="delete-workout"
                    >
                      <Trash2 className="size-4" />
                      {t("deleteWorkout")}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <ol className="mt-3 flex flex-col gap-2">
              {workout.exercises.map((exercise) => (
                <li
                  key={exercise.id}
                  className="rounded-md border p-3"
                  data-testid="editor-exercise"
                >
                  {editingExercise === exercise.id && exerciseDraft ? (
                    <ExerciseFields
                      draft={exerciseDraft}
                      onChange={setExerciseDraft}
                      onSave={() => saveExercise(exercise.id)}
                      onCancel={() => {
                        setEditingExercise(null)
                        setExerciseDraft(null)
                      }}
                      pending={pending}
                      t={t}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{exercise.name}</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditExercise(exercise)}
                          disabled={pending}
                          data-testid="edit-exercise"
                        >
                          <Pencil className="size-4" />
                          {t("editExercise")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeExercise(exercise.id)}
                          disabled={pending}
                          data-testid="delete-exercise"
                        >
                          <Trash2 className="size-4" />
                          {t("deleteExercise")}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}

              {addingTo === workout.id && exerciseDraft ? (
                <li className="rounded-md border border-dashed p-3">
                  <ExerciseFields
                    draft={exerciseDraft}
                    onChange={setExerciseDraft}
                    onSave={() => saveNewExercise(workout.id)}
                    onCancel={() => {
                      setAddingTo(null)
                      setExerciseDraft(null)
                    }}
                    pending={pending}
                    t={t}
                  />
                </li>
              ) : (
                <li>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => startAddExercise(workout.id)}
                    disabled={pending}
                    data-testid="add-exercise"
                  >
                    <Plus className="size-4" />
                    {t("addExercise")}
                  </Button>
                </li>
              )}
            </ol>
          </li>
        ))}
      </ol>
    </CollapsibleSection>
  )
}

/**
 * Shared exercise field set used for both editing an existing exercise and
 * adding a new one. Controlled entirely by its parent through `draft`/`onChange`
 * so the editor owns the single source of truth.
 */
function ExerciseFields({
  draft,
  onChange,
  onSave,
  onCancel,
  pending,
  t,
}: {
  draft: ExerciseDraft
  onChange: (next: ExerciseDraft) => void
  onSave: () => void
  onCancel: () => void
  pending: boolean
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <Label>{t("fields.name")}</Label>
        <Input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label>{t("fields.sets")}</Label>
          <Input
            inputMode="numeric"
            value={draft.sets}
            onChange={(e) => onChange({ ...draft, sets: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("fields.reps")}</Label>
          <Input
            value={draft.reps}
            onChange={(e) => onChange({ ...draft, reps: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("fields.duration")}</Label>
          <Input
            value={draft.duration}
            onChange={(e) => onChange({ ...draft, duration: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("fields.rest")}</Label>
          <Input
            value={draft.rest}
            onChange={(e) => onChange({ ...draft, rest: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("fields.instructions")}</Label>
        <Textarea
          rows={2}
          value={draft.instructions}
          onChange={(e) => onChange({ ...draft, instructions: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("fields.safetyNotes")}</Label>
        <Textarea
          rows={2}
          value={draft.safetyNotes}
          onChange={(e) => onChange({ ...draft, safetyNotes: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={pending}
          data-testid="save-exercise"
        >
          <Save className="size-4" />
          {t("save")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
        >
          <X className="size-4" />
          {t("cancel")}
        </Button>
      </div>
    </div>
  )
}
