import type { Client } from "@/lib/db/mappers"
import type {
  ChatMessageRow,
  WorkoutLogRow,
  WorkoutPlanRow,
} from "@/lib/db/types"
import type { LocaleTag } from "@/i18n/routing"

/**
 * Pure construction of the AI virtual-trainer's contextual system prompt. The
 * model must answer with the client's real situation in view - their goal,
 * fitness level, limitations, active plan, and recent activity - so this module
 * folds that context into a single instruction string. It is deliberately
 * dependency-free (pure functions over plain data) so the unit tests can assert
 * exactly what the model is told without any Supabase or AI runtime, mirroring
 * the plan-generation prompt module.
 *
 * The safety posture is non-negotiable and lives here, not in the client UI:
 * the assistant is not a doctor, must not diagnose, and must defer pain, injury,
 * or medical concerns to a qualified professional.
 */

/** Human-readable, locale-tag-keyed label for the answer language. */
const LANGUAGE_LABEL: Record<LocaleTag, string> = {
  "en-US": "English",
  "he-IL": "Hebrew",
}

/**
 * The base system prompt: persona plus the mandatory safety rules. Kept as a
 * constant (not interpolated) so the safety posture is identical on every turn
 * regardless of the per-client context appended after it.
 */
export const CHAT_SYSTEM_PROMPT = `You are AI Coach, a supportive, practical virtual personal trainer for a fitness client.

Your role:
- Help the client train safely and stay motivated, answer questions about their plan, technique, and progress, and suggest small, concrete next steps.
- Keep answers concise, encouraging, and actionable. Ground advice in the client's own goal, level, plan, and recent activity given below.

Safety rules (mandatory, never violate):
- You are not a doctor and you do not diagnose conditions or prescribe treatment.
- For any pain, injury, illness, dizziness, chest pain, or other medical concern, do not attempt to treat it: explicitly and immediately recommend that the client stop the activity and consult a qualified medical professional. Do not minimize these concerns.
- Respect every limitation or injury the client reports: never recommend a movement that would aggravate it; offer a safer alternative instead.
- This guidance is general fitness coaching, not medical advice. Say so when a question approaches medical territory.

Stay in scope: decline politely if asked for anything outside fitness coaching.`

/** Recent-activity windows the contextual prompt summarizes. */
export const RECENT_LOGS_LIMIT = 5
/** How many prior chat turns are replayed into the context summary. */
export const RECENT_HISTORY_LIMIT = 10

/** The client situation the contextual prompt is built from. */
export interface ChatContext {
  /** The client's onboarding profile, or `null` if not yet onboarded. */
  client: Client | null
  /** The client's active plan, or `null` if they have none. */
  activePlan: WorkoutPlanRow | null
  /** Recent completion logs (most recent first); may be empty. */
  recentLogs: WorkoutLogRow[]
  /** Recent chat history (chronological); may be empty. */
  recentHistory: ChatMessageRow[]
}

/** Renders a list field for the prompt, or a placeholder when empty. */
function list(values: string[], emptyLabel: string): string {
  return values.length > 0 ? values.join(", ") : emptyLabel
}

/**
 * Summarizes the client's onboarding profile into prompt lines. A missing
 * profile yields a single explicit line so the model knows context is absent
 * rather than silently assuming defaults.
 */
function describeClient(client: Client | null): string[] {
  if (!client) {
    return ["- The client has not completed onboarding yet; no profile on file."]
  }

  const age =
    client.age != null
      ? String(client.age)
      : client.ageRange
        ? `range ${client.ageRange}`
        : "not provided"

  return [
    `- Goal: ${client.goal ?? "general_fitness"}`,
    `- Fitness level: ${client.fitnessLevel ?? "beginner"}`,
    `- Age: ${age}`,
    `- Available training days: ${list(client.availableDays, "not specified")}`,
    `- Preferred location: ${client.preferredLocation ?? "not specified"}`,
    `- Available equipment: ${list(client.equipment, "none")}`,
    `- Limitations or injuries: ${client.limitations ?? "none reported"}`,
  ]
}

/** Summarizes the active plan, or notes its absence. */
function describePlan(plan: WorkoutPlanRow | null): string {
  if (!plan) {
    return "The client has no active workout plan yet."
  }
  return `Active plan: "${plan.title ?? "Untitled plan"}" (source: ${plan.source}).`
}

/** Summarizes recent completion logs, newest first, capped to the window. */
function describeRecentLogs(logs: WorkoutLogRow[]): string {
  if (logs.length === 0) {
    return "Recent activity: no workouts logged yet."
  }
  const lines = logs.slice(0, RECENT_LOGS_LIMIT).map((log) => {
    const when = log.planned_date ?? log.completed_at.slice(0, 10)
    const detail = [
      log.difficulty ? `difficulty ${log.difficulty}` : null,
      log.energy_level ? `energy ${log.energy_level}` : null,
    ]
      .filter(Boolean)
      .join(", ")
    return `- ${when}: completed a workout${detail ? ` (${detail})` : ""}`
  })
  return ["Recent activity (most recent first):", ...lines].join("\n")
}

/**
 * Builds the full contextual system prompt for one chat turn: the static
 * persona and safety rules, then the client's profile, active plan, and recent
 * activity, then the answer-language instruction. The prior chat history is fed
 * to the model as conversation messages by the route, not duplicated here; this
 * prompt is the always-on system context that frames every reply.
 *
 * Free-text fields (limitations, plan title) are model input only and never
 * executed or interpolated into code, so no escaping is required beyond the
 * trimming onboarding validation already applies.
 *
 * @param context - The client situation to summarize.
 * @param localeTag - The answer language's BCP 47 tag.
 * @returns The system-prompt string handed to the model for this turn.
 */
export function buildChatSystemPrompt(
  context: ChatContext,
  localeTag: LocaleTag
): string {
  const language = LANGUAGE_LABEL[localeTag]

  return [
    CHAT_SYSTEM_PROMPT,
    "",
    "Client profile:",
    ...describeClient(context.client),
    "",
    describePlan(context.activePlan),
    "",
    describeRecentLogs(context.recentLogs),
    "",
    `Answer in ${language} unless the client clearly writes in another language; then match the client's language.`,
  ].join("\n")
}
