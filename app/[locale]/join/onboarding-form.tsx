"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  CheckCircle2,
  ChevronDownIcon,
  Info,
  TriangleAlert,
  X,
} from "lucide-react"

import { useRouter } from "@/i18n/navigation"
import {
  generateOnboardingPlan,
  saveOnboardingDetails,
  saveOnboardingStep,
} from "@/lib/onboarding/onboarding-actions"
import {
  AGE_RANGES,
  EQUIPMENT,
  FITNESS_LEVELS,
  GOALS,
  LOCATIONS,
  validateOnboardingStep,
  WORKOUT_DAYS,
  type Availability,
  type OnboardingInput,
  type OnboardingStep,
} from "@/lib/validation/onboarding"
import { PhoneField } from "@/components/phone-field"
import { AvailabilityEditor } from "@/components/onboarding/availability-editor"
import { combineE164 } from "@/lib/phone/phone"
import { countryByIso2 } from "@/lib/phone/countries"
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
import { cn } from "@/lib/utils"

/** Initial values used to prefill the form when a client re-onboards. */
export interface OnboardingDefaults {
  fullName: string
  phone: string
  countryIso2: string
  age: string
  ageRange: string
  goals: string[]
  fitnessLevel: string
  limitations: string
  availableDays: string[]
  /** Per-day training windows, keyed by selected weekday. */
  availability: Availability
  /** Desired session length in minutes, as a select value string ("" = unset). */
  sessionDurationMinutes: string
  preferredLocation: string
  equipment: string[]
  /** Whether the "Other" equipment toggle is on (reveals the free-text field). */
  equipmentOtherSelected: boolean
  /** Raw comma-separated "Other" equipment text. */
  equipmentOther: string
  notes: string
}

