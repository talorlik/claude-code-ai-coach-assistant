/**
 * Browser-side helpers for the push opt-in flow: registering the service worker,
 * requesting permission, subscribing via the Push API, and posting the
 * subscription to the protected routes. Kept out of the React component so the
 * imperative browser glue is testable and the component stays declarative.
 *
 * All functions here assume push is supported; callers must gate on
 * {@link isPushSupported} first and show the unsupported state otherwise.
 */

import { readPushPermission, type PushPermission } from "@/lib/push/support"

/** Path of the statically served service worker. */
const SERVICE_WORKER_URL = "/sw.js"

/**
 * Converts a base64url VAPID public key to the `Uint8Array` the Push API's
 * `applicationServerKey` expects. Web Push keys are base64url; the browser API
 * predates that and wants raw bytes.
 *
 * @param base64 - The base64url-encoded VAPID public key.
 * @returns The decoded key bytes.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(normalized)
  // Allocate over an explicit ArrayBuffer so the type is `Uint8Array<ArrayBuffer>`,
  // which is what the Push API's `applicationServerKey` (BufferSource) requires.
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

/**
 * Registers the service worker and resolves once it is ready. Idempotent: the
 * browser deduplicates registration of the same script.
 *
 * @returns The ready service worker registration.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(SERVICE_WORKER_URL)
  return navigator.serviceWorker.ready
}

/**
 * Requests notification permission from the user. Returns the resulting
 * permission state without throwing, so the caller can branch on `granted` vs
 * `denied`/`default`.
 *
 * @returns The permission state after the prompt.
 */
export async function requestPermission(): Promise<PushPermission> {
  const result = await Notification.requestPermission()
  return result as PushPermission
}

/**
 * Runs the full opt-in: requests permission, registers the worker, subscribes to
 * the Push API with the VAPID public key, and POSTs the subscription to
 * `/api/push/subscribe`. Returns the subscription's endpoint on success (used as
 * the unsubscribe key) or `null` when permission was not granted.
 *
 * @param vapidPublicKey - The base64url VAPID public application server key.
 * @returns The subscribed endpoint, or `null` if permission was denied.
 * @throws When subscribing or persisting fails after permission was granted.
 */
export async function enablePush(
  vapidPublicKey: string
): Promise<string | null> {
  const permission = await requestPermission()
  if (permission !== "granted") {
    return null
  }

  const registration = await registerServiceWorker()
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (!response.ok) {
    throw new Error(`Failed to save subscription (${response.status})`)
  }

  return subscription.endpoint
}

/**
 * Tears down the opt-in: unsubscribes from the Push API and tells the server to
 * disable the stored row. Best-effort on the browser side (an already-removed
 * subscription is fine); the server disable is the authoritative stop.
 *
 * @returns Nothing; resolves when both sides have been told to stop.
 */
export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe().catch(() => undefined)
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint }),
  })
}

/**
 * Reports the current opt-in state for initial render: whether permission is
 * granted and whether an active subscription already exists. Lets the settings
 * UI show the correct toggle position on load.
 *
 * @returns The current permission and whether a subscription is active.
 */
export async function readPushState(): Promise<{
  permission: PushPermission
  subscribed: boolean
}> {
  const permission = readPushPermission()
  let subscribed = false
  if (permission === "granted") {
    const registration = await navigator.serviceWorker.ready.catch(
      () => null
    )
    const subscription = await registration?.pushManager
      .getSubscription()
      .catch(() => null)
    subscribed = subscription != null
  }
  return { permission, subscribed }
}
