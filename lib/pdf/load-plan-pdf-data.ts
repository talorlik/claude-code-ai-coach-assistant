import { getClient } from "@/lib/db/clients"
import { getActivePlanDetail } from "@/lib/db/workouts"
import type { Client } from "@/lib/db/mappers"
import type { Locale } from "@/i18n/routing"
import enUS from "@/messages/en-US.json"
import heIL from "@/messages/he-IL.json"
import type {
  PdfOnboarding,
  WorkoutPlanPdfData,
} from "@/lib/pdf/workout-plan-pdf"

/**
 * Server-only loader that assembles the {@link WorkoutPlanPdfData} for a client's
 * active plan. Both underlying reads (`getClient`, `getActivePlanDetail`) run
 * through the request-scoped, RLS-bound Supabase client, so a caller only
 * receives data the signed-in user is permitted to see: a client sees their own
 * plan, the trainer admin sees any client's. Returns `null` when the client has
 * no active plan, which the route renders as a 404.
 *
 * @param clientId - The owning client's auth user id.
 * @param locale - The export locale; selects the labels used to localize the
 *   onboarding option keys (goals, days, equipment, etc.) printed at the top.
 * @param generatedAt - The timestamp printed on the document; injectable for
 *   deterministic tests, defaults to now.
 * @returns The PDF input, or `null` if there is no active plan to export.
 */
export async function loadWorkoutPlanPdfData(
  clientId: string,
  locale: Locale | string = "en",
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
    onboarding: client ? buildOnboarding(client, locale) : null,
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

/** The `Onboarding.options` catalog for a locale, for resolving option keys. */
function optionCatalog(locale: Locale | string) {
  const messages = locale === "he" ? heIL : enUS
  return messages.Onboarding.options as {
    goal: Record<string, string>
    fitnessLevel: Record<string, string>
    location: Record<string, string>
    day: Record<string, string>
    equipment: Record<string, string>
  }
}

/**
 * Builds the pre-localized onboarding block printed at the top of the PDF.
 * Option keys (goals, fitness level, location, days, equipment) are resolved to
 * their display labels from the locale's `Onboarding.options` catalog; free-text
 * "Other" equipment and the per-day time windows are rendered as-is. Returns
 * null-valued fields where the client has nothing recorded, which the builder
 * skips.
 */
function buildOnboarding(client: Client, locale: Locale | string): PdfOnboarding {
  const opt = optionCatalog(locale)
  const label = (dict: Record<string, string>, key: string): string =>
    dict[key] ?? key
  const joinKeys = (dict: Record<string, string>, keys: string[]): string =>
    keys.map((k) => label(dict, k)).join(", ")

  const goals = client.goals.length ? joinKeys(opt.goal, client.goals) : null
  const days = client.availableDays.length
    ? joinKeys(opt.day, client.availableDays)
    : null
  const equipmentParts = [
    ...client.equipment.map((e) => label(opt.equipment, e)),
    ...client.equipmentOther,
  ]
  // Per-day windows in the client's day order, e.g. "Mon: 06:00-08:00; ...".
  const windows = client.availableDays
    .filter((day) => (client.availability[day]?.length ?? 0) > 0)
    .map((day) => {
      const ranges = client.availability[day]
        .map((r) => `${r.start}-${r.end}`)
        .join(", ")
      return `${label(opt.day, day)}: ${ranges}`
    })
    .join("; ")

  return {
    goals,
    fitnessLevel: client.fitnessLevel
      ? label(opt.fitnessLevel, client.fitnessLevel)
      : null,
    age:
      client.age != null
        ? String(client.age)
        : client.ageRange
          ? client.ageRange
          : null,
    availableDays: days,
    timeWindows: windows || null,
    sessionLength:
      client.sessionDurationMinutes != null
        ? `${client.sessionDurationMinutes} min`
        : null,
    location: client.preferredLocation
      ? label(opt.location, client.preferredLocation)
      : null,
    equipment: equipmentParts.length ? equipmentParts.join(", ") : null,
    limitations: client.limitations,
    notes: client.notes,
  }
}
