/**
 * Row shapes for the app's Postgres tables, mirroring
 * `supabase/migrations/0002_app_schema.sql`. These are the database-level
 * representations (snake_case columns); higher layers map them to domain models
 * as needed. Keeping them here gives the server-only data-access modules a
 * single typed source of truth without pulling in generated Supabase types.
 */

/** Lifecycle status of a workout plan. Exactly one `active` plan per client. */
export type PlanStatus = "active" | "archived"

/**
 * How a plan or template came to exist. `regeneration` marks a plan produced by
 * the regeneration flow (batch 14); it parallels `ai` but distinguishes a
 * deliberate replacement of a prior plan from a first-time generation.
 */
export type PlanSource = "ai" | "manual" | "template" | "regeneration"

/** Why a generation event fired. */
export type GenerationSource = "onboarding" | "regeneration" | "template"

/** Outcome recorded for a generation event. */
export type GenerationStatus = "succeeded" | "failed"

/** Role of a chat message author. */
export type ChatRole = "user" | "assistant"

/** A client's onboarding profile. Keyed by the auth user id. */
export interface ClientRow {
  user_id: string
  full_name: string | null
  phone: string | null
  age: number | null
  age_range: string | null
  goals: string[] | null
  fitness_level: string | null
  limitations: string | null
  available_days: string[]
  preferred_location: string | null
  equipment: string[]
  notes: string | null
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

/** A generated or assigned workout plan owned by a client. */
export interface WorkoutPlanRow {
  id: string
  client_id: string
  title: string | null
  status: PlanStatus
  locale: string | null
  source: PlanSource
  source_payload: unknown | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

/** A single session within a plan. */
export interface WorkoutRow {
  id: string
  plan_id: string
  day_of_week: string | null
  title: string | null
  focus: string | null
  position: number
  notes: string | null
  created_at: string
  updated_at: string
}

/** An ordered movement within a workout. */
export interface ExerciseRow {
  id: string
  workout_id: string
  name: string
  sets: number | null
  reps: string | null
  duration: string | null
  rest: string | null
  instructions: string | null
  safety_notes: string | null
  position: number
  created_at: string
  updated_at: string
}

/** A client's completion record for one workout on a planned date. */
export interface WorkoutLogRow {
  id: string
  client_id: string
  workout_id: string
  planned_date: string | null
  completed_at: string
  difficulty: string | null
  energy_level: string | null
  notes: string | null
  created_at: string
}

/** One message in the AI virtual-trainer conversation. */
export interface ChatMessageRow {
  id: string
  client_id: string
  role: ChatRole
  content: string
  created_at: string
}

/** A trainer-owned reusable plan blueprint. */
export interface PlanTemplateRow {
  id: string
  created_by: string
  title: string
  description: string | null
  locale: string | null
  payload: unknown
  created_at: string
  updated_at: string
}

/** A private trainer note about a client. */
export interface TrainerNoteRow {
  id: string
  client_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
}

/** A browser Web Push subscription owned by a client. */
export interface PushSubscriptionRow {
  id: string
  client_id: string
  endpoint: string
  p256dh: string
  auth: string
  enabled: boolean
  created_at: string
  updated_at: string
}

/** An audit record of a plan generation or regeneration. */
export interface PlanGenerationEventRow {
  id: string
  client_id: string
  plan_id: string | null
  triggered_by: string | null
  source: GenerationSource
  reason: string | null
  status: GenerationStatus
  created_at: string
}
