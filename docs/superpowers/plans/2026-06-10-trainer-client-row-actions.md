# Trainer Client List Row Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the misleading whole-row affordance on the trainer client list with explicit edit (pencil) and delete (trash) icons plus an inline plan active/inactive toggle, keeping the responsive table + mobile-card layout.

**Architecture:** Two new server actions (`deleteClientAction`, `setPlanActiveAction`) live in a new `lib/db/trainer-clients-actions.ts`, following the established `requireTrainerAdmin` + admin/RLS client + `ActionResult` pattern. The data query gains a `hasAnyPlan` flag. The existing client component `trainer-clients.tsx` drops the row-link affordance, adds an actions column (desktop) / card footer (mobile), and a `<PlanToggle>` built on the Base UI `Switch`. New i18n keys land in both message catalogs.

**Tech Stack:** Next.js 16 App Router (Server Actions), React 19 client components, `@supabase/ssr`, next-intl v4, Base UI `Switch`/`AlertDialog`, Sonner toasts, Vitest + jsdom.

---

## Pre-flight

Use nvm Node v22.16.0 for all commands (shell default Node 18 breaks Vitest/rolldown):

```bash
nvm use 22.16.0
```

All test commands assume the repo root as cwd.

---

## File Structure

- `lib/db/trainer-clients.ts` (modify) — add `hasAnyPlan` to `ClientWithActivity` and derive it.
- `lib/db/trainer-clients-actions.ts` (create) — `deleteClientAction`, `setPlanActiveAction`.
- `app/[locale]/trainer/page.tsx` (modify) — thread `hasAnyPlan` into the row mapping.
- `app/[locale]/trainer/trainer-clients.tsx` (modify) — `TrainerClientRow.hasAnyPlan`; remove row-link affordance; add actions column, card-footer actions, `<PlanToggle>`, delete `AlertDialog`.
- `messages/en-US.json`, `messages/he-IL.json` (modify) — new `TrainerClients` keys.
- `__tests__/integration/trainer-clients-actions.test.ts` (create) — action tests.
- `__tests__/unit/trainer-clients-row.test.tsx` (create) — component tests.

---

## Task 1: Add `hasAnyPlan` to the client-activity query

**Files:**
- Modify: `lib/db/trainer-clients.ts`
- Test: `__tests__/integration/db-trainer-clients.test.ts`

`hasAnyPlan` is true when the client has at least one plan in any status. The current query only loads `status = 'active'` plans, so we add a second lightweight query for the set of client ids that own any plan.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/integration/db-trainer-clients.test.ts` inside the existing `describe`. The fake builder already serves `workout_plans` rows; add an archived-only plan for a second client and assert the flag.

```typescript
it("sets hasAnyPlan true for clients with only archived plans", async () => {
  tables.clients = [clientRow("c-archived", "Archie")]
  tables.workout_plans = [
    {
      id: "p-archived",
      client_id: "c-archived",
      title: "Old plan",
      status: "archived",
    },
  ]
  tables.workouts = []
  tables.workout_logs = []

  const result = await listClientsWithActivity(reference)

  expect(result).toHaveLength(1)
  expect(result[0].hasActivePlan).toBe(false)
  expect(result[0].hasAnyPlan).toBe(true)
})
```

The existing fake builder's `.eq` is a no-op chain, so a query filtered by `status = 'active'` still returns the archived row from `tables.workout_plans`. To keep the active-plan query honest in this test, the new `hasAnyPlan` query must select a distinct shape. Implement it as a separate `.from("workout_plans").select("client_id")` call without a status filter (Step 3), and have the test rely on the builder returning all `workout_plans` rows for both calls — `hasActivePlan` stays false here only if the active query yields no active row. Because the fake `.eq` is a no-op, adjust the test's plan row to NOT be matched as active: set an extra guard in the implementation that treats a plan as active only when `status === "active"` (filter in memory). See Step 3.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/integration/db-trainer-clients.test.ts -t "hasAnyPlan"`
Expected: FAIL — `result[0].hasAnyPlan` is `undefined` (property does not exist yet).

- [ ] **Step 3: Implement `hasAnyPlan`**

In `lib/db/trainer-clients.ts`, extend the interface:

```typescript
export interface ClientWithActivity {
  /** The client's onboarding profile. */
  client: Client
  /** Whether the client has an active workout plan. */
  hasActivePlan: boolean
  /** Whether the client has any plan at all (active or archived). */
  hasAnyPlan: boolean
  /** The active plan's title, or `null` when there is no active plan. */
  activePlanTitle: string | null
  /**
   * Share of the active plan's workouts completed in the current calendar
   * month, as an integer 0-100. `0` when there is no active plan or no plan
   * workouts; this also drives the activity indicator.
   */
  monthCompletionPercent: number
}
```

