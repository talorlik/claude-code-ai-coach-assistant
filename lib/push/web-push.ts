import webpush, { type PushSubscription as WebPushSubscription } from "web-push"

import type { PushSubscriptionRow } from "@/lib/db/types"
import { requireVapidConfig } from "@/lib/push/env"

/**
 * Server-only Web Push delivery. Wraps the `web-push` library so the rest of the
 * app deals in our own row/payload types and never touches the VAPID private key
 * directly. This module must only be imported from server code (routes); the
 * private key is read here via {@link requireVapidConfig}.
 */

/**
 * The notification content delivered to the service worker. Deliberately minimal:
 * a workout reminder carries only a generic title and body plus a deep link. It
 * MUST NOT include any sensitive injury or medical detail (a push payload may be
 * shown on a lock screen and is decrypted on the device), so callers build the
 * body from non-sensitive scheduling copy only.
 */
export interface ReminderPayload {
  /** Short, non-sensitive title (e.g. "Workout reminder"). */
  title: string
  /** Short, non-sensitive body (e.g. "Time for today's session."). */
  body: string
  /** In-app path to open when the notification is clicked (e.g. `/en/my-plan`). */
  url: string
}

/** The result of attempting to deliver one notification to one endpoint. */
export interface DeliveryResult {
  /** The endpoint the attempt targeted. */
  endpoint: string
  /** Whether the push service accepted the message. */
  ok: boolean
  /** HTTP status code from the push service, when available. */
  statusCode?: number
  /** `true` when the endpoint is gone (404/410) and should be disabled. */
  gone?: boolean
}

/** Maps a stored row to the `web-push` subscription shape. */
function toWebPushSubscription(
  row: PushSubscriptionRow
): WebPushSubscription {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  }
}

/**
 * Sends one reminder to one subscription. Configures VAPID per call from the
 * environment (cheap and keeps the secret out of module top-level state). A
 * 404/410 from the push service means the subscription is permanently gone; that
 * is surfaced via {@link DeliveryResult.gone} so the caller can disable the row
 * rather than retrying forever. Other failures are returned as `ok: false`
 * without throwing, so one dead endpoint never aborts a batch of reminders.
 *
 * @param row - The stored subscription to deliver to.
 * @param payload - The non-sensitive reminder content.
 * @returns The {@link DeliveryResult} for this endpoint.
 */
export async function sendReminder(
  row: PushSubscriptionRow,
  payload: ReminderPayload
): Promise<DeliveryResult> {
  const { publicKey, privateKey, subject } = requireVapidConfig()
  webpush.setVapidDetails(subject, publicKey, privateKey)

  try {
    await webpush.sendNotification(
      toWebPushSubscription(row),
      JSON.stringify(payload)
    )
    return { endpoint: row.endpoint, ok: true, statusCode: 201 }
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    const gone = statusCode === 404 || statusCode === 410
    return { endpoint: row.endpoint, ok: false, statusCode, gone }
  }
}
