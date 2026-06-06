# 25 - TRAINER PLAN AUTHORING

## Claude Code Prompt

You are working inside an existing Next.js 16.1.7 App Router project generated
from the AI Game Changer template.

Non-negotiable constraints:

1. Use TypeScript 5.9.3.
2. Use the App Router.
3. Use root `proxy.ts` for locale-aware request handling.
4. Do not create root `middleware.ts` unless the installed template explicitly
   requires a compatibility shim.
5. Use `next-intl` `^4.13.0` with `/en` and `/he` route prefixes. Every in-app
   URL must be locale-aware: use the `Link` and `redirect` from
   `@/i18n/navigation` (never `next/link`, `next/navigation`, or a raw `<a href>`)
   and pass locale-agnostic paths (e.g. `/trainer`, not `/en/trainer`) so the
   active locale is preserved. Route handlers and server redirects must likewise
   build locale-prefixed targets, never hardcode `/en` or `/he`.
6. Map `/en` to `en-US` and `/he` to `he-IL`.
7. Support RTL for Hebrew.
8. Keep all user-facing copy translatable.
9. Use Supabase Auth, Supabase Postgres, and RLS.
10. Keep secrets out of browser code.
11. Use Vercel AI SDK v6 and Vercel AI Gateway for AI calls unless the existing
    template has a stricter convention.
12. Use server-side calls for all AI operations.
13. Add TSDoc to exported helpers, server actions, route helpers, AI utilities,
    and non-trivial components.
14. Add or update tests for every changed behavior.
15. Avoid rewriting working template code unless needed.
16. Preserve existing signup, login, logout, remember me, and forgot-password
    behavior where possible.
17. Keep Markdown documents in uppercase underscore naming with lowercase `.md`.

Current baseline already completed by the product owner:

- Batches 00-24 shipped. There are exactly TWO roles: `admin` (the trainer) and
  `customer`. The admin dashboard (`/admin`), the trainer dashboard
  (`/trainer`), the complete client dashboard (full plan detail, PDF, push
  status), the template manager, and plan regeneration all exist and are
  localized and role-gated.
- Helpers this batch REUSES (do not reimplement):
  - `createAiTemplateAction` in `lib/trainer/template-actions.ts` - an EXISTING
    server action that generates a plan template with AI behind a mockable
    `generate` seam. It is implemented but NOT yet wired to any UI.
    `createTemplateAction` / `updateTemplateAction` / `duplicateTemplateAction` /
    `assignTemplateAction` are the wired manual actions in
    `app/[locale]/trainer/plans-manager.tsx`.
  - `getActivePlanDetail(clientId)` in `lib/db/workouts.ts` - read access to the
    active plan's workouts and exercises (READ-ONLY; this batch adds the writes).
  - `validateGeneratedPlan(candidate, hasLimitations)` and the exercise shape in
    `lib/ai/schemas.ts` - the validation contract. The safety-note rule:
    when the client has limitations, every exercise must carry `safety_notes`.
    `assignTemplateAction` already re-validates a template against a client's
    limitations - mirror that rule.
  - `requireTrainerAdmin()` in `lib/auth/require-user.ts`; `ActionResult` in
    `lib/types/action-result.ts`; the `RegenerateClientPlan` dialog pattern
    (`app/[locale]/trainer/clients/[clientId]/regenerate-client-plan.tsx`) and
    its `revalidatePath` usage for the localized client and my-plan paths.

CRITICAL DATA HAZARD: in migration `0002_app_schema.sql`,
`workout_logs.workout_id` is `ON DELETE CASCADE` (and `exercises.workout_id` is
too). Deleting a workout therefore SILENTLY DELETES that workout's completion
logs, corrupting the client's progress history and charts. The live-plan editor
MUST NOT hard-delete a workout that has completion logs. Editing or adding
exercises, editing workout metadata, and deleting an exercise are all safe
(logs reference workouts, not exercises).

This batch adds NO new tables. It adds additive write functions over the existing
`workouts` / `exercises` tables (RLS already grants the admin write access) plus
the UI to use them, closing `docs/planning/ADMIN_CAPABILITIES.md` section 9
"Create plan with AI" and "Edit existing plan".

Before editing, inspect the current code structure and explain the files you
will touch.

## Goal

Give the admin (the trainer) two authoring capabilities that are currently
missing a path: (1) create a plan template with AI from the plan manager, and
(2) edit a client's LIVE assigned plan in place - modify workouts and exercises
(sets, reps, duration, rest, instructions, notes, safety notes), add and remove
exercises, and edit workout metadata - through a safe, validated, role-gated path
that never destroys completion history.

