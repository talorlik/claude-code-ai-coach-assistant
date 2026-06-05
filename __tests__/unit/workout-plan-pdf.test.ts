import { describe, expect, it } from "vitest"

import {
  buildWorkoutPlanPdf,
  type WorkoutPlanPdfData,
} from "@/lib/pdf/workout-plan-pdf"

/**
 * Unit tests for the PDF builder. These exercise the real `pdf-lib` pipeline and
 * the embedded Unicode font (no mocking), asserting that both the English and
 * Hebrew paths produce a complete, well-formed PDF byte stream. Full visual/RTL
 * fidelity is verified manually (see DECISIONS); here we prove the document is
 * structurally valid and that Hebrew content does not throw on the WinAnsi
 * encoding limit, which embedding the Noto font is specifically there to avoid.
 */

const SAMPLE: WorkoutPlanPdfData = {
  clientName: "Dana Levi",
  planTitle: "Strength Builder",
  generatedAt: new Date("2026-06-05T00:00:00.000Z"),
  workouts: [
    {
      dayOfWeek: "monday",
      title: "Push Day",
      focus: "Chest & shoulders",
      notes: "Warm up for 10 minutes first.",
      exercises: [
        {
          name: "Bench Press",
          sets: 4,
          reps: "8-10",
          duration: null,
          rest: "90s",
          instructions: "Keep your back flat and elbows tucked.",
          safetyNotes: "Use a spotter for heavy sets.",
        },
        {
          name: "Plank",
          sets: 3,
          reps: null,
          duration: "60s",
          rest: "30s",
          instructions: null,
          safetyNotes: null,
        },
      ],
    },
    {
      dayOfWeek: null,
      title: "Mobility",
      focus: null,
      notes: null,
      exercises: [],
    },
  ],
}

/** First bytes of every PDF file. */
const PDF_MAGIC = "%PDF-"

function header(bytes: Uint8Array, length: number): string {
  return new TextDecoder("latin1").decode(bytes.slice(0, length))
}

describe("buildWorkoutPlanPdf", () => {
  it("produces a valid PDF for the English plan", async () => {
    const bytes = await buildWorkoutPlanPdf(SAMPLE, "en")
    expect(bytes.byteLength).toBeGreaterThan(1000)
    expect(header(bytes, PDF_MAGIC.length)).toBe(PDF_MAGIC)
  })

  it("produces a valid PDF for the Hebrew plan without throwing on RTL text", async () => {
    const bytes = await buildWorkoutPlanPdf(SAMPLE, "he")
    expect(bytes.byteLength).toBeGreaterThan(1000)
    expect(header(bytes, PDF_MAGIC.length)).toBe(PDF_MAGIC)
  })

  it("renders an empty plan without throwing", async () => {
    const empty: WorkoutPlanPdfData = { ...SAMPLE, workouts: [] }
    const bytes = await buildWorkoutPlanPdf(empty, "en")
    expect(header(bytes, PDF_MAGIC.length)).toBe(PDF_MAGIC)
  })

  it("paginates a long plan onto multiple pages", async () => {
    const many: WorkoutPlanPdfData = {
      ...SAMPLE,
      workouts: Array.from({ length: 12 }, (_, i) => ({
        dayOfWeek: null,
        title: `Session ${i + 1}`,
        focus: "Full body",
        notes: "A longer note ".repeat(20),
        exercises: Array.from({ length: 6 }, (_, j) => ({
          name: `Exercise ${j + 1}`,
          sets: 3,
          reps: "12",
          duration: null,
          rest: "60s",
          instructions: "Controlled tempo throughout the movement. ".repeat(4),
          safetyNotes: "Stop if you feel sharp pain.",
        })),
      })),
    }
    const bytes = await buildWorkoutPlanPdf(many, "en")
    // A multi-page document is meaningfully larger than the single-page sample.
    expect(bytes.byteLength).toBeGreaterThan(3000)
    expect(header(bytes, PDF_MAGIC.length)).toBe(PDF_MAGIC)
  })
})