After the active-plan query block (after the `planByClient`/`planIds` are built, around line 91), add a query for clients owning any plan, and make active-detection robust to the fake builder by filtering in memory:

```typescript
  // Clients that own at least one plan in any status, to drive the plan toggle's
  // enabled state (a toggle can only reactivate a plan that exists).
  const { data: anyPlanData, error: anyPlanError } = await supabase
    .from("workout_plans")
    .select("client_id, status")
    .in("client_id", clientIds)

  if (anyPlanError) {
    throw new Error(`Failed to load plans: ${anyPlanError.message}`)
  }

  const clientsWithAnyPlan = new Set(
    ((anyPlanData as Pick<WorkoutPlanRow, "client_id" | "status">[]) ?? []).map(
      (p) => p.client_id
    )
  )
```

Guard active detection (so the no-op fake `.eq` cannot mark an archived plan active) by re-checking status when building `planByClient`. Replace the `activePlans` construction (lines 86-90) with:

```typescript
  const activePlans = (
    (planData as Pick<
      WorkoutPlanRow,
      "id" | "client_id" | "title" | "status"
    >[]) ?? []
  ).filter((p) => p.status === "active")
  const planByClient = new Map(activePlans.map((p) => [p.client_id, p]))
  const planIds = activePlans.map((p) => p.id)
```

And extend the active-plan `select` (line 78) to include `status`:

```typescript
    .select("id, client_id, title, status")
```

Finally, in both returned objects in the `clients.map` (the no-active-plan branch ~line 148 and the active branch ~line 161), add `hasAnyPlan`:

```typescript
        hasAnyPlan: clientsWithAnyPlan.has(client.userId),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/integration/db-trainer-clients.test.ts`
