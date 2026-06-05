import type { Locale } from "@/i18n/routing"

/**
 * Static, locale-keyed label set for the workout-plan PDF. The PDF is built in a
 * plain server context (an API route handler), outside the React tree, so it
 * cannot use the `next-intl` `useTranslations`/`getTranslations` hooks bound to
 * a request locale. Rather than thread a translator into the drawing code, the
 * small, fixed vocabulary the PDF needs is mirrored here per locale.
 *
 * Keys intentionally overlap the `MyPlan` message namespace (weekday names,
 * exercise field labels) so the document reads consistently with the on-screen
 * plan view; they are duplicated rather than imported because the JSON message
 * catalogs are shaped for the UI and pulling arbitrary nested keys at runtime
 * would lose type safety.
 */
export interface PdfLabels {
  /** Document heading, e.g. "Workout Plan". */
  documentTitle: string
  /** Label preceding the client's name. */
  client: string
  /** Label preceding the generated date. */
  generated: string
  /** Heading for the weekly schedule overview. */
  weeklySchedule: string
  /** Shown for a day with no scheduled session. */
  restDay: string
  /** Heading for sessions without a recognised weekday. */
  unscheduled: string
  /** Fallback session title. */
  untitledWorkout: string
  /** Per-exercise field labels. */
  exercise: {
    sets: string
    reps: string
    duration: string
    rest: string
    instructions: string
    safety: string
  }
  /** Weekday names keyed by lowercase English weekday. */
  weekday: Record<string, string>
  /** Footer disclaimer printed on every page. */
  safetyDisclaimer: string
  /** Shown when the plan has no sessions. */
  emptyPlan: string
}

const EN: PdfLabels = {
  documentTitle: "Workout Plan",
  client: "Client",
  generated: "Generated",
  weeklySchedule: "Weekly schedule",
  restDay: "Rest day",
  unscheduled: "Anytime",
  untitledWorkout: "Workout",
  exercise: {
    sets: "Sets",
    reps: "Reps",
    duration: "Duration",
    rest: "Rest",
    instructions: "Instructions",
    safety: "Safety",
  },
  weekday: {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  },
  safetyDisclaimer:
    "Always warm up, use correct form, and stop if you feel pain. " +
    "Consult a professional before starting a new program.",
  emptyPlan: "This plan has no sessions yet.",
}

const HE: PdfLabels = {
  documentTitle: "תוכנית אימון",
  client: "מתאמן",
  generated: "הופק בתאריך",
  weeklySchedule: "מערכת שבועית",
  restDay: "יום מנוחה",
  unscheduled: "בכל זמן",
  untitledWorkout: "אימון",
  exercise: {
    sets: "סטים",
    reps: "חזרות",
    duration: "משך",
    rest: "מנוחה",
    instructions: "הוראות",
    safety: "בטיחות",
  },
  weekday: {
    monday: "יום שני",
    tuesday: "יום שלישי",
    wednesday: "יום רביעי",
    thursday: "יום חמישי",
    friday: "יום שישי",
    saturday: "יום שבת",
    sunday: "יום ראשון",
  },
  safetyDisclaimer:
    "התחממו לפני האימון, הקפידו על טכניקה נכונה, והפסיקו אם אתם חשים כאב. " +
    "התייעצו עם איש מקצוע לפני תחילת תוכנית חדשה.",
  emptyPlan: "לתוכנית זו עדיין אין אימונים.",
}

/**
 * Returns the PDF label set for a locale prefix. Defaults to English for any
 * unknown value so the document is never produced without labels.
 *
 * @param locale - A supported locale prefix (`"en"` or `"he"`).
 * @returns The label set used while drawing the PDF.
 */
export function getPdfLabels(locale: Locale | string): PdfLabels {
  return locale === "he" ? HE : EN
}
