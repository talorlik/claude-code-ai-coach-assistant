"use client"

import { useRouter } from "@/i18n/navigation"

import {
  OnboardingDetailsForm,
  type OnboardingDefaults,
} from "@/components/onboarding/onboarding-details-form"
import { RegenerateClientPlan } from "./regenerate-client-plan"
import { saveClientOnboardingAction } from "@/lib/trainer/client-onboarding-actions"
import type { OnboardingInput } from "@/lib/validation/onboarding"
import type { ActionResult } from "@/lib/types/action-result"

/**
 * Trainer-side editor for a client's onboarding details, binding the admin-gated
 * {@link saveClientOnboardingAction} (scoped to this client) to the shared
 * {@link OnboardingDetailsForm}, with the existing {@link RegenerateClientPlan}
 * dialog as the explicit regenerate control. Refreshes the dashboard route on a
 * successful save so the read-only profile panel reflects the edit.
 *
 * @param clientId - The client whose details the trainer is editing.
 * @param defaults - The client's current onboarding values to prefill.
 */
export function ClientOnboardingEditor({
  clientId,
  defaults,
}: {
  clientId: string
  defaults: OnboardingDefaults
}) {
  const router = useRouter()

  async function onSave(
    input: OnboardingInput
  ): Promise<ActionResult<unknown>> {
    const result = await saveClientOnboardingAction(clientId, input)
    if (result.ok) router.refresh()
    return result
  }

  return (
    <OnboardingDetailsForm
      defaults={defaults}
      onSave={onSave}
      regenerateSlot={<RegenerateClientPlan clientId={clientId} />}
    />
  )
}
