/**
 * Browser capability detection for Web Push. These helpers are pure and take an
 * injectable globals object so they are unit-testable without a real browser:
 * the production call sites pass the actual `window`/`navigator`, while tests
 * pass minimal fakes. Detection is the basis for the graceful unsupported-browser
 * state required by the feature - if any capability is missing the UI must
 * degrade rather than throw.
 */

/** The subset of browser globals push support depends on. */
export interface PushGlobals {
  /** Present when the Service Worker API exists (`navigator.serviceWorker`). */
  serviceWorker?: unknown
  /** Present when the Notification API constructor exists (`window.Notification`). */
  Notification?: unknown
  /** Present when the Push API exists (`window.PushManager`). */
  PushManager?: unknown
}

/**
 * Reports whether the environment supports Web Push end to end. All three of
 * Service Worker, Notification, and PushManager must be present; any one missing
 * means push cannot work and the caller must show the unsupported state.
 *
 * @param globals - The browser capabilities to test; pass `readBrowserGlobals()`
 *   in app code or a fake in tests. Defaults to an empty object so a server-side
 *   call (where none exist) safely reports unsupported.
 * @returns `true` only when Service Worker, Notification, and PushManager all exist.
 */
export function isPushSupported(globals: PushGlobals = {}): boolean {
  return (
    globals.serviceWorker != null &&
    typeof globals.Notification === "function" &&
    typeof globals.PushManager === "function"
  )
}

/**
 * Reads the relevant capabilities from the real browser globals. Returns an
 * all-undefined object when called outside a browser (SSR), so {@link isPushSupported}
 * reports unsupported instead of throwing on a missing `window`/`navigator`.
 *
 * @returns The detected {@link PushGlobals} for the current environment.
 */
export function readBrowserGlobals(): PushGlobals {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {}
  }
  return {
    serviceWorker: navigator.serviceWorker,
    Notification: (window as { Notification?: unknown }).Notification,
    PushManager: (window as { PushManager?: unknown }).PushManager,
  }
}

/** The three states a push permission can be in, mirroring `NotificationPermission`. */
export type PushPermission = "default" | "granted" | "denied"

/**
 * Reads the current notification permission without assuming `Notification`
 * exists. Returns `"default"` when the API is absent so callers can treat an
 * unsupported browser as "not yet granted" and route to the unsupported state.
 *
 * @param globals - The browser capabilities; defaults to the live browser globals.
 * @returns The current permission, or `"default"` when unavailable.
 */
export function readPushPermission(
  globals: PushGlobals = readBrowserGlobals()
): PushPermission {
  const ctor = globals.Notification as
    | { permission?: PushPermission }
    | undefined
  return ctor?.permission ?? "default"
}
