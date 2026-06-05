/**
 * Targeted bidirectional-numeral handling for the PDF renderer.
 *
 * `pdf-lib` + `@pdf-lib/fontkit` shape and position a pure right-to-left run
 * (Hebrew words) correctly when handed logical-order text and right-aligned.
 * They do NOT, however, apply the Unicode Bidi Algorithm to neutral/number runs:
 * a digit sequence embedded in a Hebrew line is emitted in the surrounding RTL
 * visual order, so `10` paints as `01` and a date `2026-06-05` as `50-60-6202`.
 *
 * A full bidi engine is unnecessary for this document's content, which is
 * Hebrew text with embedded numbers, ranges (`8-10`), and ISO dates. The fix is
 * narrow and exact: pre-reverse each maximal numeric run in the logical string
 * so the renderer's own RTL reversal cancels it out, leaving the number readable
 * left-to-right. Hebrew letters are left untouched.
 */

/**
 * Matches a maximal numeric run: a digit, optionally followed by more digits
 * and the punctuation that binds numbers together (`-`, `/`, `.`, `,`, `:`),
 * ending on a digit. The single-digit alternative catches lone digits.
 */
const NUMERIC_RUN = /[0-9][0-9.,:/-]*[0-9]|[0-9]/g

/**
 * Reverses each numeric run in a right-to-left line so it reads correctly once
 * the PDF renderer paints the surrounding RTL run. A no-op for left-to-right
 * text, where numbers already render in order. Pure and synchronous.
 *
 * @param line - A single logical-order line; no newlines.
 * @param baseDir - The paragraph base direction. Only `"rtl"` is transformed.
 * @returns The line with numeric runs pre-reversed for an RTL base.
 */
export function fixRtlNumerals(line: string, baseDir: "ltr" | "rtl"): string {
  if (baseDir !== "rtl" || line === "") return line
  return line.replace(NUMERIC_RUN, (run) => Array.from(run).reverse().join(""))
}
