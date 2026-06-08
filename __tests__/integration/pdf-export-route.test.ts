import { beforeEach, describe, expect, it, vi } from "vitest"

import type { WorkoutPlanPdfData } from "@/lib/pdf/workout-plan-pdf"

/**
 * Integration tests for the protected PDF export route. The auth seam
 * (`getCurrentUserRole`) and the data loader (`loadWorkoutPlanPdfData`) are
 * mocked; the real `pdf-lib` builder runs, so the content-type and the PDF
 * bytes are genuine. The tests assert the route contract:
 *
 * - 401 for an unauthenticated caller (no PDF built);
 * - 403 when a non-admin requests another client's plan (no PDF built);
 * - 404 when the target has no active plan;
 * - 200 + `application/pdf` for a client exporting their own plan;
 * - 200 for a trainer admin exporting another client's plan, loading that
 *   client's id.
 */

// --- Auth seam ----------------------------------------------------------------
let currentRole: { userId: string | null; isAdmin: boolean }
vi.mock("@/lib/auth/roles", () => ({
  getCurrentUserRole: vi.fn(async () => currentRole),
}))

// --- Data loader seam ---------------------------------------------------------
const loadedFor: string[] = []
let planData: WorkoutPlanPdfData | null
vi.mock("@/lib/pdf/load-plan-pdf-data", () => ({
  loadWorkoutPlanPdfData: vi.fn(async (clientId: string) => {
    loadedFor.push(clientId)
    return planData
  }),
}))

import { GET } from "@/app/api/pdf/workout-plan/route"

const SAMPLE: WorkoutPlanPdfData = {
  clientName: "Dana Levi",
  planTitle: "Strength Builder",
  generatedAt: new Date("2026-06-05T00:00:00.000Z"),
  onboarding: null,
  workouts: [
    {
      dayOfWeek: "monday",
      title: "Push Day",
      focus: "Chest",
      notes: null,
      exercises: [
        {
          name: "Bench Press",
          sets: 4,
          reps: "8-10",
          duration: null,
          rest: "90s",
          instructions: "Keep your back flat.",
          safetyNotes: "Use a spotter.",
        },
      ],
    },
  ],
}

function get(query: string): Request {
  return new Request(`https://app.test/api/pdf/workout-plan${query}`)
}

beforeEach(() => {
  currentRole = { userId: null, isAdmin: false }
  planData = SAMPLE
  loadedFor.length = 0
})

describe("workout-plan PDF export route", () => {
  it("rejects an unauthenticated caller with 401 and builds nothing", async () => {
    const res = await GET(get(""))
    expect(res.status).toBe(401)
    expect(loadedFor).toEqual([])
  })

  it("forbids a non-admin exporting another client's plan", async () => {
    currentRole = { userId: "client-1", isAdmin: false }
    const res = await GET(get("?clientId=client-2"))
    expect(res.status).toBe(403)
    expect(loadedFor).toEqual([])
  })

  it("returns 404 when the caller has no active plan", async () => {
    currentRole = { userId: "client-1", isAdmin: false }
    planData = null
    const res = await GET(get(""))
    expect(res.status).toBe(404)
    expect(loadedFor).toEqual(["client-1"])
  })

  it("returns a PDF for a client exporting their own plan", async () => {
    currentRole = { userId: "client-1", isAdmin: false }
    const res = await GET(get("?locale=en"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("content-disposition")).toContain("attachment")
    // The export defaulted to the caller's own id.
    expect(loadedFor).toEqual(["client-1"])

    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf.byteLength).toBeGreaterThan(1000)
    expect(new TextDecoder("latin1").decode(buf.slice(0, 5))).toBe("%PDF-")
  })

  it("lets a trainer admin export another client's plan", async () => {
    currentRole = { userId: "admin-1", isAdmin: true }
    const res = await GET(get("?clientId=client-9&locale=he"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(loadedFor).toEqual(["client-9"])
  })
})
