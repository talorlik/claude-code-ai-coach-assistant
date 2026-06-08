"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import {
  EMPTY_DEFAULTS,
  StepAboutYou,
  StepSchedule,
  StepTraining,
  toInput,
  type OnboardingDefaults,
} from "@/app/[locale]/join/onboarding-form"
import { validateOnboarding } from "@/lib/validation/onboarding"
import type { OnboardingInput } from "@/lib/validation/onboarding"
import type { ActionResult } from "@/lib/types/action-result"
import type { Client } from "@/lib/db/mappers"
import { splitE164 } from "@/lib/phone/phone"
import { Button } from "@/components/ui/button"

/**
 * Maps a persisted {@link Client} to the form's string-keyed defaults. Shared by
 * the onboarding wizard page, My Account, and the trainer client editor so the
 * client -> form mapping lives in one place. The national phone number and
 * country are split back out of the stored E.164 value, and the "Other"
 * equipment list is re-joined into the comma-separated free-text field.
 */
export function clientToDefaults(client: Client): OnboardingDefaults {
  const split = splitE164(client.phone ?? "", client.countryIso2 ?? null)
  return {
    fullName: client.fullName ?? "",
    phone: split.national,
    countryIso2: split.country.iso2,
    age: client.age != null ? String(client.age) : "",
    ageRange: client.ageRange ?? "",
    goals: client.goals,
    fitnessLevel: client.fitnessLevel ?? "",
    limitations: client.limitations ?? "",
    availableDays: client.availableDays,
    availability: client.availability,
    sessionDurationMinutes:
      client.sessionDurationMinutes != null
        ? String(client.sessionDurationMinutes)
        : "",
    preferredLocation: client.preferredLocation ?? "",
    equipment: client.equipment,
    equipmentOtherSelected: client.equipmentOther.length > 0,
    equipmentOther: client.equipmentOther.join(", "),
    notes: client.notes ?? "",
  }
}

/**
 * The translator key type for the `Onboarding` namespace; runtime-composed error
 * keys are cast to it (a missing key surfaces loudly via next-intl at render).
 */
type MessageKey = Parameters<ReturnType<typeof useTranslations<"Onboarding">>>[0]

/**
 * A single-page editable onboarding form, reusing the wizard's three step
 * bodies ({@link StepAboutYou}/{@link StepTraining}/{@link StepSchedule}) laid
 * out together rather than as a stepper. Used by My Account (self-edit) and the
 * trainer client editor (admin edit of any client): both pass an `onSave` action
 * and the client's current values as defaults.
 *
 * It owns form state and client-side validation (via the shared
 * {@link validateOnboarding}), surfaces per-field errors inline through the
 * reused steps, and renders a save button plus an optional "Regenerate plan"
 * slot. Saving does not regenerate - regeneration is an explicit, separate
 * action passed via {@link regenerateSlot}.
 *
 * @param defaults - The client's current onboarding values to prefill.
 * @param onSave - Server action persisting the validated input; returns an
 *   ActionResult whose field errors (if any) are shown inline.
 * @param regenerateSlot - Optional node rendered beside Save (the explicit
 *   regenerate control); kept as a slot so the form stays agnostic of who saves.
 */
export function OnboardingDetailsForm({
  defaults,
  onSave,
  regenerateSlot,
}: {
  defaults: OnboardingDefaults
  onSave: (input: OnboardingInput) => Promise<ActionResult<unknown>>
  regenerateSlot?: React.ReactNode
}) {
  const t = useTranslations("Onboarding")
  const tAccount = useTranslations("AccountOnboarding")

  const [values, setValues] = React.useState<OnboardingDefaults>(defaults)
  const [pending, setPending] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  )

  function set<K extends keyof OnboardingDefaults>(
    key: K,
    value: OnboardingDefaults[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function fieldError(name: string): string | null {
    const code = fieldErrors[name]
    return code ? t(`errors.${name}.${code}` as MessageKey) : null
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    // Client-side validation mirrors the server's, so the user sees inline
    // errors without a round trip; the server re-validates regardless.
    const input = toInput(values)
    const validation = validateOnboarding(input)
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors ?? {})
      return
    }
    setFieldErrors({})

    setPending(true)
    const result = await onSave(input)
    setPending(false)

    if (!result.ok) {
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors)
      } else {
        setError(tAccount("saveFailed"))
      }
      return
    }
    setSaved(true)
  }

  const stepProps = { t, values, set, fieldError }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <StepAboutYou {...stepProps} />
      <StepTraining {...stepProps} />
      <StepSchedule {...stepProps} />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-green-600" role="status">
          {tAccount("detailsSaved")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tAccount("saving") : tAccount("saveDetails")}
        </Button>
        {regenerateSlot}
      </div>
    </form>
  )
}

export { EMPTY_DEFAULTS }
export type { OnboardingDefaults }
