import { readFile } from "node:fs/promises"
import path from "node:path"

import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, PDFFont, PDFPage, rgb, type RGB } from "pdf-lib"

import { localeDirection, type Locale } from "@/i18n/routing"
import { fixRtlNumerals } from "@/lib/pdf/bidi"
import { getPdfLabels, type PdfLabels } from "@/lib/pdf/labels"

/**
 * Server-side workout-plan PDF generation. Built on `pdf-lib`, which is a pure
 * TypeScript/JS library: no headless browser and no native bindings, so it runs
 * cleanly in the Next.js serverless runtime. Hebrew (and any non-Latin) text
 * requires an embedded Unicode font - the standard PDF fonts only encode
 * WinAnsi - so a Noto Sans Hebrew TrueType face (covering Hebrew and Latin) is
 * embedded and subset on every render via `@pdf-lib/fontkit`.
 *
 * RTL handling is pragmatic, matching the batch's scope: Hebrew text is
 * right-aligned and the document gutter mirrors to the right. Full bidirectional
 * glyph shaping (joining, mirrored brackets) is out of scope; the on-screen plan
 * view remains the canonical RTL surface and this export is a faithful printable
 * summary. Numbers and Latin tokens embedded in Hebrew strings render in their
 * source order.
 */

/** A single exercise as printed in the PDF. */
export interface PdfExercise {
  name: string
  sets: number | null
  reps: string | null
  duration: string | null
  rest: string | null
  instructions: string | null
  safetyNotes: string | null
}

/** A workout session as printed in the PDF. */
export interface PdfWorkout {
  dayOfWeek: string | null
  title: string | null
  focus: string | null
  notes: string | null
  exercises: PdfExercise[]
}

/** The full, serializable input the PDF builder renders. */
export interface WorkoutPlanPdfData {
  clientName: string | null
  planTitle: string | null
  /** ISO date the document is generated for; formatted per locale. */
  generatedAt: Date
  workouts: PdfWorkout[]
}

// Layout constants (points; 72pt = 1in). A4-ish portrait page.
const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const LINE_GAP = 4
const INK: RGB = rgb(0.1, 0.1, 0.12)
const MUTED: RGB = rgb(0.4, 0.4, 0.45)
const RULE: RGB = rgb(0.85, 0.85, 0.88)

/**
 * Resolves the embedded font file path. The font lives beside this module under
 * `lib/pdf/fonts/`; resolving from `process.cwd()` keeps it correct under both
 * the dev server and the traced serverless bundle (the file is added to
 * `outputFileTracingIncludes` in `next.config.mjs`).
 */
function fontPath(): string {
  return path.join(
    process.cwd(),
    "lib",
    "pdf",
    "fonts",
    "NotoSansHebrew-Regular.ttf"
  )
}

/** A drawing cursor that flows top-to-bottom and paginates as needed. */
interface Cursor {
  page: PDFPage
  y: number
}

/**
 * Builds a localized workout-plan PDF and returns the encoded bytes. The output
 * is a complete, valid PDF (`%PDF` header, `%%EOF` trailer) with the Unicode
 * font embedded, so it renders identically regardless of the reader's installed
 * fonts. Throws if the embedded font cannot be read or embedded, so a caller
 * never returns a half-built document.
 *
 * @param data - The plan, its sessions and exercises, client name, and date.
 * @param locale - The active locale prefix; selects labels and text direction.
 * @returns The PDF file contents as a `Uint8Array`.
 */
export async function buildWorkoutPlanPdf(
  data: WorkoutPlanPdfData,
  locale: Locale
): Promise<Uint8Array> {
  const labels = getPdfLabels(locale)
  const rtl = localeDirection(locale) === "rtl"

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  // `readFile` returns a Node `Buffer`. pdf-lib validates the argument with an
  // `instanceof Uint8Array` check against the active realm's global; under a
  // jsdom test realm a Node `Buffer` is not recognised as that `Uint8Array` and
  // the embed throws ("type NaN"). Copy the bytes into a plain `Uint8Array`
  // backed by its own buffer so it is realm-agnostic.
  const buffer = await readFile(fontPath())
  const fontBytes = new Uint8Array(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    )
  )
  const font = await doc.embedFont(fontBytes, { subset: true })

  doc.setTitle(
    `${labels.documentTitle}${data.planTitle ? ` - ${data.planTitle}` : ""}`
  )
  doc.setCreator("Studio Itai AI Coach")

  const cursor: Cursor = {
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
  }

  drawHeader(doc, cursor, data, labels, font, rtl)
  drawSchedule(doc, cursor, data, labels, font, rtl)
  drawWorkouts(doc, cursor, data, labels, font, rtl)
  stampFooter(doc, labels, font, rtl)

  return doc.save()
}

