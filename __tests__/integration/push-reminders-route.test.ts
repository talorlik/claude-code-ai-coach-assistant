import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the protected reminder-trigger route. No network or push
 * service is touched: the role helper, the subscriptions data access, and the
 * web-push send wrapper are all mocked. The tests assert the route contract:
 *
 * - rejects an unauthenticated, non-cron request with 401 and sends nothing;
 * - accepts the `Bearer ${CRON_SECRET}` header (cron path) and fans out;
 * - accepts a trainer-admin session (manual path);
 * - returns 503 when VAPID is not configured;
 * - disables endpoints the push service reports as gone (404/410).
 */

// --- Role seam ----------------------------------------------------------------
let isAdminSession: boolean
vi.mock("@/lib/auth/roles", () => ({
  getCurrentUserRole: vi.fn(async () => ({
    userId: isAdminSession ? "admin-1" : null,
    isAdmin: isAdminSession,
  })),
}))

// --- Data access seam ---------------------------------------------------------
const disabled: Array<{ clientId: string; endpoint: string }> = []
let enabledRows: Array<Record<string, unknown>>
vi.mock("@/lib/db/push-subscriptions", () => ({
  listAllEnabledSubscriptions: vi.fn(async () => enabledRows),
  disablePushSubscription: vi.fn(async (clientId: string, endpoint: string) => {
    disabled.push({ clientId, endpoint })
  }),
}))

// --- web-push send seam -------------------------------------------------------
const sent: string[] = []
let goneEndpoints: Set<string>
vi.mock("@/lib/push/web-push", () => ({
  sendReminder: vi.fn(async (row: { endpoint: string; client_id: string }) => {
    if (goneEndpoints.has(row.endpoint)) {
      return { endpoint: row.endpoint, ok: false, statusCode: 410, gone: true }
    }
    sent.push(row.endpoint)
    return { endpoint: row.endpoint, ok: true, statusCode: 201 }
  }),
}))

import { GET, POST } from "@/app/api/push/reminders/route"

function row(id: string, endpoint: string) {
  return {
    id,
    client_id: `client-${id}`,
    endpoint,
    p256dh: "p",
    auth: "a",
    enabled: true,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
  }
}

beforeEach(() => {
  isAdminSession = false
  enabledRows = []
  goneEndpoints = new Set()
  sent.length = 0
  disabled.length = 0
  // Configure VAPID + cron secret for the configured-path tests.
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"
  process.env.VAPID_PRIVATE_KEY = "priv"
  process.env.CRON_SECRET = "s3cret"
})

function req(headers: Record<string, string> = {}) {
  return new Request("https://app.test/api/push/reminders", { headers })
}

describe("reminder route authorization", () => {
  it("rejects an unauthenticated, non-cron request with 401 and sends nothing", async () => {
    enabledRows = [row("1", "https://a/1")]
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(sent).toEqual([])
  })

  it("accepts the cron Bearer secret and fans out to all enabled endpoints", async () => {
    enabledRows = [row("1", "https://a/1"), row("2", "https://a/2")]
    const res = await GET(req({ authorization: "Bearer s3cret" }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { sent: number; total: number }
    expect(body.total).toBe(2)
    expect(body.sent).toBe(2)
    expect(sent).toEqual(["https://a/1", "https://a/2"])
  })

  it("accepts a trainer-admin session for manual triggering", async () => {
    isAdminSession = true
    enabledRows = [row("1", "https://a/1")]
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(sent).toEqual(["https://a/1"])
  })
})

describe("reminder route behavior", () => {
  it("returns 503 when VAPID is not configured", async () => {
    delete process.env.VAPID_PRIVATE_KEY
    const res = await GET(req({ authorization: "Bearer s3cret" }))
    expect(res.status).toBe(503)
  })

  it("disables endpoints the push service reports as gone", async () => {
    enabledRows = [row("1", "https://a/1"), row("2", "https://gone/2")]
    goneEndpoints = new Set(["https://gone/2"])
    const res = await GET(req({ authorization: "Bearer s3cret" }))
    const body = (await res.json()) as { sent: number; pruned: number }
    expect(body.sent).toBe(1)
    expect(body.pruned).toBe(1)
    expect(disabled).toEqual([
      { clientId: "client-2", endpoint: "https://gone/2" },
    ])
  })
})
