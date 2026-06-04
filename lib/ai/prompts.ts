import type { Client } from "@/lib/db/mappers"
import type { LocaleTag } from "@/i18n/routing"

/**
 * Prompt construction for AI workout-plan generation. Two responsibilities:
 * the static system prompt that fixes the model's persona and safety posture,
 * and a per-client user prompt that injects the onboarding context the plan
 * must respect. Kept dependency-free (pure functions over plain data) so the
 * unit tests can assert exactly what the model sees without any AI runtime.
 */

/**
 * System prompt for plan generation. Establishes the coaching persona and the
 * non-negotiable safety posture required by the batch: the model is not a
 * doctor, must not diagnose, must recommend a qualified professional for pain,
 * injury, or medical concerns, and must respect the client's stated
 * limitations. It also pins the output language and the structured-output
 * contract (the SDK enforces the shape; the prompt makes intent explicit).
 */
export const PLAN_SYSTEM_PROMPT = `You are an expert personal fitness coach generating a structured, personalized workout plan.

Safety rules (mandatory, never violate):
- You are not a doctor and you do not diagnose conditions.
- Never provide medical advice. For any pain, injury, illness, or medical concern, explicitly recommend that the client consult a qualified medical professional before continuing.
- Respect every limitation or injury the client reports: avoid contraindicated movements and offer safer alternatives.
- The plan-level safety note must always state that the client should stop and seek professional guidance if they feel pain, and that this plan is general guidance, not medical advice.
- When the client reports limitations or injuries, every exercise must include concrete safety guidance in its safety_notes field.

Plan rules:
- Schedule sessions only on the client's available days.
- Match volume and difficulty to the client's stated fitness level.
- Use only equipment the client has access to. If they selected "none", use bodyweight movements.
- Keep instructions clear, concise, and actionable.

Write all user-facing text (titles, summaries, instructions, notes, safety notes) in the requested output language.`

/** Human-readable, locale-tag-keyed label for the output language. */
const LANGUAGE_LABEL: Record<LocaleTag, string> = {
  "en-US": "English",
  "he-IL": "Hebrew",
}

/** Renders a list field for the prompt, or a placeholder when empty. */
function list(values: string[], emptyLabel: string): string {
  return values.length > 0 ? values.join(", ") : emptyLabel
}

/**
 * Builds the user prompt for a single client. Injects every piece of context
 * the plan must honor: goal, fitness level, available days, preferred training
 * location, available equipment, age/age range, and free-text
 * limitations/injuries and notes. The requested output language is derived from
 * the plan locale so the model writes copy the client can read.
 *
 * Free-text fields are passed through verbatim (trimmed upstream by onboarding
 * validation); they are model input only and never executed or interpolated
 * into code, so no further escaping is required here.
 *
 * @param client - The persisted onboarding profile to base the plan on.
 * @param localeTag - The plan's BCP 47 locale tag (drives output language).
 * @returns The user-prompt string handed to the model.
 */
export function buildPlanUserPrompt(
  client: Client,
  localeTag: LocaleTag
): string {
  const language = LANGUAGE_LABEL[localeTag]
  const age =
    client.age != null
      ? String(client.age)
      : client.ageRange
        ? `range ${client.ageRange}`
        : "not provided"

  const lines = [
    `Generate a personalized workout plan in ${language}.`,
    "",
    "Client profile:",
    `- Goal: ${client.goal ?? "general_fitness"}`,
    `- Fitness level: ${client.fitnessLevel ?? "beginner"}`,
    `- Age: ${age}`,
    `- Available training days: ${list(client.availableDays, "not specified")}`,
    `- Preferred location: ${client.preferredLocation ?? "not specified"}`,
    `- Available equipment: ${list(client.equipment, "none")}`,
    `- Limitations or injuries: ${client.limitations ?? "none reported"}`,
    `- Additional notes: ${client.notes ?? "none"}`,
    "",
    "Create one workout session per available training day. Stay within the client's equipment, level, and limitations.",
  ]

  return lines.join("\n")
}

/**
 * Whether the client reported any limitations or injuries. Drives the stricter
 * per-exercise safety-note enforcement in plan validation; exported so the
 * generation flow and tests share one definition of "has limitations".
 */
export function clientHasLimitations(client: Client): boolean {
  return typeof client.limitations === "string"
    ? client.limitations.trim().length > 0
    : false
}
