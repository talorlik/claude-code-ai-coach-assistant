/**
 * VAPID environment-variable handling for Web Push. Web Push requires a VAPID
 * key pair to authenticate the application server to the push service. The
 * public key is safe to expose to the browser (it is sent with the subscription
 * request); the private key is server-only and must never reach the client.
 *
 * Naming follows the rest of the app: the browser-visible value uses the
 * `NEXT_PUBLIC_` prefix, the secret does not.
 */

/** The configured VAPID key pair plus the contact subject. */
export interface VapidConfig {
  /** Public application server key (base64url); safe in the browser. */
  publicKey: string
  /** Private application server key (base64url); server-only secret. */
  privateKey: string
  /** `mailto:` or URL contact, sent to the push service as `subject`. */
  subject: string
}

/** The browser-visible VAPID public key, or empty string when unconfigured. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

/**
 * Reads and validates the full server-side VAPID configuration. Throws a
 * descriptive error when any required variable is missing so server routes fail
 * loudly at the point of use rather than silently sending no notifications. Only
 * call this on the server (subscribe send / reminder trigger); the private key
 * must never be read in client code.
 *
 * @returns The validated {@link VapidConfig}.
 * @throws When `NEXT_PUBLIC_VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY` is unset.
 */
export function requireVapidConfig(): VapidConfig {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? ""
  // A sensible default subject; override with VAPID_SUBJECT for production.
  const subject = process.env.VAPID_SUBJECT ?? "mailto:talorlik@gmail.com"

  const missing: string[] = []
  if (publicKey === "") missing.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY")
  if (privateKey === "") missing.push("VAPID_PRIVATE_KEY")
  if (missing.length > 0) {
    throw new Error(`Missing VAPID configuration: ${missing.join(", ")}`)
  }

  return { publicKey, privateKey, subject }
}

/**
 * Reports whether push is configured server-side without throwing. Routes use
 * this to return a clean "push not configured" response (503) instead of a 500
 * when the deployment has not set up VAPID keys yet.
 *
 * @returns `true` when both VAPID keys are present in the environment.
 */
export function isPushConfigured(): boolean {
  return (
    (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "") !== "" &&
    (process.env.VAPID_PRIVATE_KEY ?? "") !== ""
  )
}
