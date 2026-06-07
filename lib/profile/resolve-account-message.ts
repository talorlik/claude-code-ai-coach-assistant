/**
 * Stable account notice/error codes that the profile form server actions may
 * carry in a URL query param (e.g. `?notice=detailsSaved`, `?error=saveFailed`).
 *
 * The FormData-accepting profile wrappers
 * ({@link import("./profile-actions").updateProfileForm} and siblings) redirect
 * with one of these codes rather than literal text, so the `/profile` page can
 * render localized feedback server-side - which is what makes the forms work
 * with JavaScript disabled. Only codes in this allowlist resolve to a message;
 * an unknown or hand-crafted query param resolves to `null` and renders nothing,
 * so a forged `?error=...` cannot reflect arbitrary text into the page. The
 * codes double as the message keys in the `Account` namespace of
 * `messages/<locale>.json`, which supplies the localized, user-facing text.
 *
 * This mirrors {@link import("@/lib/auth/resolve-auth-message")} but is kept as
 * a separate, account-scoped allowlist: the auth localization test asserts the
 * `AuthMessages` namespace has no extra keys, so account codes must not be
 * folded into it.
 */
export const ACCOUNT_MESSAGE_CODES = [
  // success notices, one per form so the page banner is unambiguous
  "detailsSaved",
  "emailConfirmSent",
  "passwordUpdated",
  // validation / failure codes
  "passwordsDoNotMatch",
  "saveFailed",
  "invalidEmail",
  "passwordTooShort",
  "emailUpdateFailed",
  "passwordUpdateFailed",
  // defensive: the page is requireClient()-guarded, so this is rarely reachable
  "signedOut",
] as const

/** A recognized account message code. */
export type AccountMessageCode = (typeof ACCOUNT_MESSAGE_CODES)[number]

const CODE_SET = new Set<string>(ACCOUNT_MESSAGE_CODES)

/**
 * Narrows an arbitrary query-param string to a known {@link AccountMessageCode}.
 *
 * @param code - The raw value of an `error`/`notice` query param.
 * @returns `true` when `code` is in the allowlist.
 */
export function isAccountMessageCode(
  code: string | undefined
): code is AccountMessageCode {
  return code !== undefined && CODE_SET.has(code)
}

/**
 * Resolves a stable account code to its localized, user-facing string using a
 * next-intl translator bound to the `Account` namespace.
 *
 * The allowlist check happens before translation, so only known codes produce
 * text; anything else yields `null` and the caller renders nothing. This keeps
 * the anti-injection property: a forged `?error=<script>` never reaches the
 * translator.
 *
 * @param translate - A translator for the `Account` namespace, e.g. from
 *   `getTranslations("Account")` (server) or `useTranslations` (client).
 * @param code - The raw `error`/`notice` query-param value.
 * @returns The localized message, or `null` for an absent/unknown code.
 */
export function resolveAccountMessage(
  translate: (key: AccountMessageCode) => string,
  code: string | undefined
): string | null {
  if (!isAccountMessageCode(code)) return null
  return translate(code)
}
