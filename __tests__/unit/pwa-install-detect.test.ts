import { describe, expect, it } from "vitest"

import { isIos, isStandalone, type InstallGlobals } from "@/lib/pwa/install"

/**
 * Unit tests for the pure install-detection helpers, driven with fake globals so
 * every branch (standalone via media query, standalone via iOS flag, iOS UA
 * detection) is covered without a real browser.
 */
describe("isStandalone", () => {
  it("is true when display-mode: standalone matches", () => {
    const globals: InstallGlobals = {
      matchMedia: (q) => ({ matches: q === "(display-mode: standalone)" }),
    }
    expect(isStandalone(globals)).toBe(true)
  })

  it("is true when the iOS navigator.standalone flag is set", () => {
    expect(isStandalone({ navigatorStandalone: true })).toBe(true)
  })

  it("is false in a normal browser tab", () => {
    expect(isStandalone({ matchMedia: () => ({ matches: false }) })).toBe(false)
  })

  it("is false with no globals (SSR)", () => {
    expect(isStandalone()).toBe(false)
  })
})

describe("isIos", () => {
  it.each([
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15",
  ])("detects iOS user agents", (ua) => {
    expect(isIos({ userAgent: ua })).toBe(true)
  })

  it("is false for desktop Chrome", () => {
    expect(
      isIos({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0",
      })
    ).toBe(false)
  })

  it("is false with no user agent", () => {
    expect(isIos()).toBe(false)
  })
})
