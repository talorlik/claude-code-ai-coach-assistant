"use client"

import { useRouter } from "@/i18n/navigation"

import {
  RegeneratePlanDialog,
  type RegenerateSuccess,
} from "@/components/regenerate-plan-dialog"
import { regenerateMyPlanAction } from "@/lib/workouts/regeneration-actions"
import type { ActionResult } from "@/lib/types/action-result"

/**
 * Client-side regeneration entry point on the My Plan page. Binds the
 * {@link regenerateMyPlanAction} server action (which regenerates the signed-in
 * client's own plan) to the shared {@link RegeneratePlanDialog} and refreshes
 * the route on success so the freshly generated active plan renders. Rendered
 * only when the client already has an active plan to replace.
 */
export function RegenerateMyPlan() {
  const router = useRouter()

  async function onRegenerate(
    reason: string
  ): Promise<ActionResult<RegenerateSuccess>> {
    return regenerateMyPlanAction(reason)
  }

  return (
    <RegeneratePlanDialog
      onRegenerate={onRegenerate}
      onSuccess={() => router.refresh()}
    />
  )
}
