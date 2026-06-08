/**
 * Stable notice/error codes the contact server action may carry in a URL query
 * param (e.g. `?notice=contact_sent`, `?error=invalid_email`).
 *
 * The action redirects with one of these codes rather than literal text. Only
 * codes in this allowlist resolve to a message; an unknown or hand-crafted query
 * param resolves to `null` and renders nothing, so a forged `?error=...` cannot
 * reflect arbitrary text into the page. Each code maps to a message key in the
 * `Contact.messages` namespace of `messages/<locale>.json`, which supplies the
 * localized, user-facing text. The URL codes use snake_case; the translator keys
 * are camelCase, so {@link CODE_TO_KEY} bridges the two.
 */
export const CONTACT_MESSAGE_CODES = [
  "contact_sent",
  "missing_fields",
  "invalid_email",
  "send_failed",
] as const

/** A recognized contact message code as it appears in the URL. */
export type ContactMessageCode = (typeof CONTACT_MESSAGE_CODES)[number]

/** Maps each URL code to its `Contact.messages.<key>` translation key. */
const CODE_TO_KEY = {
  contact_sent: "contactSent",
  missing_fields: "missingFields",
  invalid_email: "invalidEmail",
  send_failed: "sendFailed",
} as const

/** A translation key under the `Contact.messages` namespace. */
export type ContactMessageKey = (typeof CODE_TO_KEY)[ContactMessageCode]

const CODE_SET = new Set<string>(CONTACT_MESSAGE_CODES)

/**
 * Narrows an arbitrary query-param string to a known {@link ContactMessageCode}.
 *
 * @param code - The raw value of an `error`/`notice` query param.
 * @returns `true` when `code` is in the allowlist.
 */
export function isContactMessageCode(
  code: string | undefined
): code is ContactMessageCode {
  return code !== undefined && CODE_SET.has(code)
}

/**
 * Resolves a stable contact code to its localized, user-facing string using a
 * next-intl translator bound to the `Contact.messages` namespace.
 *
 * The allowlist check happens before translation, so only known codes produce
 * text; anything else yields `null` and the caller renders nothing. This keeps
 * the anti-injection property: a forged `?error=<script>` never reaches the
 * translator.
 *
 * @param translate - A translator for the `Contact.messages` namespace, e.g.
 *   from `getTranslations("Contact.messages")`.
 * @param code - The raw `error`/`notice` query-param value.
 * @returns The localized message, or `null` for an absent/unknown code.
 */
export function resolveContactMessage(
  translate: (key: ContactMessageKey) => string,
  code: string | undefined
): string | null {
  if (!isContactMessageCode(code)) return null
  return translate(CODE_TO_KEY[code])
}

/** Whether a resolved code represents the success notice (vs. an error). */
export function isContactSuccess(code: string | undefined): boolean {
  return code === "contact_sent"
}
