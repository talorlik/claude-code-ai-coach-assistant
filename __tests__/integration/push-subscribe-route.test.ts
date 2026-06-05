import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the protected subscribe/unsubscribe routes. The Supabase
 * auth client and the subscriptions data access are mocked. The tests assert the
 * route contract:
 *
 * - 401 for an unauthenticated caller, with nothing persisted;
 * - 503 when VAPID is unconfigured (subscribe);
 * - 400 for a malformed payload, with nothing persisted (subscribe);
 * - 200 + persisted row for a valid payload (subscribe);
 * - 400 for a missing endpoint (unsubscribe);
 * - 200 + disable for a valid unsubscribe.
 */

// --- Auth seam ----------------------------------------------------------------
let currentUser: { id: string } | null
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}))

// --- Data access seam ---------------------------------------------------------
const saved: Array<{ clientId: string; endpoint: string }> = []
const disabled: Array<{ clientId: string; endpoint: string }> = []
vi.mock("@/lib/db/push-subscriptions", () => ({
  savePushSubscription: vi.fn(
    async (
      clientId: string,
      sub: { endpoint: string; p256dh: string; auth: string }
    ) => {
      saved.push({ clientId, endpoint: sub.endpoint })
      return { id: "saved-1", client_id: clientId, ...sub, enabled: true }
    }
  ),
  disablePushSubscription: vi.fn(async (clientId: string, endpoint: string) => {
    disabled.push({ clientId, endpoint })
  }),
}))

import { POST as subscribe } from "@/app/api/push/subscribe/route"
import { POST as unsubscribe } from "@/app/api/push/unsubscribe/route"

const validBody = {
  endpoint: "https://fcm.googleapis.com/fcm/send/x",
  keys: { p256dh: "key-p", auth: "key-a" },
}

function jsonReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  currentUser = null
  saved.length = 0
  disabled.length = 0
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"
  process.env.VAPID_PRIVATE_KEY = "priv"
})

describe("subscribe route", () => {
  it("rejects an unauthenticated caller with 401 and persists nothing", async () => {
    const res = await subscribe(
      jsonReq("https://app.test/api/push/subscribe", validBody)
    )
    expect(res.status).toBe(401)
    expect(saved).toEqual([])
  })

  it("returns 503 when VAPID is not configured", async () => {
    currentUser = { id: "client-1" }
    delete process.env.VAPID_PRIVATE_KEY
    const res = await subscribe(
      jsonReq("https://app.test/api/push/subscribe", validBody)
    )
    expect(res.status).toBe(503)
    expect(saved).toEqual([])
  })

  it("returns 400 for a malformed payload and persists nothing", async () => {
    currentUser = { id: "client-1" }
    const res = await subscribe(
      jsonReq("https://app.test/api/push/subscribe", { endpoint: "" })
    )
    expect(res.status).toBe(400)
    expect(saved).toEqual([])
  })

  it("persists a valid subscription under the caller's id", async () => {
    currentUser = { id: "client-1" }
    const res = await subscribe(
      jsonReq("https://app.test/api/push/subscribe", validBody)
    )
    expect(res.status).toBe(200)
    expect(saved).toEqual([
      { clientId: "client-1", endpoint: validBody.endpoint },
    ])
  })
})

describe("unsubscribe route", () => {
  it("rejects an unauthenticated caller with 401", async () => {
    const res = await unsubscribe(
      jsonReq("https://app.test/api/push/unsubscribe", {
        endpoint: validBody.endpoint,
      })
    )
    expect(res.status).toBe(401)
    expect(disabled).toEqual([])
  })

  it("returns 400 when the endpoint is missing", async () => {
    currentUser = { id: "client-1" }
    const res = await unsubscribe(
      jsonReq("https://app.test/api/push/unsubscribe", {})
    )
    expect(res.status).toBe(400)
    expect(disabled).toEqual([])
  })

  it("disables the caller's subscription by endpoint", async () => {
    currentUser = { id: "client-1" }
    const res = await unsubscribe(
      jsonReq("https://app.test/api/push/unsubscribe", {
        endpoint: validBody.endpoint,
      })
    )
    expect(res.status).toBe(200)
    expect(disabled).toEqual([
      { clientId: "client-1", endpoint: validBody.endpoint },
    ])
  })
})
