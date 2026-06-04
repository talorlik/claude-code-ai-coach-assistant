/**
 * Stable auth notice/error codes that the auth server actions may carry in a URL
 * query param (e.g. `?error=invalidCredentials`, `?notice=resetLinkSent`).
 *
 * Actions redirect with one of these codes rather than literal text. Only codes
 * in this allowlist resolve to a message; an unknown or hand-crafted query param
 * resolves to `null` and renders nothing, so a forged `?error=...` cannot
 * reflect arbitrary text into the page. The codes double as the message keys in
 * the `AuthMessages` namespace of `messages/<locale>.json`, which supplies the
 * localized, user-facing text.
 */
export const AUTH_MESSAGE_CODES = [
  // sign-in / sign-up
  "credentialsRequired",
  "invalidEmail",
  "passwordTooShort",
  "invalidCredentials",
  "signupFailed",
  "checkEmailToConfirm",
  "accountMaybeExists",
  "signInToContinue",
  // password reset
  "resetLinkSent",
  "resetLinkInvalid",
  "passwordsDoNotMatch",
  "updateFailed",
  "passwordUpdated",
] as const

/** A recognized auth message code. */
export type AuthMessageCode = (typeof AUTH_MESSAGE_CODES)[number]

const CODE_SET = new Set<string>(AUTH_MESSAGE_CODES)

/**
 * Narrows an arbitrary query-param string to a known {@link AuthMessageCode}.
 *
 * @param code - The raw value of an `error`/`notice` query param.
 * @returns `true` when `code` is in the allowlist.
 */
export function isAuthMessageCode(
  code: string | undefined
): code is AuthMessageCode {
  return code !== undefined && CODE_SET.has(code)
}

/**
 * Resolves a stable auth code to its localized, user-facing string using a
 * next-intl translator bound to the `AuthMessages` namespace.
 *
 * The allowlist check happens before translation, so only known codes produce
 * text; anything else yields `null` and the caller renders nothing. This keeps
 * the anti-injection property: a forged `?error=<script>` never reaches the
 * translator.
 *
 * @param translate - A translator for the `AuthMessages` namespace, e.g. from
 *   `getTranslations("AuthMessages")` (server) or `useTranslations` (client).
 * @param code - The raw `error`/`notice` query-param value.
 * @returns The localized message, or `null` for an absent/unknown code.
 */
export function resolveAuthMessage(
  translate: (key: AuthMessageCode) => string,
  code: string | undefined
): string | null {
  if (!isAuthMessageCode(code)) return null
  return translate(code)
}