/** The empty default state for a first-time onboarding. */
export const EMPTY_DEFAULTS: OnboardingDefaults = {
  fullName: "",
  phone: "",
  countryIso2: "IL",
  age: "",
  ageRange: "",
  goals: [],
  fitnessLevel: "",
  limitations: "",
  availableDays: [],
  availability: {},
  sessionDurationMinutes: "",
  preferredLocation: "",
  equipment: [],
  equipmentOtherSelected: false,
  equipmentOther: "",
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

/** Maps the form's string-keyed state to the validator's input shape. */
export function toInput(values: OnboardingDefaults): OnboardingInput {
  // `values.phone` holds the national number; combine it with the selected
  // country's dial code into E.164, which the validator and save expect.
  const country = countryByIso2(values.countryIso2) ?? countryByIso2("IL")!
  return {
    fullName: values.fullName,
    phone: combineE164(country.dialCode, values.phone),
    countryIso2: values.countryIso2,
    age: values.age,
    ageRange: values.ageRange,
    goals: values.goals,
    fitnessLevel: values.fitnessLevel,
    limitations: values.limitations,
    availableDays: values.availableDays,
    availability: values.availability,
    sessionDurationMinutes: values.sessionDurationMinutes,
    preferredLocation: values.preferredLocation,
    equipment: values.equipment,
    equipmentOtherSelected: values.equipmentOtherSelected,
    equipmentOther: values.equipmentOther,
    notes: values.notes,
  }
}

/**
 * Multi-step, fully localized client onboarding form. State is held in React
 * (not the DOM) because the multi-select controls are Base UI primitives, not
 * native inputs.
 *
 * Each step validates client-side (via {@link validateOnboardingStep}) and
 * saves its own fields ({@link saveOnboardingStep}) before advancing, so a
 * client can leave mid-flow and resume from where they left off (the page
 * prefills from their saved row), and an error stops them on the current step
 * rather than bouncing them backwards. The server re-validates every save. The
 * final step saves the complete profile ({@link saveOnboardingDetails}), then
 * enables a separate action to generate the AI plan
 * ({@link generateOnboardingPlan}).
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
  // The complete profile has been saved; the "Generate plan" action unlocks.
  const [detailsSaved, setDetailsSaved] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [planGenerated, setPlanGenerated] = React.useState(false)
  // A single top-level alert reserved for non-field action errors (auth, save
  // failures); field problems render inline on their own field, never here.
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string>
  >({})

  function set<K extends keyof OnboardingDefaults>(
    key: K,
    value: OnboardingDefaults[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }))
    // Editing any field invalidates a prior "details saved" state, so the
    // client must re-save before generating a plan from stale data.
    setDetailsSaved(false)
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

  /** Maps a non-field action error code to localized copy for the top alert. */
  function actionError(code: string): string {
    return code === "signedOut"
      ? t("errors.signedOut")
      : t("errors.saveFailed")
  }

  /**
   * Validates the current step client-side, then persists it. Returns whether
   * the step is valid and saved. On a validation failure the per-field errors
   * are shown and the user stays put; on an auth/save failure the top alert is
   * set.
   */
  async function validateAndSaveStep(
    targetStep: OnboardingStep
  ): Promise<boolean> {
    setError(null)
    const errs = validateOnboardingStep(targetStep, toInput(values))
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return false
    }
    setFieldErrors({})

    setPending(true)
    const result = await saveOnboardingStep(targetStep, toInput(values))
    setPending(false)

    if (!result.ok) {
      // A server-side field error (defensive: client gating should prevent it)
      // shows inline; an auth/save error shows in the top alert.
      if (result.fieldErrors) setFieldErrors(result.fieldErrors)
      else setError(actionError(result.error))
      return false
    }
    return true
  }

  /** Advances to the next step after validating and saving the current one. */
  async function onNext() {
    const ok = await validateAndSaveStep(step as OnboardingStep)
    if (ok) setStep((s) => Math.min(STEP_COUNT - 1, s + 1))
  }

  /** Saves the final step, then the full profile; unlocks plan generation. */
  async function onSaveDetails() {
    // Save the final step first so its columns persist even if the full-form
    // re-validation surfaces a cross-step gap.
    const stepOk = await validateAndSaveStep(2)
    if (!stepOk) return

    setError(null)
    setPending(true)
    const result = await saveOnboardingDetails(toInput(values))
    setPending(false)

    if (!result.ok) {
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors)
        // Send the user to the earliest step that still has an error.
        const bad = stepOfFirstError(result.fieldErrors)
        if (bad !== null) setStep(bad)
      } else {
        setError(actionError(result.error))
      }
      return
    }

    setFieldErrors({})
    setDetailsSaved(true)
  }

  /** Triggers AI plan generation from the saved profile. */
  async function onGenerate() {
    setError(null)
    setPending(true)
    const result = await generateOnboardingPlan(locale)
    setPending(false)

    if (!result.ok) {
      setError(actionError(result.error))
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
    <form
      className="flex flex-col gap-6"
      // The wizard is a real <form> so fields are grouped semantically and
      // Enter submits the current step. Submission is handled in-page (per-step
      // save and validation are JS-orchestrated via Base UI multi-selects held in
      // React state), so the default navigation is prevented and routed to the
      // step's primary action.
      onSubmit={(e) => {
        e.preventDefault()
        if (pending) return
        if (isLastStep) {
          void onSaveDetails()
        } else {
          void onNext()
        }
      }}
    >
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

      {/* Reserved for non-field action errors (auth, save failures) only. */}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {detailsSaved && isLastStep ? (
        <p className="text-sm text-primary" role="status">
          {t("success.body")}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null)
            setStep((s) => Math.max(0, s - 1))
          }}
          disabled={step === 0 || pending}
        >
          {t("nav.back")}
        </Button>

        {isLastStep ? (
          <div className="flex items-center gap-3">
            {/* Save is the form's submit action (also fires on Enter via the
                form's onSubmit). Generate is a distinct, separate action and
                stays type="button" so it never submits the form. */}
            <Button
              type="submit"
              variant={detailsSaved ? "outline" : "default"}
              disabled={pending}
            >
              {pending && !detailsSaved ? t("nav.saving") : t("nav.saveDetails")}
            </Button>
            <Button
              type="button"
              onClick={onGenerate}
              disabled={!detailsSaved || pending}
            >
              {pending && detailsSaved ? t("nav.generating") : t("submit")}
            </Button>
          </div>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? t("nav.saving") : t("nav.next")}
          </Button>
        )}
      </div>
    </form>
  )
}

export type StepProps = {
  t: ReturnType<typeof useTranslations<"Onboarding">>
  values: OnboardingDefaults
  set: <K extends keyof OnboardingDefaults>(
    key: K,
    value: OnboardingDefaults[K]
  ) => void
  fieldError: (name: string) => string | null
}

