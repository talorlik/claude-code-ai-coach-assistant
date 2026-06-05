import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the push-subscriptions data access. A fake Supabase
 * client models the `push_subscriptions` table behind its "Clients manage own
 * push subscriptions" RLS policy. The fake records the operation issued
 * (upsert/update/select) and the filters/payload applied, and returns canned
 * rows scoped the way RLS would:
 *
 * - Owner client: upsert/update/select succeed and rows are returned.
 * - Non-owner client: RLS exposes no rows, so a list returns `[]` - the
 *   data-layer backstop behind the route's auth guard.
 */

interface Op {
  type: "select" | "upsert" | "update"
  filters: Record<string, string>
  payload?: Record<string, unknown>
  onConflict?: string
}

let rows: Record<string, unknown>[]
let rlsHidesRows: boolean
let lastOp: Op | null
let forcedError: { message: string } | null

function makeBuilder() {
  const op: Op = { type: "select", filters: {} }
  lastOp = op
  const builder: Record<string, unknown> = {}
  const visible = () => (rlsHidesRows ? [] : rows)

  builder.select = () => builder
  builder.eq = (col: string, val: string) => {
    op.filters[col] = String(val)
    return builder
  }
  builder.upsert = (
    payload: Record<string, unknown>,
    options?: { onConflict?: string }
  ) => {
    op.type = "upsert"
    op.payload = payload
    op.onConflict = options?.onConflict
    return builder
  }
  builder.update = (payload: Record<string, unknown>) => {
    op.type = "update"
    op.payload = payload
    return builder
  }
  builder.single = async () => ({
    data: forcedError ? null : (visible()[0] ?? null),
    error: forcedError,
  })
  // List/update reads are awaited directly (thenable).
  builder.then = (
    resolve: (value: { data: unknown; error: unknown }) => unknown
  ) => resolve({ data: forcedError ? null : visible(), error: forcedError })
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from() {
      return makeBuilder()
    },
  }),
}))

import {
  savePushSubscription,
  disablePushSubscription,
  listEnabledSubscriptions,
  listAllEnabledSubscriptions,
} from "@/lib/db/push-subscriptions"

function subRow(id: string, endpoint: string, enabled = true) {
  return {
    id,
    client_id: "client-1",
    endpoint,
    p256dh: "key-p",
    auth: "key-a",
    enabled,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
  }
}

const validSub = {
  endpoint: "https://fcm.googleapis.com/fcm/send/x",
  p256dh: "key-p",
  auth: "key-a",
}

beforeEach(() => {
  rows = []
  rlsHidesRows = false
  lastOp = null
  forcedError = null
})

describe("savePushSubscription", () => {
  it("upserts the subscription on the endpoint conflict and enables it", async () => {
    rows = [subRow("s1", validSub.endpoint)]
    const result = await savePushSubscription("client-1", validSub)
    expect(result.id).toBe("s1")
    expect(lastOp?.type).toBe("upsert")
    expect(lastOp?.onConflict).toBe("endpoint")
    expect(lastOp?.payload).toMatchObject({
      client_id: "client-1",
      endpoint: validSub.endpoint,
      p256dh: "key-p",
      auth: "key-a",
      enabled: true,
    })
  })

  it("throws loudly on a database error", async () => {
    forcedError = { message: "boom" }
    await expect(savePushSubscription("client-1", validSub)).rejects.toThrow(
      /Failed to save push subscription/
    )
  })
})

describe("disablePushSubscription", () => {
  it("soft-disables the row scoped by client_id and endpoint", async () => {
    rows = [subRow("s1", validSub.endpoint)]
    await disablePushSubscription("client-1", validSub.endpoint)
    expect(lastOp?.type).toBe("update")
    expect(lastOp?.payload).toMatchObject({ enabled: false })
    expect(lastOp?.filters.client_id).toBe("client-1")
    expect(lastOp?.filters.endpoint).toBe(validSub.endpoint)
  })

  it("throws loudly on a database error", async () => {
    forcedError = { message: "boom" }
    await expect(
      disablePushSubscription("client-1", validSub.endpoint)
    ).rejects.toThrow(/Failed to disable push subscription/)
  })
})

describe("listEnabledSubscriptions", () => {
  it("returns the client's enabled subscriptions", async () => {
    rows = [subRow("s1", "https://a/1"), subRow("s2", "https://a/2")]
    const result = await listEnabledSubscriptions("client-1")
    expect(result).toHaveLength(2)
    expect(lastOp?.filters.client_id).toBe("client-1")
    expect(lastOp?.filters.enabled).toBe("true")
  })

  it("returns [] when RLS hides another client's rows", async () => {
    rows = [subRow("s1", "https://a/1")]
    rlsHidesRows = true
    expect(await listEnabledSubscriptions("client-2")).toEqual([])
  })
})

describe("listAllEnabledSubscriptions", () => {
  it("returns all enabled rows (trainer-admin scope) for the reminder fan-out", async () => {
    rows = [subRow("s1", "https://a/1"), subRow("s2", "https://a/2")]
    const result = await listAllEnabledSubscriptions()
    expect(result).toHaveLength(2)
    expect(lastOp?.filters.enabled).toBe("true")
  })
})
