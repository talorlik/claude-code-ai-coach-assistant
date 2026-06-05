import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { isPushConfigured, requireVapidConfig } from "@/lib/push/env"

/**
 * Unit tests for the server-side VAPID environment helpers. They drive the
 * helpers by mutating `process.env` around each case so both the configured and
 * unconfigured paths are covered without real keys. The original environment is
 * restored after each test to avoid cross-test leakage.
 */

const VAPID_VARS = [
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
] as const

let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = {}
  for (const key of VAPID_VARS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of VAPID_VARS) {
    if (saved[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = saved[key]
    }
  }
})

describe("isPushConfigured", () => {
  it("is false when neither VAPID key is set", () => {
    expect(isPushConfigured()).toBe(false)
  })

  it("is false when only the public key is set", () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"
    expect(isPushConfigured()).toBe(false)
  })

  it("is false when only the private key is set", () => {
    process.env.VAPID_PRIVATE_KEY = "priv"
    expect(isPushConfigured()).toBe(false)
  })

  it("is true only when both keys are set", () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"
    process.env.VAPID_PRIVATE_KEY = "priv"
    expect(isPushConfigured()).toBe(true)
  })
})

describe("requireVapidConfig", () => {
  it("throws listing every missing variable when unconfigured", () => {
    expect(() => requireVapidConfig()).toThrowError(
      /NEXT_PUBLIC_VAPID_PUBLIC_KEY.*VAPID_PRIVATE_KEY/
    )
  })

  it("throws naming only the missing variable", () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"
    expect(() => requireVapidConfig()).toThrowError(/VAPID_PRIVATE_KEY/)
    expect(() => requireVapidConfig()).not.toThrowError(
      /NEXT_PUBLIC_VAPID_PUBLIC_KEY/
    )
  })

  it("returns the keys and a default subject when both keys are set", () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"
    process.env.VAPID_PRIVATE_KEY = "priv"
    const config = requireVapidConfig()
    expect(config.publicKey).toBe("pub")
    expect(config.privateKey).toBe("priv")
    // Default contact subject is a mailto: so the push service has a contact.
    expect(config.subject).toMatch(/^mailto:/)
  })

  it("honors an explicit VAPID_SUBJECT override", () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"
    process.env.VAPID_PRIVATE_KEY = "priv"
    process.env.VAPID_SUBJECT = "mailto:coach@example.com"
    expect(requireVapidConfig().subject).toBe("mailto:coach@example.com")
  })
})