Expected: PASS (the new test and all existing trainer-clients data tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/trainer-clients.ts __tests__/integration/db-trainer-clients.test.ts
git commit -m "feat(trainer): derive hasAnyPlan for client list"
```

---

## Task 2: Add i18n keys for actions, toggle, and delete dialog

**Files:**
- Modify: `messages/en-US.json`, `messages/he-IL.json`
- Test: `__tests__/unit/messages-parity.test.ts` (existing — must still pass)

- [ ] **Step 1: Add keys to `messages/en-US.json`**

In the `TrainerClients` object, add `actions` to `columns`, and three new sibling objects/keys. Merge into the existing structure:

```json
"columns": {
  "name": "Client",
  "goal": "Goal",
  "joinDate": "Joined",
  "plan": "Plan",
  "completion": "This month",
  "activity": "Activity",
  "actions": "Actions"
},
"plan": {
  "active": "Active plan",
  "none": "No active plan",
  "toggleLabel": "Toggle plan for {name}",
  "activate": "Activate plan",
  "deactivate": "Deactivate plan",
  "noPlanToActivate": "This client has no plan to activate.",
  "updateError": "Couldn't update the plan. Please try again."
},
"actions": {
  "edit": "Edit",
  "delete": "Delete",
  "editLabel": "Edit {name}",
  "deleteLabel": "Delete {name}"
},
"delete": {
  "confirmTitle": "Delete client?",
  "confirmDescription": "This permanently removes {name} and all their plans, logs, and notes. This cannot be undone.",
  "confirmCta": "Delete client",
  "cancel": "Cancel",
  "success": "Client deleted.",
  "error": "Couldn't delete the client. Please try again."
}
```

- [ ] **Step 2: Add the matching Hebrew keys to `messages/he-IL.json`**

Same structure under `TrainerClients`:

```json
"columns": {
  "name": "לקוח",
  "goal": "מטרה",
  "joinDate": "הצטרף",
  "plan": "תוכנית",
  "completion": "החודש",
  "activity": "פעילות",
  "actions": "פעולות"
},
"plan": {
  "active": "תוכנית פעילה",
  "none": "אין תוכנית פעילה",
  "toggleLabel": "החלפת מצב תוכנית עבור {name}",
  "activate": "הפעלת תוכנית",
  "deactivate": "השבתת תוכנית",
  "noPlanToActivate": "ללקוח זה אין תוכנית להפעלה.",
  "updateError": "עדכון התוכנית נכשל. נסה שוב."
},
"actions": {
  "edit": "עריכה",
  "delete": "מחיקה",
  "editLabel": "עריכת {name}",
  "deleteLabel": "מחיקת {name}"
},
"delete": {
  "confirmTitle": "למחוק את הלקוח?",
  "confirmDescription": "פעולה זו תמחק לצמיתות את {name} ואת כל התוכניות, היומנים וההערות שלו. לא ניתן לבטל.",
  "confirmCta": "מחיקת לקוח",
  "cancel": "ביטול",
  "success": "הלקוח נמחק.",
  "error": "מחיקת הלקוח נכשלה. נסה שוב."
}
```

Keep the existing `plan.active` / `plan.none` Hebrew values if they already differ; only add the new keys, do not overwrite established translations. (Verify current Hebrew values first: `node -e "console.log(JSON.stringify(require('./messages/he-IL.json').TrainerClients.plan))"`.)

- [ ] **Step 3: Run parity + i18n tests**

Run: `npx vitest run __tests__/unit/messages-parity.test.ts __tests__/unit/trainer-hub-i18n.test.ts`
Expected: PASS (en and he have identical key sets).

- [ ] **Step 4: Commit**

```bash
git add messages/en-US.json messages/he-IL.json
git commit -m "feat(i18n): trainer client row action + plan toggle + delete keys"
```

---

## Task 3: `setPlanActiveAction` server action

**Files:**
- Create: `lib/db/trainer-clients-actions.ts`
- Test: `__tests__/integration/trainer-clients-actions.test.ts`

This action archives the active plan (deactivate) or reactivates the most-recently-archived plan (activate), preserving the one-active-plan invariant. It uses the request-scoped RLS client (`createClient`) — the trainer admin's RLS already permits writing any client's plans, matching how notes/regeneration actions work.

- [ ] **Step 1: Write the failing test (file scaffolding + first cases)**

Create `__tests__/integration/trainer-clients-actions.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Integration tests for the trainer client-list server actions.
 *
 * - Auth gating: both actions require the trainer-admin role; when the guard
 *   throws (as Next's redirect does), no write runs.
 * - setPlanActiveAction: deactivate archives the active plan; activate restores
 *   the most-recently-archived plan; activate with no plan returns the
 *   localizable `plan.noPlanToActivate` code without throwing.
 * - deleteClientAction: deletes the clients row then the auth user, and reports
 *   a partial failure if the auth-user delete fails after the data delete.
 *
 * Auth, Supabase, and next/cache are mocked.
 */

const requireTrainerAdmin = vi.fn<() => Promise<string>>()

vi.mock("@/lib/auth/require-user", () => ({
  requireTrainerAdmin: () => requireTrainerAdmin(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Mutable fixtures the fake Supabase clients read/write.
interface PlanRow {
  id: string
  client_id: string
  status: string
  archived_at: string | null
  updated_at: string
}

let plans: PlanRow[]
let updateCalls: Array<{ patch: Record<string, unknown>; id: string }>
let deletedClientIds: string[]
let deletedUserIds: string[]
let authDeleteError: { message: string } | null

function rlsClient() {
  return {
    from(table: string) {
      if (table !== "workout_plans" && table !== "clients") {
        throw new Error(`unexpected table ${table}`)
      }
      const ctx: {
        action: "select" | "update" | "delete" | null
        patch: Record<string, unknown>
        filters: Record<string, unknown>
        order?: { col: string; asc: boolean }
        limitN?: number
      } = { action: null, patch: {}, filters: {} }

      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.update = (patch: Record<string, unknown>) => {
        ctx.action = "update"
        ctx.patch = patch
        return builder
      }
      builder.delete = () => {
        ctx.action = "delete"
        return builder
      }
      builder.eq = (col: string, val: unknown) => {
        ctx.filters[col] = val
        return builder
      }
      builder.order = (col: string, opts: { ascending: boolean }) => {
        ctx.order = { col, asc: opts.ascending }
        return builder
      }
      builder.limit = (n: number) => {
        ctx.limitN = n
        return builder
      }
      builder.maybeSingle = async () => {
        const matched = plans
          .filter((p) =>
            Object.entries(ctx.filters).every(
              ([k, v]) => (p as Record<string, unknown>)[k] === v
            )
          )
          .sort((a, b) =>
            ctx.order?.col === "archived_at"
              ? (b.archived_at ?? "").localeCompare(a.archived_at ?? "")
              : 0
          )
        return { data: matched[0] ?? null, error: null }
      }
      // Terminal for update/delete: resolve as a thenable.
      builder.then = (resolve: (v: { error: unknown }) => unknown) => {
        if (ctx.action === "update") {
          for (const p of plans) {
            if (
              Object.entries(ctx.filters).every(
                ([k, v]) => (p as Record<string, unknown>)[k] === v
              )
            ) {
              Object.assign(p, ctx.patch)
              updateCalls.push({ patch: ctx.patch, id: p.id })
            }
          }
        } else if (ctx.action === "delete" && table === "clients") {
          deletedClientIds.push(String(ctx.filters.user_id))
        }
        return resolve({ error: null })
      }
      return builder
    },
    auth: {
      admin: {
        deleteUser: async (userId: string) => {
          if (authDeleteError) return { error: authDeleteError }
          deletedUserIds.push(userId)
          return { error: null }
        },
      },
    },
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => rlsClient(),
  createAdminClient: async () => rlsClient(),
}))

import {
  setPlanActiveAction,
  deleteClientAction,
} from "@/lib/db/trainer-clients-actions"

beforeEach(() => {
  vi.clearAllMocks()
  requireTrainerAdmin.mockResolvedValue("admin-1")
  plans = []
  updateCalls = []
  deletedClientIds = []
  deletedUserIds = []
  authDeleteError = null
})

describe("setPlanActiveAction", () => {
  it("archives the active plan when deactivating", async () => {
    plans = [
      {
        id: "p1",
        client_id: "c1",
        status: "active",
        archived_at: null,
        updated_at: "2026-06-01T00:00:00Z",
      },
    ]

    const result = await setPlanActiveAction("c1", false)

    expect(result.ok).toBe(true)
    expect(plans[0].status).toBe("archived")
    expect(plans[0].archived_at).not.toBeNull()
  })

  it("reactivates the most-recently-archived plan when activating", async () => {
    plans = [
      {
        id: "old",
        client_id: "c1",
        status: "archived",
        archived_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-01T00:00:00Z",
      },
      {
        id: "recent",
        client_id: "c1",
        status: "archived",
        archived_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T00:00:00Z",
      },
    ]

    const result = await setPlanActiveAction("c1", true)

    expect(result.ok).toBe(true)
    const recent = plans.find((p) => p.id === "recent")!
    expect(recent.status).toBe("active")
    expect(recent.archived_at).toBeNull()
  })

  it("returns noPlanToActivate when the client has no plan", async () => {
    plans = []

    const result = await setPlanActiveAction("c1", true)

    expect(result).toEqual({ ok: false, error: "plan.noPlanToActivate" })
  })

  it("rejects when the admin guard throws", async () => {
    requireTrainerAdmin.mockRejectedValue(new Error("redirect"))

    await expect(setPlanActiveAction("c1", false)).rejects.toThrow("redirect")
    expect(updateCalls).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/integration/trainer-clients-actions.test.ts -t "setPlanActiveAction"`
Expected: FAIL — module `@/lib/db/trainer-clients-actions` does not exist.

- [ ] **Step 3: Implement the action file (this action only)**

Create `lib/db/trainer-clients-actions.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"

import { requireTrainerAdmin } from "@/lib/auth/require-user"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/lib/types/action-result"
import { fail, ok } from "@/lib/types/action-result"

/**
 * Server actions backing the trainer client list's row actions. Each action is
 * an independently callable entry point, so it re-runs the authoritative
 * `requireTrainerAdmin` guard before any write (RLS is the database backstop).
 * Results are returned as `ActionResult` with localizable message keys rather
 * than thrown, so the client component can toast them; the guard itself still
 * throws (redirects) for unauthenticated/non-admin callers, which is the
 * intended hard stop.
 */

/** Revalidates the trainer client list for both locales after a change. */
function revalidateTrainerList(): void {
  // `localePrefix: "always"` puts the page under `/en` and `/he`; revalidate
  // both so a change is reflected if the trainer switches locale.
  revalidatePath("/en/trainer")
  revalidatePath("/he/trainer")
}

/**
 * Toggles a client's plan between active and archived from the trainer list.
 *
 * Deactivating archives the client's current active plan. Activating restores
 * their most-recently-archived plan (by `archived_at`), first archiving any
 * other active plan so the one-active-plan-per-client invariant holds. When the
 * client has no plan to activate, the action returns the localizable
 * `plan.noPlanToActivate` code; the list normally disables the toggle in that
 * state, so this is a backstop rather than an expected path.
 *
 * @param clientId - The client's user id (their `clients.user_id`).
 * @param active - The desired plan state: `true` to activate, `false` to archive.
 * @returns The resulting active state on success, or a localizable failure.
 */
export async function setPlanActiveAction(
  clientId: string,
  active: boolean
): Promise<ActionResult<{ hasActivePlan: boolean }>> {
  await requireTrainerAdmin()

  const supabase = await createClient()

  try {
    if (!active) {
      const { error } = await supabase
        .from("workout_plans")
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("client_id", clientId)
        .eq("status", "active")
      if (error) return fail("plan.updateError")
      revalidateTrainerList()
      return ok({ hasActivePlan: false })
    }

    // Activate: find the most-recently-archived plan for this client.
    const { data: candidate, error: findError } = await supabase
      .from("workout_plans")
      .select("id")
      .eq("client_id", clientId)
      .eq("status", "archived")
      .order("archived_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) return fail("plan.updateError")
    if (!candidate) return fail("plan.noPlanToActivate")

    // Archive any currently-active plan first to keep a single active plan.
    const { error: archiveError } = await supabase
      .from("workout_plans")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("client_id", clientId)
      .eq("status", "active")
    if (archiveError) return fail("plan.updateError")

    const { error: activateError } = await supabase
      .from("workout_plans")
      .update({ status: "active", archived_at: null })
      .eq("id", (candidate as { id: string }).id)
    if (activateError) return fail("plan.updateError")

    revalidateTrainerList()
    return ok({ hasActivePlan: true })
  } catch {
    return fail("plan.updateError")
  }
}
```

The fake builder's `maybeSingle` returns the most-recently-archived row by sorting on `archived_at` desc, matching the `.order("archived_at", { ascending: false })` call, so the "reactivates most-recently-archived" test passes.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run __tests__/integration/trainer-clients-actions.test.ts -t "setPlanActiveAction"`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add lib/db/trainer-clients-actions.ts __tests__/integration/trainer-clients-actions.test.ts
git commit -m "feat(trainer): setPlanActiveAction to toggle client plan state"
```

---

## Task 4: `deleteClientAction` server action

**Files:**
- Modify: `lib/db/trainer-clients-actions.ts`
- Test: `__tests__/integration/trainer-clients-actions.test.ts`

Deletes the client's app data (the `clients` row; FK `on delete cascade` removes plans, workouts, logs, notes) using the admin client, then deletes the Supabase auth user so the email is freed.

- [ ] **Step 1: Write the failing tests**

Append a `describe` to `__tests__/integration/trainer-clients-actions.test.ts`:

```typescript
describe("deleteClientAction", () => {
  it("deletes the client data then the auth user", async () => {
    const result = await deleteClientAction("c1")

    expect(result).toEqual({ ok: true, data: null })
    expect(deletedClientIds).toContain("c1")
    expect(deletedUserIds).toContain("c1")
  })

  it("returns a partial-failure code when the auth-user delete fails", async () => {
    authDeleteError = { message: "auth boom" }

    const result = await deleteClientAction("c1")

    expect(result).toEqual({ ok: false, error: "delete.error" })
    // Data delete still happened (the row is gone).
    expect(deletedClientIds).toContain("c1")
  })

  it("rejects when the admin guard throws", async () => {
    requireTrainerAdmin.mockRejectedValue(new Error("redirect"))

    await expect(deleteClientAction("c1")).rejects.toThrow("redirect")
    expect(deletedClientIds).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/integration/trainer-clients-actions.test.ts -t "deleteClientAction"`
Expected: FAIL — `deleteClientAction` is not exported.

- [ ] **Step 3: Implement the action**

Append to `lib/db/trainer-clients-actions.ts`:

```typescript
/**
 * Permanently deletes a client from the trainer list.
 *
 * Deletes the `clients` row via the admin client (bypassing RLS); the database
 * FK `on delete cascade` removes the client's plans, workouts, logs, and notes.
 * Then deletes the client's Supabase auth user so their email can re-register.
 * Data is deleted before the auth user: if the auth-user delete fails, the row
 * is already gone (the client is effectively removed), so the action returns the
 * localizable `delete.error` code to prompt the admin to retry the auth cleanup
 * rather than implying the client still exists.
 *
 * @param clientId - The client's user id (their `clients.user_id` and auth id).
 * @returns Empty success, or a localizable failure code.
 */
export async function deleteClientAction(
  clientId: string
): Promise<ActionResult<null>> {
  await requireTrainerAdmin()

  const admin = await createAdminClient()

  try {
    const { error: dataError } = await admin
      .from("clients")
      .delete()
      .eq("user_id", clientId)
    if (dataError) return fail("delete.error")

    const { error: authError } = await admin.auth.admin.deleteUser(clientId)
    if (authError) return fail("delete.error")

    revalidateTrainerList()
    return ok(null)
  } catch {
    return fail("delete.error")
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run __tests__/integration/trainer-clients-actions.test.ts`
Expected: PASS (all `setPlanActiveAction` and `deleteClientAction` cases).

- [ ] **Step 5: Commit**

```bash
git add lib/db/trainer-clients-actions.ts __tests__/integration/trainer-clients-actions.test.ts
git commit -m "feat(trainer): deleteClientAction removes client data and auth user"
```

---

## Task 5: Thread `hasAnyPlan` into the page row mapping

**Files:**
- Modify: `app/[locale]/trainer/page.tsx`

- [ ] **Step 1: Add `hasAnyPlan` to the row map**

In `app/[locale]/trainer/page.tsx`, the `clients.map` destructure currently pulls `{ client, hasActivePlan, monthCompletionPercent }`. Add `hasAnyPlan`:

```typescript
    rows = clients.map(
      ({ client, hasActivePlan, hasAnyPlan, monthCompletionPercent }) => {
        const { level, color } = activityIndicator(monthCompletionPercent)
        return {
          userId: client.userId,
          fullName: client.fullName,
          goals: client.goals,
          joinDate: client.onboardedAt ?? client.createdAt,
          joinDateLabel: format.dateTime(
            new Date(client.onboardedAt ?? client.createdAt),
            { dateStyle: "medium" }
          ),
          hasActivePlan,
          hasAnyPlan,
          completionPercent: monthCompletionPercent,
          activityLevel: level,
          activityColor: color,
        }
      }
    )
```

(This will not typecheck until `TrainerClientRow` gains `hasAnyPlan` in Task 6; that is expected — Tasks 5 and 6 are committed together if executed inline, or Task 6's typecheck step covers both.)

- [ ] **Step 2: Commit**

```bash
git add "app/[locale]/trainer/page.tsx"
git commit -m "feat(trainer): pass hasAnyPlan to the client list rows"
```

---

## Task 6: Component — drop row-link affordance, add `PlanToggle`, actions, delete dialog

**Files:**
- Modify: `app/[locale]/trainer/trainer-clients.tsx`
- Test: `__tests__/unit/trainer-clients-row.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `__tests__/unit/trainer-clients-row.test.tsx`:

```typescript
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import en from "@/messages/en-US.json"
import { TrainerClients, type TrainerClientRow } from "@/app/[locale]/trainer/trainer-clients"

vi.mock("@/lib/db/trainer-clients-actions", () => ({
  setPlanActiveAction: vi.fn(),
  deleteClientAction: vi.fn(),
}))

// next-intl Link renders a plain anchor in tests.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

function row(overrides: Partial<TrainerClientRow> = {}): TrainerClientRow {
  return {
    userId: "c1",
    fullName: "Dana Levi",
    goals: ["strength"],
    joinDate: "2026-06-01T00:00:00Z",
    joinDateLabel: "Jun 1, 2026",
    hasActivePlan: true,
    hasAnyPlan: true,
    completionPercent: 50,
    activityLevel: "active",
    activityColor: "green",
    ...overrides,
  }
}

function renderList(rows: TrainerClientRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TrainerClients rows={rows} />
    </NextIntlClientProvider>
  )
}

describe("TrainerClients row actions", () => {
  it("renders an edit link to the client dashboard with a labelled control", () => {
    renderList([row()])
    const editLinks = screen.getAllByRole("link", { name: "Edit Dana Levi" })
    expect(editLinks.length).toBeGreaterThan(0)
    expect(editLinks[0]).toHaveAttribute("href", "/trainer/clients/c1")
  })

  it("does not render the client name as a link", () => {
    renderList([row()])
    expect(
      screen.queryByRole("link", { name: "Dana Levi" })
    ).toBeNull()
  })

  it("renders a delete control labelled for the client", () => {
    renderList([row()])
    expect(
      screen.getAllByRole("button", { name: "Delete Dana Levi" }).length
    ).toBeGreaterThan(0)
  })

  it("disables the plan toggle when the client has no plan at all", () => {
    renderList([row({ hasActivePlan: false, hasAnyPlan: false })])
    const toggles = screen.getAllByRole("switch", {
      name: "Toggle plan for Dana Levi",
    })
    expect(toggles[0]).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/unit/trainer-clients-row.test.tsx`
Expected: FAIL — `hasAnyPlan` not on `TrainerClientRow`, name still a link, no edit/delete/switch controls.

- [ ] **Step 3: Rewrite `trainer-clients.tsx`**

Replace the file with the version below. It adds `hasAnyPlan` to the row type, a `<PlanToggle>` and `<RowActions>` (edit link + delete dialog), removes `cursor-pointer` and the name `<Link>`, and mirrors the controls into the mobile card footer.

```tsx
"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import {
  deleteClientAction,
  setPlanActiveAction,
} from "@/lib/db/trainer-clients-actions"
import type { ActivityColor, ActivityLevel } from "@/lib/trainer/activity"

/**
 * One client's row as rendered by the trainer client list. A plain,
 * serializable shape: the server page resolves the locale-formatted join date
 * and the activity level/colour so this component renders without re-deriving
 * any business logic.
 */
export interface TrainerClientRow {
  /** The client's auth user id; also the dashboard route segment. */
  userId: string
  /** Display name, or `null` if onboarding did not capture one. */
  fullName: string | null
  /** The client's selected goals. */
  goals: string[]
  /** ISO timestamp used as the sortable/raw join date. */
  joinDate: string
  /** Locale-formatted join date for display. */
  joinDateLabel: string
  /** Whether the client has an active workout plan. */
  hasActivePlan: boolean
  /** Whether the client has any plan at all (active or archived). */
  hasAnyPlan: boolean
  /** Current-month completion percentage (0-100). */
  completionPercent: number
  /** Discrete activity level driving the indicator. */
  activityLevel: ActivityLevel
  /** Traffic-light colour token for the indicator. */
  activityColor: ActivityColor
}

/** Tailwind classes for each activity colour's indicator dot. */
const DOT_CLASS: Record<ActivityColor, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-500",
}

/**
 * Inline plan active/inactive toggle. Reflects state in both colour and word:
 * an active plan shows an emerald indicator and the active label; an inactive
 * plan a muted indicator and the inactive label. Disabled when the client has
 * no plan at all, since there is nothing to activate. Optimistically flips,
 * calls {@link setPlanActiveAction}, and reverts with a toast on failure.
 */
function PlanToggle({
  clientId,
  name,
  hasActivePlan,
  hasAnyPlan,
}: {
  clientId: string
  name: string
  hasActivePlan: boolean
  hasAnyPlan: boolean
}) {
  const t = useTranslations("TrainerClients")
  const [active, setActive] = useState(hasActivePlan)
  const [pending, startTransition] = useTransition()

  const disabled = pending || (!active && !hasAnyPlan)

  const onChange = (next: boolean) => {
    setActive(next)
    startTransition(async () => {
      const result = await setPlanActiveAction(clientId, next)
      if (!result.ok) {
        setActive(!next)
        toast.error(t(result.error))
      }
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          "size-2.5 rounded-full",
          active ? "bg-emerald-500" : "bg-muted-foreground/40"
        )}
      />
      <Switch
        checked={active}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={t("plan.toggleLabel", { name })}
      />
      <span className={cn("text-sm", !active && "text-muted-foreground")}>
        {active ? t("plan.active") : t("plan.none")}
      </span>
    </span>
  )
}

/**
 * The trailing edit/delete controls for a client. Edit is a link to the
 * client's dashboard (the edit surface); delete opens a confirm dialog and
 * calls {@link deleteClientAction}. Both controls carry a name-interpolated
 * accessible label so screen-reader users can tell the rows apart.
 */
function RowActions({
  clientId,
  name,
}: {
  clientId: string
  name: string
}) {
  const t = useTranslations("TrainerClients")
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const onConfirm = () => {
    startTransition(async () => {
      const result = await deleteClientAction(clientId)
      if (result.ok) {
        toast.success(t("delete.success"))
        setOpen(false)
      } else {
        toast.error(t(result.error))
      }
    })
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label={t("actions.editLabel", { name })}
        title={t("actions.edit")}
      >
        <Link href={`/trainer/clients/${clientId}`}>
          <Pencil className="size-4" aria-hidden />
        </Link>
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("actions.deleteLabel", { name })}
              title={t("actions.delete")}
            >
              <Trash2 className="size-4 text-destructive" aria-hidden />
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.confirmDescription", { name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                onConfirm()
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("delete.confirmCta")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  )
}

/**
 * Interactive trainer client list. Renders a table on wide viewports and a
 * stacked card layout on narrow ones (the table is hidden below `md`, the cards
 * above it), so the same data reads well on a phone or a desktop. Each client
 * has explicit row actions: an edit link to their dashboard at
 * `/trainer/clients/[clientId]`, a delete control (confirmed), and an inline
 * plan active/inactive toggle. The row itself is no longer clickable; only the
 * controls act. All copy is localized through the `TrainerClients` namespace;
 * the activity indicator's colour is decided server-side and only mapped to a
 * class here.
 *
 * @param rows - The clients to render, already shaped and localized by the page.
 */
export function TrainerClients({ rows }: { rows: TrainerClientRow[] }) {
  const t = useTranslations("TrainerClients")

  const goalLabel = (goals: string[]) =>
    goals.length > 0 ? goals.join(", ") : t("noGoal")
  const activityLabel = (level: ActivityLevel) => t(`activity.${level}`)
  const nameOf = (row: TrainerClientRow) => row.fullName ?? t("unnamed")

  return (
    <div>
      {/* Desktop / tablet: table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead>{t("columns.goal")}</TableHead>
              <TableHead>{t("columns.joinDate")}</TableHead>
              <TableHead>{t("columns.plan")}</TableHead>
              <TableHead>{t("columns.completion")}</TableHead>
              <TableHead>{t("columns.activity")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("columns.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId}>
                <TableCell className="font-medium">{nameOf(row)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {goalLabel(row.goals)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.joinDateLabel}
                </TableCell>
                <TableCell>
                  <PlanToggle
                    clientId={row.userId}
                    name={nameOf(row)}
                    hasActivePlan={row.hasActivePlan}
                    hasAnyPlan={row.hasAnyPlan}
                  />
                </TableCell>
                <TableCell>
                  {t("percent", { value: row.completionPercent })}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "size-2.5 rounded-full",
                        DOT_CLASS[row.activityColor]
                      )}
                    />
                    <span>{activityLabel(row.activityLevel)}</span>
                  </span>
                </TableCell>
                <TableCell className="text-end">
                  <RowActions clientId={row.userId} name={nameOf(row)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.userId}
            className="rounded-lg border bg-card p-4 text-card-foreground"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{nameOf(row)}</span>
              <span className="inline-flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 rounded-full",
                    DOT_CLASS[row.activityColor]
                  )}
                />
                <span>{activityLabel(row.activityLevel)}</span>
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">{t("columns.goal")}</dt>
                <dd>{goalLabel(row.goals)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("columns.joinDate")}
                </dt>
                <dd>{row.joinDateLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("columns.plan")}</dt>
                <dd>
                  <PlanToggle
                    clientId={row.userId}
                    name={nameOf(row)}
                    hasActivePlan={row.hasActivePlan}
                    hasAnyPlan={row.hasAnyPlan}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("columns.completion")}
                </dt>
                <dd>{t("percent", { value: row.completionPercent })}</dd>
              </div>
            </dl>
            <div className="mt-3 flex justify-end">
              <RowActions clientId={row.userId} name={nameOf(row)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Verify the AlertDialog + Button APIs match the codebase**

The `AlertDialogTrigger render={...}` and `Button asChild` usages above assume Base UI / shadcn conventions. Before running, confirm against the actual components:

Run: `sed -n '1,80p' components/ui/alert-dialog.tsx; grep -n "asChild\|Slot\|render" components/ui/button.tsx`

If `AlertDialogTrigger` uses `asChild` instead of `render`, change to:

```tsx
<AlertDialogTrigger asChild>
  <Button variant="ghost" size="icon" aria-label={t("actions.deleteLabel", { name })} title={t("actions.delete")}>
    <Trash2 className="size-4 text-destructive" aria-hidden />
  </Button>
</AlertDialogTrigger>
```

If `Button` does not support `asChild`, render the edit link as a plain anchor styled with `buttonVariants({ variant: "ghost", size: "icon" })` instead. Pick whichever matches; do not leave both.

- [ ] **Step 5: Run the component tests**

Run: `npx vitest run __tests__/unit/trainer-clients-row.test.tsx`
Expected: PASS (edit link present and href correct, name not a link, delete control present, toggle disabled when no plan).

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/trainer/trainer-clients.tsx" __tests__/unit/trainer-clients-row.test.tsx
git commit -m "feat(trainer): explicit row edit/delete actions and plan toggle"
```

---

## Task 7: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Lint, typecheck, build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all pass. Typecheck confirms Task 5's `hasAnyPlan` mapping matches the Task 6 `TrainerClientRow`.

- [ ] **Step 2: Full unit + integration suite**

Run: `npm run test`
Expected: PASS, including the three new/extended test files and the existing `messages-parity` and `db-trainer-clients` tests.

- [ ] **Step 3: Manual responsive + RTL check**

Run the dev server (`npm run dev`), open `/en/trainer` and `/he/trainer` as the admin (`talorlik@gmail.com`):
- Desktop: actions column sits at the inline-end; pencil navigates to the client dashboard; trash opens the confirm dialog; plan toggle flips and reflects colour + word.
- Narrow viewport (DevTools phone width): cards stack, no horizontal page scroll, controls present in each card footer.
- `/he`: actions column and toggle render right-to-left correctly.

- [ ] **Step 4: Final commit (if any manual fixups were needed)**

```bash
git add -A
git commit -m "fix(trainer): responsive/RTL adjustments for client row actions"
```

---

## Self-Review Notes

- **Spec coverage:** edit pencil → dashboard (Task 6); delete + confirm + auth-user delete (Tasks 4, 6); plan toggle with colour+word and disabled-when-no-plan (Tasks 1, 3, 6); row no longer clickable / name not a link (Task 6); responsive table+cards kept (Task 6); i18n both catalogs (Task 2); tests for delete, toggle, and component (Tasks 3, 4, 6). All spec sections map to a task.
- **Type consistency:** `hasAnyPlan` added in `ClientWithActivity` (Task 1) and `TrainerClientRow` (Task 6), produced by the page map (Task 5). Action names `setPlanActiveAction` / `deleteClientAction` are identical across Tasks 3, 4, and 6 and the test mocks. `ActionResult` error values are the literal i18n keys (`plan.noPlanToActivate`, `plan.updateError`, `delete.error`) added in Task 2 and toasted via `t(result.error)`.
- **Known check point:** Task 6 Step 4 explicitly verifies the `AlertDialogTrigger`/`Button` composition API against the real components before running, since Base UI vs Radix differ on `render` vs `asChild`.