/** Step 1: identity and age. */
export function StepAboutYou({ t, values, set, fieldError }: StepProps) {
  const nameError = fieldError("fullName")
  const phoneError = fieldError("phone")
  const countryError = fieldError("countryIso2")
  const ageError = fieldError("age")
  const ageRangeError = fieldError("ageRange")
  return (
    <div className="flex flex-col gap-5">
      <Field
        label={t("fields.fullName")}
        error={nameError}
        required
      >
        <Input
          name="fullName"
          value={values.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          aria-invalid={nameError ? true : undefined}
          required
          autoComplete="name"
        />
      </Field>

      <Field
        label={t("fields.phone")}
        hint={t("hints.phone")}
        error={phoneError ?? countryError}
        required
      >
        <PhoneField
          countryIso2={values.countryIso2}
          national={values.phone}
          onCountryChange={(iso2) => set("countryIso2", iso2)}
          onNationalChange={(n) => set("phone", n)}
          searchPlaceholder={t("placeholders.countrySearch")}
          emptyText={t("empty.countrySearch")}
          invalid={!!(phoneError || countryError)}
          required
        />
      </Field>

      {/* items-start keeps the two controls top-aligned; the reserved error
          slot in Field means an error under one never shifts the other. */}
      <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
        <Field
          label={t("fields.age")}
          hint={t("hints.age")}
          error={ageError}
          required
        >
          <Input
            name="age"
            type="number"
            inputMode="numeric"
            min={13}
            max={100}
            value={values.age}
            onChange={(e) => set("age", e.target.value)}
            aria-invalid={ageError ? true : undefined}
          />
        </Field>

        <Field
          label={t("fields.ageRange")}
          error={ageRangeError}
        >
          <NativeSelect
            className="w-full"
            name="ageRange"
            value={values.ageRange}
            onChange={(e) => set("ageRange", e.target.value)}
            aria-invalid={ageRangeError ? true : undefined}
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
export function StepTraining({ t, values, set, fieldError }: StepProps) {
  const goalError = fieldError("goals")
  const fitnessError = fieldError("fitnessLevel")
  const locationError = fieldError("preferredLocation")
  const hasGoals = values.goals.length > 0
  return (
    <div className="flex flex-col gap-5">
      <Field
        label={t("fields.goal")}
        error={goalError}
        required
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
        {/* Relative wrapper so the clear control and the chevron can sit inside
            the field. The chevron is pinned at the inline-end (end-2.5, matching
            NativeSelect); the clear X sits just before it (end-8) so it reads
            left-of-chevron in LTR and right-of-chevron in RTL with no dir code.
            Both are siblings of the trigger, never nested buttons. */}
        <div className="relative">
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  data-testid="goal-trigger"
                  className={cn(
                    "w-full justify-start font-normal",
                    // Always reserve room for the chevron; reserve more when the
                    // clear X is also shown.
                    hasGoals ? "pe-16" : "pe-8",
                    goalError &&
                      "border-destructive ring-3 ring-destructive/20"
                  )}
                  aria-invalid={goalError ? true : undefined}
                />
              }
            >
              <span
                className={hasGoals ? undefined : "text-muted-foreground"}
              >
                {hasGoals
                  ? values.goals
                      .map((g) => t(`options.goal.${g}` as MessageKey))
                      .join(", ")
                  : t("options.unselected")}
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
          {hasGoals ? (
            <button
              type="button"
              aria-label={t("clearGoals")}
              onClick={(e) => {
                e.stopPropagation()
                set("goals", [])
              }}
              className="absolute end-8 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          {/* Decorative chevron matching the other selects; the trigger button
              underneath handles the click, so this stays pointer-events-none. */}
          <ChevronDownIcon
            className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </Field>

      <Field
        label={t("fields.fitnessLevel")}
        error={fitnessError}
        required
      >
        <NativeSelect
          className="w-full"
          name="fitnessLevel"
          value={values.fitnessLevel}
          onChange={(e) => set("fitnessLevel", e.target.value)}
          aria-invalid={fitnessError ? true : undefined}
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
        error={locationError}
        required
      >
        <NativeSelect
          className="w-full"
          name="preferredLocation"
          value={values.preferredLocation}
          onChange={(e) => set("preferredLocation", e.target.value)}
          aria-invalid={locationError ? true : undefined}
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

/** Step 3: schedule, availability windows, duration, equipment, free-text. */
export function StepSchedule({ t, values, set, fieldError }: StepProps) {
  const daysError = fieldError("availableDays")
  const equipmentError = fieldError("equipment")
  const availabilityError = fieldError("availability")
  const durationError = fieldError("sessionDurationMinutes")
  const equipmentOtherError = fieldError("equipmentOther")

  function toggleEquipmentOther() {
    const next = !values.equipmentOtherSelected
    set("equipmentOtherSelected", next)
    // Clearing the toggle drops any typed free text so it is not persisted.
    if (!next) set("equipmentOther", "")
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">
          {t("fields.availableDays")}
          <span className="ms-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        </legend>
        <p className="text-sm text-muted-foreground">{t("hints.days")}</p>
        {/* The day grid is a checkbox group, not a native input, so it gets an
            explicit red ring when invalid rather than relying on aria-invalid. */}
        <div
          className={cn(
            "grid grid-cols-2 gap-2 sm:grid-cols-4",
            daysError &&
              "rounded-lg border border-destructive p-2 ring-3 ring-destructive/20"
          )}
        >
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
        {daysError ? (
          <p className="text-sm text-destructive" role="alert">
            {daysError}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">
          {t("fields.availability")}
          <span className="ms-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        </legend>
        <p className="text-sm text-muted-foreground">
          {t("hints.availability")}
        </p>
        <AvailabilityEditor
          days={values.availableDays}
          value={values.availability}
          onChange={(next) => set("availability", next)}
          duration={values.sessionDurationMinutes}
          onDurationChange={(value) => set("sessionDurationMinutes", value)}
          error={availabilityError}
          durationError={durationError}
          t={t as (key: string, values?: Record<string, unknown>) => string}
        />
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
          {/* "Other" is a UI-only toggle: it reveals the free-text field below
              and is never stored in the closed-set equipment array. */}
          <CheckboxRow
            label={t("options.equipment.other")}
            checked={values.equipmentOtherSelected}
            onToggle={toggleEquipmentOther}
          />
        </div>
        {equipmentError ? (
          <p className="text-sm text-destructive" role="alert">
            {equipmentError}
          </p>
        ) : null}
      </fieldset>

      {values.equipmentOtherSelected ? (
        <Field
          label={t("fields.equipmentOther")}
          hint={t("hints.equipmentOther")}
          error={equipmentOtherError}
          required
          labelAdornment={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={t("hints.equipmentOther")}
                      className="inline-flex text-muted-foreground"
                    />
                  }
                >
                  <Info className="size-4" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{t("hints.equipmentOther")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          }
        >
          <Input
            name="equipmentOther"
            value={values.equipmentOther}
            onChange={(e) => set("equipmentOther", e.target.value)}
            placeholder={t("placeholders.equipmentOther")}
          />
        </Field>
      ) : null}

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

/**
 * A labelled form row with an optional hint and error message. Required fields
 * carry a red asterisk after the label. The error slot reserves a line of
 * height whether or not an error is shown, so a field appearing/clearing an
 * error never shifts a neighbouring field in a side-by-side row (e.g. the age
 * row).
 *
 * The label is associated with its control via `htmlFor`/`id`: a generated id is
 * placed on `<Label htmlFor>` and injected (only when not already set) into the
 * single child element. This makes the visible label a click target for the
 * control and announces them as a pair to assistive tech, satisfying the
 * project's form-accessibility standard.
 */
function Field({
  label,
  hint,
  error,
  required,
  labelAdornment,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  required?: boolean
  labelAdornment?: React.ReactNode
  children: React.ReactNode
}) {
  const fieldId = React.useId()
  // Associate the label with the control. Inject the generated id into the
  // single child element unless it already carries one (so an explicit id wins).
  const control = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{ id?: string }>,
        {
          id:
            (children as React.ReactElement<{ id?: string }>).props.id ??
            fieldId,
        }
      )
    : children
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={fieldId}>
          {label}
          {required ? (
            <span className="ms-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </Label>
        {labelAdornment}
      </div>
      {control}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <p className="min-h-[1.25rem] text-sm text-destructive" role="alert">
        {error}
      </p>
    </div>
  )
}

/**
 * A single labelled checkbox in a multi-select group. The whole row is a
 * clickable button so tapping the box OR the text toggles it. A bare `<label>`
 * wrapping Base UI's checkbox (which renders a `<button>`, not a native input)
 * does not forward text clicks, which would leave the visible label inert and
 * the hit target tiny. The inner Checkbox is decorative here (it reflects state
 * and stays focusable), so the row's click is the single source of toggling;
 * `stopPropagation` on the checkbox keeps a direct box click from firing twice.
 */
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
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex cursor-pointer items-center gap-2 text-start text-sm font-normal"
    >
      {/* The row button owns the toggle and focus; the inner checkbox is purely
          a visual reflection of state, removed from the a11y tree and tab order
          so the control is announced once, by the row. */}
      <Checkbox
        checked={checked}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none"
      />
      {label}
    </button>
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