/** Adds a fresh page and resets the cursor to its top margin. */
function newPage(doc: PDFDocument, cursor: Cursor): void {
  cursor.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  cursor.y = PAGE_HEIGHT - MARGIN
}

/** Ensures at least `needed` points remain; paginates if not. */
function ensureSpace(doc: PDFDocument, cursor: Cursor, needed: number): void {
  if (cursor.y - needed < MARGIN + 24) {
    newPage(doc, cursor)
  }
}

/**
 * Draws one line of text honoring direction. LTR draws from the left margin;
 * RTL right-aligns to the right margin. Long lines are wrapped to the content
 * width. Advances the cursor by the consumed height.
 */
function drawText(
  doc: PDFDocument,
  cursor: Cursor,
  text: string,
  font: PDFFont,
  size: number,
  rtl: boolean,
  options: { color?: RGB; indent?: number } = {}
): void {
  const color = options.color ?? INK
  const indent = options.indent ?? 0
  const maxWidth = CONTENT_WIDTH - indent
  const baseDir = rtl ? "rtl" : "ltr"
  // Wrap on the logical string (word boundaries); fontkit shapes the RTL run,
  // but we pre-reverse embedded numbers so they are not painted backwards.
  for (const logicalLine of wrapText(text, font, size, maxWidth)) {
    const line = fixRtlNumerals(logicalLine, baseDir)
    ensureSpace(doc, cursor, size + LINE_GAP)
    const width = font.widthOfTextAtSize(line, size)
    const x = rtl ? PAGE_WIDTH - MARGIN - indent - width : MARGIN + indent
    cursor.page.drawText(line, { x, y: cursor.y - size, size, font, color })
    cursor.y -= size + LINE_GAP
  }
}

/** Greedy word-wrap to a pixel width; falls back to hard-splitting long tokens. */
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push("")
      continue
    }
    let current = ""
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (
        font.widthOfTextAtSize(candidate, size) <= maxWidth ||
        current === ""
      ) {
        current = candidate
      } else {
        lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

/** Draws a horizontal rule and advances the cursor. */
function drawRule(doc: PDFDocument, cursor: Cursor): void {
  ensureSpace(doc, cursor, 12)
  cursor.y -= 6
  cursor.page.drawLine({
    start: { x: MARGIN, y: cursor.y },
    end: { x: PAGE_WIDTH - MARGIN, y: cursor.y },
    thickness: 0.75,
    color: RULE,
  })
  cursor.y -= 10
}

/** Title, client, and date block. */
function drawHeader(
  doc: PDFDocument,
  cursor: Cursor,
  data: WorkoutPlanPdfData,
  labels: PdfLabels,
  font: PDFFont,
  rtl: boolean
): void {
  drawText(doc, cursor, data.planTitle ?? labels.documentTitle, font, 22, rtl)
  cursor.y -= 4
  if (data.clientName) {
    drawText(
      doc,
      cursor,
      `${labels.client}: ${data.clientName}`,
      font,
      11,
      rtl,
      {
        color: MUTED,
      }
    )
  }
  // ISO calendar date: unambiguous in both locales and digit-stable, so it needs
  // no locale-specific formatting or bidi handling.
  const date = data.generatedAt.toISOString().slice(0, 10)
  drawText(doc, cursor, `${labels.generated}: ${date}`, font, 11, rtl, {
    color: MUTED,
  })
  drawRule(doc, cursor)
}

/** Weekly schedule overview: weekday -> session title (or rest). */
function drawSchedule(
  doc: PDFDocument,
  cursor: Cursor,
  data: WorkoutPlanPdfData,
  labels: PdfLabels,
  font: PDFFont,
  rtl: boolean
): void {
  drawText(doc, cursor, labels.weeklySchedule, font, 14, rtl)
  cursor.y -= 2

  const order = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]
  const byDay = new Map<string, PdfWorkout[]>()
  for (const w of data.workouts) {
    const day = w.dayOfWeek?.toLowerCase() ?? ""
    if (order.includes(day)) {
      const list = byDay.get(day) ?? []
      list.push(w)
      byDay.set(day, list)
    }
  }

  for (const day of order) {
    const sessions = byDay.get(day) ?? []
    const dayName = labels.weekday[day] ?? day
    const value =
      sessions.length > 0
        ? sessions.map((s) => s.title ?? labels.untitledWorkout).join(", ")
        : labels.restDay
    drawText(doc, cursor, `${dayName}: ${value}`, font, 11, rtl, {
      color: sessions.length > 0 ? INK : MUTED,
    })
  }
  drawRule(doc, cursor)
}

