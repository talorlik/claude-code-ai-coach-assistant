/**
 * Pure detection helpers for the install affordance. Injectable globals keep
 * them unit-testable (mirroring `lib/push/support.ts`): the component passes the
 * real `window`/`navigator`, tests pass fakes.
 */

/** The browser surface the install detection helpers read. */
export interface InstallGlobals {
  /** `window.matchMedia`, used to detect `display-mode: standalone`. */
  matchMedia?: (query: string) => { matches: boolean }
  /** `navigator.standalone`, the iOS-Safari home-screen flag. */
  navigatorStandalone?: boolean
  /** `navigator.userAgent`, used to detect iOS Safari (no `beforeinstallprompt`). */
  userAgent?: string
}

/**
 * Reports whether the app is already running as an installed PWA. True when the
 * `display-mode: standalone` media query matches (Chromium/Android/desktop) or
 * the iOS-only `navigator.standalone` flag is set. When installed, the install
 * affordance must hide itself.
 *
 * @param globals - The browser capabilities to test; defaults to empty so an
 *   SSR call reports "not standalone" without throwing.
 * @returns `true` when the app is running in standalone (installed) mode.
 */
export function isStandalone(globals: InstallGlobals = {}): boolean {
  if (globals.navigatorStandalone === true) return true
  const mm = globals.matchMedia
  if (typeof mm === "function") {
    try {
      return mm("(display-mode: standalone)").matches === true
    } catch {
      return false
    }
  }
  return false
}

/**
 * Detects iOS Safari, where `beforeinstallprompt` does not exist and the user
 * must install via the Share -> "Add to Home Screen" flow. Drives the component
 * to show manual instructions instead of a one-tap install button.
 *
 * @param globals - The browser capabilities to test; defaults to empty.
 * @returns `true` when the user agent looks like iOS (iPhone/iPad/iPod).
 */
export function isIos(globals: InstallGlobals = {}): boolean {
  const ua = globals.userAgent ?? ""
  // iPadOS 13+ reports as "Macintosh"; the touch check would disambiguate, but
  // the UA test covers iPhone/iPod and pre-13 iPad, which is the population that
  // genuinely lacks `beforeinstallprompt`. False positives only show extra
  // instructions, never a broken button.
  return /iphone|ipad|ipod/i.test(ua)
}

/**
 * Reads the live browser globals for install detection, or an all-undefined
 * object outside a browser so the detection helpers report safe defaults on the
 * server.
 *
 * @returns The detected {@link InstallGlobals} for the current environment.
 */
export function readInstallGlobals(): InstallGlobals {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {}
  }
  return {
    matchMedia: window.matchMedia?.bind(window),
    navigatorStandalone: (navigator as { standalone?: boolean }).standalone,
    userAgent: navigator.userAgent,
  }
}
