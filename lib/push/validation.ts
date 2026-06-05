/**
 * Validation and normalization for incoming Web Push subscription payloads.
 * These helpers are pure (no I/O) so they are unit-testable and reusable from
 * both the subscribe route and tests. They are the trust boundary for what the
 * browser posts: the subscribe route must never persist a malformed subscription,
 * because a row missing `endpoint`/`p256dh`/`auth` can never receive a push and
 * a duplicate or oversized endpoint corrupts the table.
 */

import { fail, ok, type ActionResult } from "@/lib/types/action-result"

/** The normalized subscription fields stored in `push_subscriptions`. */
export interface NormalizedPushSubscription {
  /** The unique push service endpoint URL. */
  endpoint: string
  /** The client public key (base64url) used to encrypt the payload. */
  p256dh: string
  /** The client auth secret (base64url). */
  auth: string
}

/** Defensive upper bound on the endpoint length to reject absurd payloads. */
const MAX_ENDPOINT_LENGTH = 2048

/** Defensive upper bound on a key length (p256dh/auth are short base64url). */
const MAX_KEY_LENGTH = 512

/**
 * Reads a string property from an unknown object, returning `""` when absent or
 * not a string. Centralizes the unsafe access so the validator stays readable.
 */
function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Validates and normalizes a raw subscription payload from the browser, which is
 * the JSON form of a `PushSubscription` (`{ endpoint, keys: { p256dh, auth } }`).
 * On success returns the three fields trimmed and shape-checked; on failure
 * returns a user-safe error keyed by the offending field, so the subscribe route
 * can return a 400 without persisting anything.
 *
 * @param raw - The parsed request body, of unknown shape.
 * @returns An {@link ActionResult} carrying the normalized subscription or an error.
 */
export function validatePushSubscription(
  raw: unknown
): ActionResult<NormalizedPushSubscription> {
  if (raw == null || typeof raw !== "object") {
    return fail("Invalid subscription payload")
  }

  const body = raw as Record<string, unknown>
  const endpoint = readString(body, "endpoint")
  const keys =
    body.keys && typeof body.keys === "object"
      ? (body.keys as Record<string, unknown>)
      : {}
  const p256dh = readString(keys, "p256dh")
  const auth = readString(keys, "auth")

  if (endpoint === "") {
    return fail("Missing subscription endpoint", { endpoint: "required" })
  }
  if (!isHttpsUrl(endpoint)) {
    return fail("Invalid subscription endpoint", { endpoint: "invalid" })
  }
  if (endpoint.length > MAX_ENDPOINT_LENGTH) {
    return fail("Subscription endpoint too long", { endpoint: "tooLong" })
  }
  if (p256dh === "" || auth === "") {
    return fail("Missing subscription keys", { keys: "required" })
  }
  if (p256dh.length > MAX_KEY_LENGTH || auth.length > MAX_KEY_LENGTH) {
    return fail("Subscription keys too long", { keys: "tooLong" })
  }

  return ok({ endpoint, p256dh, auth })
}

/** Returns whether a string is a syntactically valid `https:` URL. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}
