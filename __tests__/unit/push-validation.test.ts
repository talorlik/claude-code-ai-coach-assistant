import { describe, expect, it } from "vitest"

import { validatePushSubscription } from "@/lib/push/validation"

/**
 * Unit tests for the subscription payload validator. It is the trust boundary
 * for what the subscribe route persists, so the tests cover the happy path plus
 * every rejection: non-object, missing/invalid/oversized endpoint, and
 * missing/oversized keys. A rejected payload must carry a field error and never
 * yield a normalized result.
 */

/** A well-formed browser subscription payload. */
function validPayload() {
  return {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    keys: { p256dh: "BNcRdreALR", auth: "tBHItJI5sv" },
  }
}

describe("validatePushSubscription", () => {
  it("normalizes a well-formed payload", () => {
    const result = validatePushSubscription(validPayload())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        p256dh: "BNcRdreALR",
        auth: "tBHItJI5sv",
      })
    }
  })

  it("trims surrounding whitespace on the fields", () => {
    const result = validatePushSubscription({
      endpoint: "  https://example.com/p  ",
      keys: { p256dh: " key ", auth: " a " },
    })
    expect(result.ok && result.data.endpoint).toBe("https://example.com/p")
  })

  it("rejects a non-object payload", () => {
    expect(validatePushSubscription(null).ok).toBe(false)
    expect(validatePushSubscription("nope").ok).toBe(false)
  })

  it("rejects a missing endpoint with a field error", () => {
    const result = validatePushSubscription({ keys: { p256dh: "x", auth: "y" } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.endpoint).toBe("required")
  })

  it("rejects a non-https endpoint", () => {
    const result = validatePushSubscription({
      endpoint: "http://insecure.example.com/p",
      keys: { p256dh: "x", auth: "y" },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.endpoint).toBe("invalid")
  })

  it("rejects an oversized endpoint", () => {
    const result = validatePushSubscription({
      endpoint: "https://e.example.com/" + "a".repeat(3000),
      keys: { p256dh: "x", auth: "y" },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.endpoint).toBe("tooLong")
  })

  it("rejects missing keys", () => {
    const result = validatePushSubscription({
      endpoint: "https://example.com/p",
      keys: { p256dh: "", auth: "" },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.keys).toBe("required")
  })

  it("rejects oversized keys", () => {
    const result = validatePushSubscription({
      endpoint: "https://example.com/p",
      keys: { p256dh: "a".repeat(600), auth: "b" },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors?.keys).toBe("tooLong")
  })
})
