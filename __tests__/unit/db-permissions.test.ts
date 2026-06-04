import { describe, expect, it } from "vitest"

import {
  canAccessClientResource,
  canAccessTrainerOnlyResource,
  canReadTrainerNotes,
  type Viewer,
} from "@/lib/db/permissions"

/**
 * Unit tests for the application-side permission helpers that mirror the RLS
 * ownership model. They assert the same allow/deny decisions RLS enforces in
 * Postgres so server code can pre-check without a round trip.
 */

const client: Viewer = { userId: "client-1", isTrainerAdmin: false }
const otherClient: Viewer = { userId: "client-2", isTrainerAdmin: false }
const admin: Viewer = { userId: "admin-1", isTrainerAdmin: true }
const anon: Viewer = { userId: null, isTrainerAdmin: false }

describe("canAccessClientResource", () => {
  it("allows the owning client", () => {
    expect(canAccessClientResource(client, "client-1")).toBe(true)
  })

  it("denies a different client", () => {
    expect(canAccessClientResource(otherClient, "client-1")).toBe(false)
  })

  it("allows the trainer admin for any owner", () => {
    expect(canAccessClientResource(admin, "client-1")).toBe(true)
    expect(canAccessClientResource(admin, "client-2")).toBe(true)
  })

  it("denies an anonymous viewer", () => {
    expect(canAccessClientResource(anon, "client-1")).toBe(false)
  })
})

describe("canAccessTrainerOnlyResource", () => {
  it("allows only the trainer admin", () => {
    expect(canAccessTrainerOnlyResource(admin)).toBe(true)
    expect(canAccessTrainerOnlyResource(client)).toBe(false)
    expect(canAccessTrainerOnlyResource(anon)).toBe(false)
  })
})

describe("canReadTrainerNotes", () => {
  it("never allows a client, even the owning one", () => {
    expect(canReadTrainerNotes(client)).toBe(false)
    expect(canReadTrainerNotes(otherClient)).toBe(false)
  })

  it("allows the trainer admin", () => {
    expect(canReadTrainerNotes(admin)).toBe(true)
  })
})
