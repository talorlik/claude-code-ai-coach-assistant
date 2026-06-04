import { z } from "zod"

/**
 * Structured schema for an AI-generated workout plan. This is the single
 * contract between the model and persistence: {@link generateWorkoutPlan} asks
 * the model for an object of exactly this shape via the AI SDK's
 * `generateObject`, and the persistence layer only ever writes a value that has
 * passed {@link validateGeneratedPlan}. Nothing partial or malformed is saved.
 *
 * Field names mirror the `workout_plans` / `workouts` / `exercises` columns so
 * the mapping in the persistence layer stays mechanical. Free-text numeric-ish
 * fields (`reps`, `duration`, `rest`) are strings on purpose: a plan often
 * needs "8-12", "30s", or "to failure", which an integer column cannot hold.
 */

/** A single movement within a workout. */
export const exerciseSchema = z.object({
  /** Display name of the exercise, e.g. "Goblet squat". */
  name: z.string().min(1).max(120),
  /** Number of sets; null when the exercise is duration-based. */
  sets: z.number().int().min(1).max(20).nullable(),
  /** Reps as free text ("8-12", "to failure"); null for duration work. */
  reps: z.string().max(60).nullable(),
  /** Work duration as free text ("30s", "10 min"); null for rep work. */
  duration: z.string().max(60).nullable(),
  /** Rest between sets as free text ("60-90s"); null when unspecified. */
  rest: z.string().max(60).nullable(),
  /** How to perform the movement, in the plan's locale. */
  instructions: z.string().max(2000).nullable(),
  /**
   * Per-exercise safety guidance. Required (non-null, non-empty) when the
   * client reported limitations or injuries; see {@link planSafetyRefinement}.
   */
  safety_notes: z.string().max(2000).nullable(),
})

/** One training session (typically a day) within the plan. */
export const workoutSchema = z.object({
  /**
   * Weekday key this session is assigned to. Must be one of the client's
   * available-day keys (monday..sunday); not validated against the client here
   * (the schema is client-agnostic), but the prompt constrains it.
   */
  day_of_week: z.string().max(20).nullable(),
  /** Session title, e.g. "Upper body strength". */
  title: z.string().min(1).max(120),
  /** Primary focus, e.g. "push", "legs", "conditioning". */
  focus: z.string().max(120).nullable(),
  /** Session-level coaching notes in the plan's locale. */
  notes: z.string().max(2000).nullable(),
  /** Ordered exercises; at least one per session. */
  exercises: z.array(exerciseSchema).min(1).max(20),
})

/** The complete generated plan. */
export const workoutPlanSchema = z.object({
  /** Plan title shown to the client. */
  title: z.string().min(1).max(160),
  /** Short, motivating plan summary in the plan's locale. */
  summary: z.string().max(2000).nullable(),
  /**
   * Plan-level safety disclaimer. Always present: the model is instructed it is
   * not a doctor, gives no diagnosis, and to recommend a professional for pain,
   * injury, or medical concerns.
   */
  safety_notes: z.string().min(1).max(4000),
  /** Ordered training sessions; at least one. */
  workouts: z.array(workoutSchema).min(1).max(7),
})

/** A validated exercise as produced by the model. */
export type GeneratedExercise = z.infer<typeof exerciseSchema>
/** A validated workout session as produced by the model. */
export type GeneratedWorkout = z.infer<typeof workoutSchema>
/** A validated, complete generated plan. */
export type GeneratedPlan = z.infer<typeof workoutPlanSchema>

/**
 * Outcome of validating a candidate plan. On success the parsed, type-narrowed
 * plan; on failure a flat list of human-readable issue paths for logging (never
 * shown to the end user, who sees a localized generic error).
 */
export type PlanValidation =
  | { ok: true; plan: GeneratedPlan }
  | { ok: false; issues: string[] }

/**
 * Validates a raw, untrusted candidate plan against {@link workoutPlanSchema}
 * and, when `hasLimitations` is true, enforces the additional safety rule that
 * every exercise must carry non-empty `safety_notes`. Returns a discriminated
 * result rather than throwing so callers can branch on validity and persist
 * only fully valid plans.
 *
 * The limitations rule lives here (not in the zod schema) because it is
 * context-dependent: it applies only when the client declared limitations or
 * injuries. Keeping it in the validator means the same `workoutPlanSchema` is
 * reusable for clients without limitations.
 *
 * @param candidate - Untrusted value, typically the model's object output.
 * @param hasLimitations - Whether the client reported limitations/injuries.
 * @returns A validated plan or the list of validation issues.
 */
export function validateGeneratedPlan(
  candidate: unknown,
  hasLimitations: boolean
): PlanValidation {
  const parsed = workoutPlanSchema.safeParse(candidate)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
    )
    return { ok: false, issues }
  }

  if (hasLimitations) {
    const issues: string[] = []
    parsed.data.workouts.forEach((workout, wi) => {
      workout.exercises.forEach((exercise, ei) => {
        if (!exercise.safety_notes || exercise.safety_notes.trim() === "") {
          issues.push(
            `workouts.${wi}.exercises.${ei}.safety_notes: required when the client has limitations`
          )
        }
      })
    })
    if (issues.length > 0) return { ok: false, issues }
  }

  return { ok: true, plan: parsed.data }
}
