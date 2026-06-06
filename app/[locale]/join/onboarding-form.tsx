"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { CheckCircle2, Info, TriangleAlert } from "lucide-react"

import { useRouter } from "@/i18n/navigation"
import { saveOnboarding } from "@/lib/onboarding/onboarding-actions"
import {
  AGE_RANGES,
  EQUIPMENT,
  FITNESS_LEVELS,
  GOALS,
  LOCATIONS,
  WORKOUT_DAYS,
} from "@/lib/validation/onboarding"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"

/** Initial values used to prefill the form when a client re-onboards. */
export interface OnboardingDefaults {
  fullName: string
  phone: string
  age: string
  ageRange: string
  goals: string[]
  fitnessLevel: string
  limitations: string
  availableDays: string[]
  preferredLocation: string
  equipment: string[]
  notes: string
}

/** The empty default state for a first-time onboarding. */
export const EMPTY_DEFAULTS: OnboardingDefaults = {
  fullName: "",
  phone: "",
  age: "",
  ageRange: "",
  goals: [],
  fitnessLevel: "",
  limitations: "",
  availableDays: [],
  preferredLocation: "",
  equipment: [],
  notes: "",
}

const STEP_COUNT = 3

/**
 * The key type accepted by the `Onboarding` translator. Used to cast keys that
 * are composed at runtime (error codes, step indices) and so cannot be checked
 * statically against the message catalog.
 */
type MessageKey = Parameters<ReturnType<typeof useTranslations<"Onboarding">>>[0]

/** Toggles `value` in `list`, preserving the canonical vocabulary order. */
function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
}

/**
 * Multi-step, fully localized client onboarding form. State is held in React
 * (not the DOM) because the multi-select controls are Base UI primitives, not
 * native inputs; on submit the collected answers are sent as a plain object to
 * the {@link saveOnboarding} server action, which is the single source of
 * validation truth. Client-side checks here only gate step progression for UX;
 * the server re-validates everything.
 *
 * Field labels, option labels, helper text, and error/success copy all come
 * from the `Onboarding` message namespace, so the form is identical in English
 * and Hebrew (and renders RTL under the `he` locale via the document `dir`).
 *
 * @param defaults - Prefill values; pass {@link EMPTY_DEFAULTS} for a new client.
 */