/** Detailed per-session breakdown with exercises. */
function drawWorkouts(
  doc: PDFDocument,
  cursor: Cursor,
  data: WorkoutPlanPdfData,
  labels: PdfLabels,
  font: PDFFont,
  rtl: boolean
): void {
  if (data.workouts.length === 0) {
    drawText(doc, cursor, labels.emptyPlan, font, 11, rtl, { color: MUTED })
    return
  }

  for (const workout of data.workouts) {
    ensureSpace(doc, cursor, 60)
    const dayName = workout.dayOfWeek
      ? (labels.weekday[workout.dayOfWeek.toLowerCase()] ?? labels.unscheduled)
      : labels.unscheduled
    const heading = [workout.title ?? labels.untitledWorkout, workout.focus]
      .filter(Boolean)
      .join(" · ")
    drawText(doc, cursor, `${dayName} — ${heading}`, font, 14, rtl)

    if (workout.notes) {
      drawText(doc, cursor, workout.notes, font, 10, rtl, {
        color: MUTED,
        indent: 8,
      })
    }

    let index = 1
    for (const exercise of workout.exercises) {
      drawExercise(doc, cursor, exercise, index, labels, font, rtl)
      index += 1
    }
    cursor.y -= 6
  }
}

/** One exercise: name, the sets/reps/etc. line, instructions, safety. */
function drawExercise(
  doc: PDFDocument,
  cursor: Cursor,
  exercise: PdfExercise,
  index: number,
  labels: PdfLabels,
  font: PDFFont,
  rtl: boolean
): void {
  ensureSpace(doc, cursor, 36)
  drawText(doc, cursor, `${index}. ${exercise.name}`, font, 11.5, rtl, {
    indent: 8,
  })

  const meta: string[] = []
  if (exercise.sets != null)
    meta.push(`${labels.exercise.sets}: ${exercise.sets}`)
  if (exercise.reps) meta.push(`${labels.exercise.reps}: ${exercise.reps}`)
  if (exercise.duration)
    meta.push(`${labels.exercise.duration}: ${exercise.duration}`)
  if (exercise.rest) meta.push(`${labels.exercise.rest}: ${exercise.rest}`)
  if (meta.length > 0) {
    drawText(doc, cursor, meta.join("   "), font, 10, rtl, {
      color: MUTED,
      indent: 16,
    })
  }

  if (exercise.instructions) {
    drawText(
      doc,
      cursor,
      `${labels.exercise.instructions}: ${exercise.instructions}`,
      font,
      10,
      rtl,
      { indent: 16 }
    )
  }
  if (exercise.safetyNotes) {
    drawText(
      doc,
      cursor,
      `${labels.exercise.safety}: ${exercise.safetyNotes}`,
      font,
      10,
      rtl,
      { color: rgb(0.6, 0.35, 0.05), indent: 16 }
    )
  }
}

/** Stamps the safety disclaimer at the foot of every page. */
function stampFooter(
  doc: PDFDocument,
  labels: PdfLabels,
  font: PDFFont,
  rtl: boolean
): void {
  const size = 8
  const baseDir = rtl ? "rtl" : "ltr"
  for (const page of doc.getPages()) {
    const lines = wrapText(labels.safetyDisclaimer, font, size, CONTENT_WIDTH)
    let y = MARGIN - 10
    // Draw bottom-up so the first line sits highest.
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = fixRtlNumerals(lines[i], baseDir)
      const width = font.widthOfTextAtSize(line, size)
      const x = rtl ? PAGE_WIDTH - MARGIN - width : MARGIN
      page.drawText(line, { x, y, size, font, color: MUTED })
      y += size + 2
    }
  }
}
