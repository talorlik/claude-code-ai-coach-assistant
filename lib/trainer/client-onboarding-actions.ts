"use server"

import { revalidatePath } from "next/cache"

import { requireTrainerAdmin } from "@/lib/auth/require-user"
import { upsertClient } from "@/lib/db/clients"
import type { Client } from "@/lib/db/mappers"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"
import {
  validateOnboarding,
  type OnboardingInput,
} from "@/lib/validation/onboarding"

/**
 * Trainer-admin server action for editing any client's onboarding details. The
 * client self-service path reuses {@link import("@/lib/onboarding/onboarding-actions").saveOnboardingDetails};
 * this is its admin twin, scoped to an explicit target client.
 *
 * Authorization is enforced twice: the {@link requireTrainerAdmin} guard is the
 * primary check, and the `clients` RLS policy (`auth.uid() = user_id OR
 * is_trainer_admin()`) is the database backstop - so {@link upsertClient} with an
 * explicit `userId` writes the target row only because the caller's session
 * resolves the trainer-admin policy. No separate trainer-scoped data function is
 * needed.
 *
 * Validation reuses the same {@link validateOnboarding} as onboarding, so the
 * admin edit honors every rule (availability windows, duration, equipment) the
 * client form does. The plan is NOT regenerated here - that stays an explicit,
 * separate action ({@link import("@/lib/workouts/regeneration-actions").regenerateClientPlanAction}).
 *
 * @param clientId - The target client's auth user id.
 * @param input - The raw onboarding payload from the admin edit form.
 * @returns The saved client, or a field-keyed validation / auth / save error.
 */
export async function saveClientOnboardingAction(
  clientId: string,
  input: OnboardingInput
): Promise<ActionResult<{ client: Client }>> {
  await requireTrainerAdmin()

  const validation = validateOnboarding(input)
  if (!validation.ok) return validation

  const data = validation.data

  let client: Client
  try {
    client = await upsertClient({
      userId: clientId,
      fullName: data.fullName,
      phone: data.phone || null,
      countryIso2: data.phone ? data.countryIso2 : null,
      age: data.age,
      ageRange: data.ageRange,
      goals: data.goals,
      fitnessLevel: data.fitnessLevel,
      limitations: data.limitations,
      availableDays: data.availableDays,
      availability: data.availability,
      sessionDurationMinutes: data.sessionDurationMinutes,
      preferredLocation: data.preferredLocation,
      equipment: data.equipment,
      equipmentOther: data.equipmentOther,
      notes: data.notes,
    })
  } catch {
    return fail("saveFailed")
  }

  // Refresh the trainer client dashboard in both locales so the edit shows.
  revalidatePath(`/en/trainer/clients/${clientId}`)
  revalidatePath(`/he/trainer/clients/${clientId}`)
  return ok({ client })
}