export function OnboardingForm({
  defaults,
}: {
  defaults: OnboardingDefaults
}) {
  const t = useTranslations("Onboarding")
  const locale = useLocale()
  const router = useRouter()

  const [step, setStep] = React.useState(0)
  const [values, setValues] = React.useState<OnboardingDefaults>(defaults)
  const [pending, setPending] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [planGenerated, setPlanGenerated] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string>
  >({})

  function set<K extends keyof OnboardingDefaults>(
    key: K,
    value: OnboardingDefaults[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  /** Resolves a field's error code to localized text, if any. */
  function fieldError(name: string): string | null {
    const code = fieldErrors[name]
    // The error key is composed at runtime from the field name and the
    // validator's code, so it cannot be one of next-intl's statically-typed
    // keys. Cast to the translator's key type; a missing key surfaces loudly at
    // runtime (next-intl renders the key path), and the unit tests cover the
    // codes the validator can emit.
    return code ? t(`errors.${name}.${code}` as MessageKey) : null
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setFieldErrors({})

    const result = await saveOnboarding(
      {
        fullName: values.fullName,
        phone: values.phone,
        age: values.age,
        ageRange: values.ageRange,
        goals: values.goals,
        fitnessLevel: values.fitnessLevel,
        limitations: values.limitations,
        availableDays: values.availableDays,
        preferredLocation: values.preferredLocation,
        equipment: values.equipment,
        notes: values.notes,
      },
      // Locale tells the server which language to generate the plan in.
      locale
    )

    setPending(false)

    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {})
      setError(
        result.error === "signedOut"
          ? t("errors.signedOut")
          : result.error === "saveFailed"
            ? t("errors.saveFailed")
            : t("errors.summary")
      )
      // Jump back to the first step that has an error so the user can fix it.
      const firstBadStep = stepOfFirstError(result.fieldErrors ?? {})
      if (firstBadStep !== null) setStep(firstBadStep)
      return
    }

    setPlanGenerated(result.data.planGenerated)
    setDone(true)
  }

  // When the AI plan was generated, route the client straight to their plan
  // instead of waiting for a manual "View Plan" click. The pending branch
  // (no plan) keeps its existing button and is not auto-redirected.
  React.useEffect(() => {
    if (done && planGenerated) {
      router.push("/my-plan")
    }
  }, [done, planGenerated, router])

  if (done) {
    // The profile is always saved here; the variant depends on whether the AI
    // plan was generated. Both states are localized and reassure the client.
    return (
      <div
        className="flex flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center"
        role="status"
      >
        {planGenerated ? (
          <>
            <CheckCircle2
              className="size-10 text-primary"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold">{t("success.title")}</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("success.planReady")}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("success.redirecting")}
            </p>
          </>
        ) : (
          <>
            <TriangleAlert
              className="size-10 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold">{t("success.title")}</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("success.planPending")}
            </p>
            <Button onClick={() => router.push("/profile")}>
              {t("success.cta")}
            </Button>
          </>
        )}
      </div>
    )
  }

  const isLastStep = step === STEP_COUNT - 1

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t(`steps.${step}.title` as MessageKey)}</span>
          <span>
            {t("progress", { current: step + 1, total: STEP_COUNT })}
          </span>
        </div>
        <Progress value={((step + 1) / STEP_COUNT) * 100} />
      </div>

      {step === 0 ? (
        <StepAboutYou
          t={t}
          values={values}
          set={set}
          fieldError={fieldError}
        />
      ) : null}
      {step === 1 ? (
        <StepTraining
          t={t}
          values={values}
          set={set}
          fieldError={fieldError}
        />
      ) : null}
      {step === 2 ? (
        <StepSchedule
          t={t}
          values={values}
          set={set}
          fieldError={fieldError}
        />
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
        >
          {t("nav.back")}
        </Button>

        {isLastStep ? (
          <Button type="submit" disabled={pending}>
            {pending ? t("nav.generating") : t("submit")}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => setStep((s) => Math.min(STEP_COUNT - 1, s + 1))}
            disabled={pending}
          >
            {t("nav.next")}
          </Button>
        )}
      </div>
    </form>
  )
}

type StepProps = {
  t: ReturnType<typeof useTranslations<"Onboarding">>
  values: OnboardingDefaults
  set: <K extends keyof OnboardingDefaults>(
    key: K,
    value: OnboardingDefaults[K]
  ) => void
  fieldError: (name: string) => string | null
}

