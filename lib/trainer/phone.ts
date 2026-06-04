/**
 * Pure WhatsApp phone helpers for the trainer client dashboard. The `clients`
 * table stores a loosely-formatted phone string (normalized for storage by
 * `lib/auth/validation.ts`, which keeps a single leading `+`). For a WhatsApp
 * "click to chat" link, `wa.me` requires the number in plain international
 * digits with no `+`, spaces, or separators. These helpers do that conversion
 * and decide whether a usable number exists at all, so the UI can hide the
 * contact button when it does not. They are dependency-free and unit-tested.
 */

/** Minimum plausible digit count for an international subscriber number. */
const MIN_DIGITS = 7
/** E.164 caps a full international number (country + national) at 15 digits. */
const MAX_DIGITS = 15

/**
 * Converts a stored phone string into the digits-only form `wa.me` expects, or
 * `null` when the input cannot be a valid phone number. Every non-digit
 * character (including a leading `+`, spaces, dashes, and parentheses) is
 * stripped; the result must then contain {@link MIN_DIGITS}-{@link MAX_DIGITS}
 * digits to be considered usable.
 *
 * Validity is purely length-based: no country code is inferred, so a number
 * stored without one keeps its digits unchanged. This avoids guessing a locale
 * and silently producing a wrong link.
 *
 * @param phone - The stored phone string, possibly `null`.
 * @returns The digits-only WhatsApp number, or `null` if it is not valid.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null
  return digits
}

/**
 * Whether a stored phone string yields a valid WhatsApp number. Drives the
 * decision to render (or hide) the WhatsApp contact button.
 *
 * @param phone - The stored phone string, possibly `null`.
 * @returns `true` when {@link toWhatsAppNumber} would return a number.
 */
export function hasWhatsAppNumber(phone: string | null | undefined): boolean {
  return toWhatsAppNumber(phone) !== null
}

/**
 * Builds a `wa.me` "click to chat" deep link for a stored phone string, or
 * `null` when the number is invalid (so the caller can omit the button rather
 * than render a broken link). An optional prefilled message is URL-encoded and
 * appended as the `text` query parameter.
 *
 * @param phone - The stored phone string, possibly `null`.
 * @param message - Optional prefilled chat message.
 * @returns The WhatsApp deep link, or `null` if the number is invalid.
 */
export function whatsAppLink(
  phone: string | null | undefined,
  message?: string
): string | null {
  const number = toWhatsAppNumber(phone)
  if (!number) return null
  const base = `https://wa.me/${number}`
  if (message && message.trim() !== "") {
    return `${base}?text=${encodeURIComponent(message)}`
  }
  return base
}
