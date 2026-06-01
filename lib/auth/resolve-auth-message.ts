/**
 * Maps a stable auth notice/error code (carried in a URL query param by the
 * auth server actions) to a fixed, user-facing English string.
 *
 * Actions redirect with codes (e.g. `invalidCredentials`, `resetLinkSent`)
 * rather than literal text, and only known codes render. An unknown or
 * hand-crafted query param yields `null` and renders nothing, so a forged
 * `?error=...` cannot reflect arbitrary text into the page.
 */
const MESSAGES: Record<string, string> = {
  // sign-in / sign-up
  credentialsRequired: "Email and password are required.",
  invalidEmail: "Enter a valid email address.",
  passwordTooShort: "Password must be at least 8 characters.",
  invalidCredentials: "Invalid email or password.",
  signupFailed: "Could not create your account. Please try again.",
  checkEmailToConfirm: "Check your email to confirm your account.",
  accountMaybeExists:
    "If this is a new account, check your email to confirm it. If you already have an account, sign in or reset your password.",
  signInToContinue: "Please sign in to continue.",
  // password reset
  resetLinkSent:
    "If an account exists for that email, we've sent a reset link.",
  resetLinkInvalid: "That reset link is invalid or has expired.",
  passwordsDoNotMatch: "Passwords do not match.",
  updateFailed: "Could not update your password. Please try again.",
  passwordUpdated: "Password updated, please sign in.",
}

export function resolveAuthMessage(code: string | undefined): string | null {
  if (!code) return null
  return MESSAGES[code] ?? null
}
