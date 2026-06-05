import { getClient } from "@/lib/db/clients"
import { getActivePlanDetail } from "@/lib/db/workouts"
import type { WorkoutPlanPdfData } from "@/lib/pdf/workout-plan-pdf"

/**
 * Server-only loader that assembles the {@link WorkoutPlanPdfData} for a client's
 * active plan. Both underlying reads (`getClient`, `getActivePlanDetail`) run
 * through the request-scoped, RLS-bound Supabase client, so a caller only
 * receives data the signed-in user is permitted to see: a client sees their own
 * plan, the trainer admin sees any client's. Returns `null` when the client has
 * no active plan, which the route renders as a 404.
 *
 * @param clientId - The owning client's auth user id.
 * @param generatedAt - The timestamp printed on the document; injectable for
 *   deterministic tests, defaults to now.
 * @returns The PDF input, or `null` if there is no active plan to export.
 */
export async function loadWorkoutPlanPdfData(
  clientId: string,
  generatedAt: Date = new Date()
): Promise<WorkoutPlanPdfData | null> {
  const [client, detail] = await Promise.all([
    getClient(clientId),
    getActivePlanDetail(clientId),
  ])

  if (!detail) return null

  return {
    clientName: client?.fullName ?? null,
    planTitle: detail.plan.title,
    generatedAt,
    workouts: detail.workouts.map((workout) => ({
      dayOfWeek: workout.day_of_week,
      title: workout.title,
      focus: workout.focus,
      notes: workout.notes,
      exercises: workout.exercises.map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        duration: exercise.duration,
        rest: exercise.rest,
        instructions: exercise.instructions,
        safetyNotes: exercise.safety_notes,
      })),
    })),
  }
}
