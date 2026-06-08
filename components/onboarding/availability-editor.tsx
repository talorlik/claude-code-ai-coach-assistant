"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"

import {
  DURATION_STEP,
  MAX_DURATION,
  MAX_RANGES_PER_DAY,
  MIN_DURATION,
  type Availability,
  type TimeRange,
} from "@/lib/validation/onboarding"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { cn } from "@/lib/utils"

/**
 * The translator for the `Onboarding` namespace, accepted as a prop so the
 * editor stays a pure presentational component shared by the wizard, My
 * Account, and the trainer client editor without importing locale wiring.
 */
type Translator = (key: string, values?: Record<string, unknown>) => string

/** All 15-minute clock slots of a day as zero-padded `HH:MM` strings. */
const TIME_SLOTS: string[] = Array.from({ length: (24 * 60) / 15 }, (_, i) => {
  const minutes = i * 15
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0")
  const mm = String(minutes % 60).padStart(2, "0")
  return `${hh}:${mm}`
})

/** Allowed session-duration values, in {@link DURATION_STEP}-minute steps. */
const DURATION_OPTIONS: number[] = Array.from(
  { length: (MAX_DURATION - MIN_DURATION) / DURATION_STEP + 1 },
  (_, i) => MIN_DURATION + i * DURATION_STEP
)

/** A sensible first window seeded for a newly selected day. */
const DEFAULT_RANGE: TimeRange = { start: "06:00", end: "07:00" }

/**
 * Per-day availability editor plus the single shared session-duration control,
 * rendered under the day grid in onboarding step 3. For each selected training
 * day it shows one or more start-end windows (15-minute `NativeSelect`s, which
 * inherit the app's chevron and RTL handling); the client can add up to
 * {@link MAX_RANGES_PER_DAY} windows per day and remove any but the last. The
 * duration control lists {@link MIN_DURATION}-{@link MAX_DURATION} in
 * {@link DURATION_STEP} steps.
 *
 * The component is controlled: it never mutates state itself, only calling
 * `onChange`/`onDurationChange` with the next value. Validation (overlap,
 * start<end, completeness) lives in the onboarding validator; this editor keeps
 * the structure well-formed (a window per selected day, sorted slots) so the
 * common case is already valid.
 *
 * @param days - The selected training days (lowercase weekday keys).
 * @param value - Current per-day windows.
 * @param onChange - Receives the next {@link Availability} on any window edit.
 * @param duration - Current session-duration select value (`""` when unset).
 * @param onDurationChange - Receives the next duration select value.
 * @param error - Localized availability error, shown under the windows.
 * @param durationError - Localized duration error, shown under the control.
 * @param t - The `Onboarding` translator.
 */
export function AvailabilityEditor({
  days,
  value,
  onChange,
  duration,
  onDurationChange,
  error,
  durationError,
  t,
}: {
  days: string[]
  value: Availability
  onChange: (next: Availability) => void
  duration: string
  onDurationChange: (value: string) => void
  error?: string | null
  durationError?: string | null
  t: Translator
}) {
  // Keep the editor's windows in step with the selected days: seed a default
  // window for a newly checked day and drop windows for unchecked days. Done in
  // an effect so toggling a day in the grid immediately reflects here.
  React.useEffect(() => {
    const next: Availability = {}
    let changed = false
    for (const day of days) {
      if (value[day] && value[day].length > 0) {
        next[day] = value[day]
      } else {
        next[day] = [{ ...DEFAULT_RANGE }]
        changed = true
      }
    }
    // A day removed from the selection drops out of `next`; detect that too.
    if (Object.keys(next).length !== Object.keys(value).length) changed = true
    if (changed) onChange(next)
    // `value`/`onChange` are intentionally excluded: this reconciles only when
    // the selected-day set changes, not on every window edit (which would loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(",")])

  function setRange(day: string, index: number, patch: Partial<TimeRange>) {
    const ranges = (value[day] ?? []).map((r, i) =>
      i === index ? { ...r, ...patch } : r
    )
    onChange({ ...value, [day]: ranges })
  }

  function addRange(day: string) {
    const ranges = value[day] ?? []
    if (ranges.length >= MAX_RANGES_PER_DAY) return
    onChange({ ...value, [day]: [...ranges, { ...DEFAULT_RANGE }] })
  }

  function removeRange(day: string, index: number) {
    const ranges = value[day] ?? []
    if (ranges.length <= 1) return
    onChange({
      ...value,
      [day]: ranges.filter((_, i) => i !== index),
    })
  }

  if (days.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("hints.availability")}</p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "flex flex-col gap-4",
          error &&
            "rounded-lg border border-destructive p-3 ring-3 ring-destructive/20"
        )}
      >
        {days.map((day) => {
          const ranges = value[day] ?? []
          return (
            <div key={day} className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t(`options.day.${day}`)}</p>
              <div className="flex flex-col gap-2">
                {ranges.map((range, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2"
                    data-testid={`availability-row-${day}`}
                  >
                    <NativeSelect
                      aria-label={t("availability.start")}
                      className="w-32"
                      value={range.start}
                      onChange={(e) =>
                        setRange(day, index, { start: e.target.value })
                      }
                    >
                      {TIME_SLOTS.map((slot) => (
                        <NativeSelectOption key={slot} value={slot}>
                          {slot}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <span className="text-muted-foreground" aria-hidden="true">
                      –
                    </span>
                    <NativeSelect
                      aria-label={t("availability.end")}
                      className="w-32"
                      value={range.end}
                      onChange={(e) =>
                        setRange(day, index, { end: e.target.value })
                      }
                    >
                      {TIME_SLOTS.map((slot) => (
                        <NativeSelectOption key={slot} value={slot}>
                          {slot}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {ranges.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("availability.removeRange")}
                        onClick={() => removeRange(day, index)}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              {ranges.length < MAX_RANGES_PER_DAY ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => addRange(day)}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t("availability.addRange")}
                </Button>
              ) : null}
            </div>
          )
        })}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="sessionDuration">
          {t("fields.sessionDuration")}
          <span className="ms-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        </Label>
        <NativeSelect
          id="sessionDuration"
          className="w-40"
          value={duration}
          onChange={(e) => onDurationChange(e.target.value)}
          aria-invalid={durationError ? true : undefined}
        >
          <NativeSelectOption value="">
            {t("options.unselected")}
          </NativeSelectOption>
          {DURATION_OPTIONS.map((minutes) => (
            <NativeSelectOption key={minutes} value={String(minutes)}>
              {t("availability.minutes", { minutes })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {t("hints.sessionDuration")}
        </p>
        <p className="min-h-[1.25rem] text-sm text-destructive" role="alert">
          {durationError}
        </p>
      </div>
    </div>
  )
}
