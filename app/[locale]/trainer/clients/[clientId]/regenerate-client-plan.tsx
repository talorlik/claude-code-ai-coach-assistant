"use client"

import { useRouter } from "@/i18n/navigation"

import {
  RegeneratePlanDialog,
  type RegenerateSuccess,
} from "@/components/regenerate-plan-dialog"
import { regenerateClientPlanAction } from "@/lib/workouts/regeneration-actions"
import type { ActionResult } from "@/lib/types/action-result"

/**
 * Trainer-side regeneration entry point on the client dashboard. Binds the
 * {@link regenerateClientPlanAction} server action (admin-gated, regenerating
 * the given client's plan) to the shared {@link RegeneratePlanDialog} and
 * refreshes the route on success so the dashboard reflects the new plan.
 *
 * @param clientId - The client whose plan the trainer is regenerating.
 */
export function RegenerateClientPlan({ clientId }: { clientId: string }) {
  const router = useRouter()

  async function onRegenerate(
    reason: string
  ): Promise<ActionResult<RegenerateSuccess>> {
    return regenerateClientPlanAction(clientId, reason)
  }

  return (
    <RegeneratePlanDialog
      onRegenerate={onRegenerate}
      onSuccess={() => router.refresh()}
    />
  )
}
