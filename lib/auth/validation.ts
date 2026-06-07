const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

/**
 * True when `email` looks like a valid address. Trims before testing.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

/**
 * Normalizes a phone number for storage: keeps a single leading `+` if present
 * and strips every other non-digit character.
 */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim()
  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  return hasPlus ? `+${digits}` : digits
}