## Scope

UI wiring for the existing AI-template action, plus a new write data-access
module, new server actions, and an editor UI on the client dashboard. No schema
changes, no new tables. All AI stays server-side behind the existing mockable
seam. Plan regeneration and template assignment are untouched.

Workout deletion is intentionally restricted: a workout WITH completion logs
cannot be hard-deleted (the regeneration flow, which archives the whole plan
rather than mutating in place, remains the path for wholesale changes).

## Tasks

1. Wire AI template creation - `app/[locale]/trainer/plans-manager.tsx`. Add a
   localized "Create with AI" affordance (button + dialog) that calls the
   existing `createAiTemplateAction`. Keep the manual "Create" path unchanged.
   The AI call stays server-side via the action's existing `generate` seam.

2. Write data-access - new `lib/db/plan-edits.ts`, server-only, request-scoped
   (RLS-constrained), with narrow functions and TSDoc:
   - `updateExercise(exerciseId, fields)` - update only
     `name, sets, reps, duration, rest, instructions, safety_notes, position`.
   - `updateWorkout(workoutId, fields)` - update only
     `title, focus, day_of_week, notes, position`.
   - `addExercise(workoutId, fields)` and `addWorkout(planId, fields)` - inserts.
   - `deleteExercise(exerciseId)` - safe delete.
   - `deleteWorkout(workoutId)` - MUST first count `workout_logs` referencing the
     workout and refuse (return a typed failure) when any exist; only delete when
     there are none.

3. Server actions - new `lib/trainer/plan-edit-actions.ts`, `"use server"`. Each
   action: calls `requireTrainerAdmin()` first; validates input PRE-WRITE using
   the exercise/workout shapes from `lib/ai/schemas.ts`; enforces the safety-note
   rule (reject an edit that would leave any exercise without `safety_notes` when
   the target client has limitations); returns `ActionResult`; on success
   revalidates the localized client-dashboard paths (`/en` and `/he`) and the
   client's `my-plan` paths, following the `RegenerateClientPlan` revalidation
   pattern. Pre-write validation avoids needing transactional rollback (Supabase
   has no client-side transaction here).

4. Editor UI - on `app/[locale]/trainer/clients/[clientId]/client-dashboard.tsx`
   (or a dedicated client component it renders), add an edit surface over the
   plan detail from batch 24: edit workout metadata, edit each exercise's fields,
   add/remove exercises, add a workout, and remove a workout (with the
   logs-present case surfaced as a localized, blocking message rather than a
   silent failure). Refresh on success like `RegenerateClientPlan`.

5. Messages - add the authoring/editor copy (AI-create labels, field labels,
   add/remove/save labels, the "cannot delete a workout with logged sessions"
   message, and validation errors) to BOTH `messages/en-US.json` and
   `messages/he-IL.json` with real Hebrew translations.

6. Add TSDoc to every new exported helper, action, and non-trivial component.

## Required Tests

1. AI template UI test: the "Create with AI" path invokes `createAiTemplateAction`
   with an injected fake generator (no real AI call) and persists the template.
2. Manual-edit persistence (integration, mocked Supabase): `updateExercise` and
   `updateWorkout` write only the intended fields; `addExercise` / `addWorkout`
   insert; `deleteExercise` removes.
3. Destructive-path tests:
   - `deleteWorkout` is REJECTED when `workout_logs` reference the workout.
   - a workout-metadata edit leaves existing `workout_logs` rows intact.
4. Safety-note re-validation: an edit that clears `safety_notes` is rejected for
   a client WITH limitations and accepted for a client WITHOUT limitations
   (mirror the batch-08 validator test).
5. Authorization: each new server action rejects a non-admin caller
   (`requireTrainerAdmin` enforced), asserted per action.
6. i18n key-parity assertion for the new authoring keys across `en-US.json` and
   `he-IL.json`.
7. Playwright e2e (extend the existing trainer spec, creds-gated so it skips
   without seeded admin creds): an admin edits a seeded client's live plan
   (changes an exercise's reps) and the change persists on reload.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`
5. `npx playwright test`

Manual check (document, do not block the gate): in `/en` and `/he`, from the plan
manager create a template with AI; from a client dashboard edit an exercise's
sets/reps and save; confirm the change persists; confirm a workout that has
logged sessions cannot be deleted and shows the blocking message; confirm a
non-admin cannot reach these actions.

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Add AI template authoring and safe live-plan editor"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions (especially how workout deletion is guarded
   against the `workout_logs` cascade, and where pre-write validation sits).
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up (notably whether the batch 19 deployment smoke
   should be re-run).
