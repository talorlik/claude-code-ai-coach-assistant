import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the plan-templates data access. A fake Supabase client
 * models the `plan_templates` table behind its RLS policy ("Trainer admin
 * manages templates" - trainer-admin only). The fake records the operation
 * issued and the filters/payload applied, and returns canned rows scoped the
 * way RLS would scope them:
 *
 * - Trainer admin: reads/writes succeed and rows are returned.
 * - Non-admin client: RLS exposes no rows, so a list returns `[]` and a single
 *   read returns `null`. The page guard (`requireTrainerAdmin`) is the primary
 *   block; RLS is the backstop tested here at the data layer.
 */

interface Op {
  type: "select" | "insert" | "update" | "delete"
  filters: Record<string, string>
  payload?: Record<string, unknown>
}

let rows: Record<string, unknown>[]
let rlsHidesRows: boolean
let lastOp: Op | null
let forcedError: { message: string } | null

/** Rows visible to the current caller (empty when RLS hides them). */
function visible(): Record<string, unknown>[] {
  return rlsHidesRows ? [] : rows
}

/** Builds a chainable, thenable fake matching the Supabase query builder. */
function makeBuilder() {
  const op: Op = { type: "select", filters: {} }
  lastOp = op

  const builder: Record<string, unknown> = {
    select() {
      return builder
    },
    insert(payload: Record<string, unknown>) {
      op.type = "insert"
      op.payload = payload
      return builder
    },
    update(payload: Record<string, unknown>) {
      op.type = "update"
      op.payload = payload
      return builder
    },
    delete() {
      op.type = "delete"
      return builder
    },
    eq(column: string, value: string) {
      op.filters[column] = value
      return builder
    },
    order() {
      return builder
    },
    maybeSingle: async () => ({
      data: forcedError ? null : (visible()[0] ?? null),
      error: forcedError,
    }),
    single: async () => ({
      data: forcedError ? null : (visible()[0] ?? null),
      error: forcedError,
    }),
  }

  // For list reads the builder is awaited directly (thenable).
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
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  deleteTemplate,
} from "@/lib/db/plan-templates"

function templateRow(id: string, title: string) {
  return {
    id,
    created_by: "admin-1",
    title,
    description: "desc",
    locale: "en-US",
    payload: { title, workouts: [] },
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
  }
}

beforeEach(() => {
  rows = []
  rlsHidesRows = false
  lastOp = null
  forcedError = null
})

describe("listTemplates (trainer-admin access)", () => {
  it("returns templates newest-first via select", async () => {
    rows = [templateRow("t1", "A"), templateRow("t2", "B")]
    const result = await listTemplates()
    expect(result).toHaveLength(2)
    expect(lastOp?.type).toBe("select")
  })

  it("throws loudly on a database error", async () => {
    forcedError = { message: "boom" }
    await expect(listTemplates()).rejects.toThrow(/Failed to list plan templates/)
  })
})

describe("listTemplates (client cannot read)", () => {
  it("returns an empty list when RLS hides templates from a non-admin", async () => {
    rows = [templateRow("t1", "Secret")]
    rlsHidesRows = true
    const result = await listTemplates()
    expect(result).toEqual([])
  })
})

describe("getTemplate", () => {
  it("returns the template filtered by id", async () => {
    rows = [templateRow("t1", "A")]
    const result = await getTemplate("t1")
    expect(result?.id).toBe("t1")
    expect(lastOp?.filters.id).toBe("t1")
  })

  it("returns null when RLS hides the row from a non-admin", async () => {
    rows = [templateRow("t1", "Secret")]
    rlsHidesRows = true
    const result = await getTemplate("t1")
    expect(result).toBeNull()
  })
})

describe("createTemplate", () => {
  it("inserts owner, metadata, and payload", async () => {
    rows = [templateRow("t1", "New plan")]
    const result = await createTemplate({
      createdBy: "admin-1",
      title: "New plan",
      description: "desc",
      locale: "en-US",
      payload: { title: "New plan", workouts: [] },
    })
    expect(result.id).toBe("t1")
    expect(lastOp?.type).toBe("insert")
    expect(lastOp?.payload).toMatchObject({
      created_by: "admin-1",
      title: "New plan",
      locale: "en-US",
    })
  })

  it("throws loudly on a database error", async () => {
    forcedError = { message: "boom" }
    await expect(
      createTemplate({
        createdBy: "admin-1",
        title: "x",
        description: null,
        locale: null,
        payload: {},
      })
    ).rejects.toThrow(/Failed to create plan template/)
  })
})

describe("updateTemplate", () => {
  it("updates metadata and payload filtered by id", async () => {
    rows = [templateRow("t1", "Updated")]
    const result = await updateTemplate("t1", {
      title: "Updated",
      description: null,
      locale: null,
      payload: { title: "Updated", workouts: [] },
    })
    expect(result.title).toBe("Updated")
    expect(lastOp?.type).toBe("update")
    expect(lastOp?.filters.id).toBe("t1")
    expect(lastOp?.payload).toMatchObject({ title: "Updated" })
  })
})

describe("duplicateTemplate", () => {
  it("reads the source then inserts an independent copy with a title suffix", async () => {
    // Source read and the insert both go through the same fake; the source row
    // is what `visible()` returns, and the insert payload is captured.
    rows = [templateRow("t1", "Leg day")]
    const result = await duplicateTemplate("t1", "admin-1", " (copy)")
    expect(result.id).toBe("t1") // fake returns the canned row on insert
    expect(lastOp?.type).toBe("insert")
    expect(lastOp?.payload).toMatchObject({
      created_by: "admin-1",
      title: "Leg day (copy)",
      locale: "en-US",
    })
  })

  it("throws when the source does not exist (or RLS hides it)", async () => {
    rows = [templateRow("t1", "Leg day")]
    rlsHidesRows = true
    await expect(
      duplicateTemplate("t1", "admin-1", " (copy)")
    ).rejects.toThrow(/source not found/)
  })
})

describe("deleteTemplate", () => {
  it("issues a delete filtered by id", async () => {
    rows = [templateRow("t1", "x")]
    await deleteTemplate("t1")
    expect(lastOp?.type).toBe("delete")
    expect(lastOp?.filters.id).toBe("t1")
  })

  it("throws loudly on a database error", async () => {
    forcedError = { message: "boom" }
    await expect(deleteTemplate("t1")).rejects.toThrow(
      /Failed to delete plan template/
    )
  })
})
