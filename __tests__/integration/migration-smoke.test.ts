import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Static smoke check of the app-schema migration. Parses the SQL text and
 * asserts the structural invariants the build depends on: every app table is
 * created, has RLS enabled, and has at least one policy; the updated_at trigger
 * is wired where the table carries an updated_at column; and the trainer-admin
 * RLS helper is policy-callable (granted to authenticated). This catches a
 * dropped table or a forgotten RLS enable without a live database.
 */

// Resolve from the project root (vitest runs with cwd at the project root)
// rather than import.meta.url, which is not a file: URL under vitest.
const migrationPath = join(
  process.cwd(),
  "supabase/migrations/0002_app_schema.sql"
)
const sql = readFileSync(migrationPath, "utf8")

/** Tables that must exist with RLS and at least one policy. */
const APP_TABLES = [
  "clients",
  "workout_plans",
  "workouts",
  "exercises",
  "workout_logs",
  "chat_messages",
  "plan_templates",
  "trainer_notes",
  "push_subscriptions",
  "plan_generation_events",
] as const

/** Subset of app tables that carry updated_at and thus need the trigger. */
const UPDATED_AT_TABLES = [
  "clients",
  "workout_plans",
  "workouts",
  "exercises",
  "plan_templates",
  "trainer_notes",
  "push_subscriptions",
] as const

describe("0002_app_schema migration", () => {
  it.each(APP_TABLES)("creates table %s", (table) => {
    expect(sql).toContain(`create table public.${table} (`)
  })

  it.each(APP_TABLES)("enables RLS on %s", (table) => {
    expect(sql).toContain(
      `alter table public.${table} enable row level security;`
    )
  })

  it.each(APP_TABLES)("declares at least one policy on %s", (table) => {
    expect(sql).toContain(`on public.${table}`)
  })

  it.each(UPDATED_AT_TABLES)("wires the updated_at trigger on %s", (table) => {
    expect(sql).toContain(`${table}_set_updated_at`)
    expect(sql).toContain(`before update on public.${table}`)
  })

  it("defines the policy-callable trainer-admin helper", () => {
    expect(sql).toContain(
      "create or replace function public.is_trainer_admin()"
    )
    expect(sql).toContain("grant execute on function public.is_trainer_admin()")
    expect(sql).toMatch(/grant execute on function public\.is_trainer_admin\(\) to [^;]*authenticated/)
  })

  it("never grants the argument-taking is_admin to authenticated", () => {
    // is_admin(uuid) must stay off the authenticated RPC surface; policies use
    // is_trainer_admin() instead.
    expect(sql).not.toMatch(/grant execute on function public\.is_admin\(uuid\) to [^;]*authenticated/)
  })

  it("keeps trainer_notes and plan_templates trainer-admin only", () => {
    // No client-ownership predicate (auth.uid() = client_id) on these tables.
    const notesPolicy = sql.slice(sql.indexOf("on public.trainer_notes"))
    expect(notesPolicy).toContain("is_trainer_admin()")
  })
})