/** Step 1: identity and age. */
function StepAboutYou({ t, values, set, fieldError }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <Field label={t("fields.fullName")} error={fieldError("fullName")}>
        <Input
          name="fullName"
          value={values.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          required
          minLength={2}
          autoComplete="name"
        />
      </Field>

      <Field
        label={t("fields.phone")}
        hint={t("hints.phone")}
        error={fieldError("phone")}
      >
        <Input
          name="phone"
          type="tel"
          inputMode="tel"
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
          autoComplete="tel"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("fields.age")}
          hint={t("hints.age")}
          error={fieldError("age")}
        >
          <Input
            name="age"
            type="number"
            inputMode="numeric"
            min={13}
            max={100}
            value={values.age}
            onChange={(e) => set("age", e.target.value)}
          />
        </Field>

        <Field label={t("fields.ageRange")} error={fieldError("ageRange")}>
          <NativeSelect
            className="w-full"
            name="ageRange"
            value={values.ageRange}
            onChange={(e) => set("ageRange", e.target.value)}
          >
            <NativeSelectOption value="">
              {t("options.unselected")}
            </NativeSelectOption>
            {AGE_RANGES.map((r) => (
              <NativeSelectOption key={r} value={r}>
                {t(`options.ageRange.${r}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </div>
  )
}

/** Step 2: goal, level, location. */
function StepTraining({ t, values, set, fieldError }: StepProps) {
  const goalError = fieldError("goals")
  return (
    <div className="flex flex-col gap-5">
      <Field
        label={t("fields.goal")}
        error={goalError}
        labelAdornment={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={t("hints.goal")}
                    className="inline-flex text-muted-foreground"
                  />
                }
              >
                <Info className="size-4" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{t("hints.goal")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      >
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
                aria-invalid={goalError ? true : undefined}
              />
            }
          >
            <span
              className={
                values.goals.length === 0 ? "text-muted-foreground" : undefined
              }
            >
              {values.goals.length === 0
                ? t("options.unselected")
                : values.goals
                    .map((g) => t(`options.goal.${g}` as MessageKey))
                    .join(", ")}
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--anchor-width)">
            <div className="flex flex-col gap-2">
              {GOALS.map((g) => (
                <CheckboxRow
                  key={g}
                  label={t(`options.goal.${g}`)}
                  checked={values.goals.includes(g)}
                  onToggle={() => set("goals", toggle(values.goals, g))}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </Field>

      <Field
        label={t("fields.fitnessLevel")}
        error={fieldError("fitnessLevel")}
      >
        <NativeSelect
          className="w-full"
          name="fitnessLevel"
          value={values.fitnessLevel}
          onChange={(e) => set("fitnessLevel", e.target.value)}
        >
          <NativeSelectOption value="">
            {t("options.unselected")}
          </NativeSelectOption>
          {FITNESS_LEVELS.map((l) => (
            <NativeSelectOption key={l} value={l}>
              {t(`options.fitnessLevel.${l}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field
        label={t("fields.preferredLocation")}
        error={fieldError("preferredLocation")}
      >
        <NativeSelect
          className="w-full"
          name="preferredLocation"
          value={values.preferredLocation}
          onChange={(e) => set("preferredLocation", e.target.value)}
        >
          <NativeSelectOption value="">
            {t("options.unselected")}
          </NativeSelectOption>
          {LOCATIONS.map((loc) => (
            <NativeSelectOption key={loc} value={loc}>
              {t(`options.location.${loc}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </div>
  )
}

/** Step 3: schedule, equipment, free-text. */
function StepSchedule({ t, values, set, fieldError }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">
          {t("fields.availableDays")}
        </legend>
        <p className="text-sm text-muted-foreground">{t("hints.days")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORKOUT_DAYS.map((day) => (
            <CheckboxRow
              key={day}
              label={t(`options.day.${day}`)}
              checked={values.availableDays.includes(day)}
              onToggle={() =>
                set("availableDays", toggle(values.availableDays, day))
              }
            />
          ))}
        </div>
        {fieldError("availableDays") ? (
          <p className="text-sm text-destructive" role="alert">
            {fieldError("availableDays")}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">
          {t("fields.equipment")}
        </legend>
        <p className="text-sm text-muted-foreground">{t("hints.equipment")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EQUIPMENT.map((item) => (
            <CheckboxRow
              key={item}
              label={t(`options.equipment.${item}`)}
              checked={values.equipment.includes(item)}
              onToggle={() => set("equipment", toggle(values.equipment, item))}
            />
          ))}
        </div>
        {fieldError("equipment") ? (
          <p className="text-sm text-destructive" role="alert">
            {fieldError("equipment")}
          </p>
        ) : null}
      </fieldset>

      <Field
        label={t("fields.limitations")}
        hint={t("hints.limitations")}
        error={fieldError("limitations")}
      >
        <Textarea
          name="limitations"
          value={values.limitations}
          onChange={(e) => set("limitations", e.target.value)}
          rows={3}
        />
      </Field>

      <Field
        label={t("fields.notes")}
        hint={t("hints.notes")}
        error={fieldError("notes")}
      >
        <Textarea
          name="notes"
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
        />
      </Field>
    </div>
  )
}

/** A labelled form row with optional hint and error message. */
function Field({
  label,
  hint,
  error,
  labelAdornment,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  labelAdornment?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {labelAdornment}
      </div>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** A single labelled checkbox in a multi-select group. */
function CheckboxRow({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      {label}
    </Label>
  )
}

/**
 * Maps the first field error to the wizard step that owns it, so a failed
 * server validation returns the user to the right step. Step ownership mirrors
 * the field groupings in the three sub-step components above.
 */
function stepOfFirstError(
  fieldErrors: Record<string, string>
): number | null {
  const stepByField: Record<string, number> = {
    fullName: 0,
    phone: 0,
    age: 0,
    ageRange: 0,
    goals: 1,
    fitnessLevel: 1,
    preferredLocation: 1,
    availableDays: 2,
    equipment: 2,
    limitations: 2,
    notes: 2,
  }
  for (const key of Object.keys(fieldErrors)) {
    if (key in stepByField) return stepByField[key]
  }
  return null
}
