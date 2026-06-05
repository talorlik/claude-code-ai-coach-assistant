import { describe, expect, it } from "vitest"

import {
  isPushSupported,
  readPushPermission,
  type PushGlobals,
} from "@/lib/push/support"

/**
 * Unit tests for the pure push-support detection helpers. They drive the helpers
 * with fake browser-globals objects so no real browser is needed and every
 * missing-capability permutation is covered - this is the basis for the graceful
 * unsupported-browser state.
 */

/** A globals object with all three capabilities present. */
function fullSupport(): PushGlobals {
  return {
    serviceWorker: {},
    Notification: function Notification() {} as unknown,
    PushManager: function PushManager() {} as unknown,
  }
}

describe("isPushSupported", () => {
  it("returns true when service worker, Notification, and PushManager all exist", () => {
    expect(isPushSupported(fullSupport())).toBe(true)
  })

  it("returns false when serviceWorker is missing", () => {
    const globals = fullSupport()
    delete globals.serviceWorker
    expect(isPushSupported(globals)).toBe(false)
  })

  it("returns false when Notification is missing", () => {
    const globals = fullSupport()
    delete globals.Notification
    expect(isPushSupported(globals)).toBe(false)
  })

  it("returns false when PushManager is missing", () => {
    const globals = fullSupport()
    delete globals.PushManager
    expect(isPushSupported(globals)).toBe(false)
  })

  it("returns false for an empty (server-side) globals object", () => {
    expect(isPushSupported({})).toBe(false)
    expect(isPushSupported()).toBe(false)
  })
})

describe("readPushPermission", () => {
  it("reads the permission from the Notification constructor", () => {
    const globals: PushGlobals = {
      Notification: { permission: "granted" } as unknown,
    }
    expect(readPushPermission(globals)).toBe("granted")
  })

  it("defaults to 'default' when Notification is absent", () => {
    expect(readPushPermission({})).toBe("default")
  })
})
