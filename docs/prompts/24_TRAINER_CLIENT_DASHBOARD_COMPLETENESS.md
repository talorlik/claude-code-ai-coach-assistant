# 24 - TRAINER CLIENT DASHBOARD COMPLETENESS

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

- Batches 00-23 shipped. There are exactly TWO roles: `admin` (the trainer) and
  `customer`. `/[locale]/admin` is the top-level admin dashboard; `/[locale]/
  trainer` is the trainer dashboard reached from it;
  `app/[locale]/trainer/clients/[clientId]/` is the per-client dashboard.
- The client dashboard already shows: profile summary, plan title + completion %,
  weekly and monthly progress charts, workout log, AI chat transcript, WhatsApp
  button, and private trainer notes.
- Helpers this batch REUSES (do not reimplement):
  - `getTrainerClientDetail(clientId, reference?)` in
    `lib/db/trainer-client-detail.ts` - shapes the dashboard data server-side.
  - `getActivePlanDetail(clientId)` in `lib/db/workouts.ts` - ALREADY loads the
    active plan with its workouts (ordered) and each workout's exercises
    (ordered) and the completion logs. The exercise rows already carry
    `name, sets, reps, duration, rest, instructions, safety_notes, position`.
  - `lib/db/push-subscriptions.ts` - data access for `push_subscriptions`. RLS
    grants the admin read access to any client's rows (migration `0002`, the
    `push_subscriptions` policy).
  - The PDF route `GET /api/pdf/workout-plan?clientId={id}&locale={en|he}`
    (`app/api/pdf/workout-plan/route.ts`) already authorizes the admin to export
    ANY client's plan and 404s when there is no active plan.
  - The locale-aware `Link` from `@/i18n/navigation`; the `TrainerDashboard`
    i18n namespace.

This batch adds NO new tables and NO AI. It fills three rendering/surfacing gaps
on the existing client dashboard so it matches
`docs/planning/ADMIN_CAPABILITIES.md` sections 2, 4, 12, and 13.

Before editing, inspect the current code structure and explain the files you
will touch.

## Goal

Complete the trainer client dashboard: render the full workout-plan detail
(workouts and exercises with sets, reps, duration, rest, execution instructions,
and safety notes), add an admin-facing PDF export button, and surface the
client's push-reminder readiness (enabled / disabled / unavailable).

## Scope

Read-and-render plus one new read helper. No writes, no schema, no AI. The plan
detail uses data ALREADY fetched by `getActivePlanDetail` - do not add new plan
queries; thread the existing `workouts`/`exercises` through the dashboard's
serializable data shape. The PDF button is a pure link to the existing route.

## Tasks

1. Plan detail data - `lib/db/trainer-client-detail.ts`. Extend the
   `ClientDashboardData` shape so it carries the active plan's workouts and their
   exercises (serializable: day/title/focus/notes per workout;
   name/sets/reps/duration/rest/instructions/safety_notes per exercise, in
   `position` order). Source this from the data `getActivePlanDetail` already
   returns; do not issue new queries for it.

2. Plan detail UI - `app/[locale]/trainer/clients/[clientId]/client-dashboard.tsx`
   (and a small presentational sub-component if it keeps the file readable).
   Render the weekly structure: each workout with its exercises and every field
   above, plus rest days and safety notes. Must be RTL-correct under `/he` and
   readable in light and dark themes. When there is no active plan, keep the
   existing empty state.

3. PDF export button - in the dashboard, add a localized button/link to
   `/api/pdf/workout-plan?clientId={clientId}&locale={locale}` using the active
   locale. Render it only when an active plan exists (hide or disable otherwise,
   since the route 404s without a plan). It triggers a file download; do not
   build a new client-side PDF path.

4. Push-reminder status - add a read helper (e.g. `getClientPushStatus(clientId):
   Promise<"enabled" | "disabled" | "unavailable">`) in
   `lib/db/push-subscriptions.ts`: `enabled` when at least one enabled
   subscription exists; `disabled` when subscriptions exist but none are enabled;
   `unavailable` when none exist. Add TSDoc. Thread the status into
   `ClientDashboardData` (via `getTrainerClientDetail`) and render a localized
   status indicator on the dashboard.

5. Messages - add the new dashboard copy keys (plan-detail section labels, field
   labels for sets/reps/rest/duration/instructions/safety notes, the PDF button
   label, and the three push-status labels) to BOTH `messages/en-US.json` and
   `messages/he-IL.json` with real Hebrew translations.

6. Add/extend TSDoc on the changed data helpers and the dashboard component.

## Required Tests

1. Plan-detail render test: given a client with an active multi-workout plan, the
   dashboard renders each workout and each exercise with all required fields
   (sets, reps, duration, rest, instructions, safety notes), asserted explicitly;
   verify it renders under `/he` (RTL) as well as `/en`.
2. Empty-plan test: with no active plan, the plan-detail section shows the empty
   state and the PDF button is absent/disabled.
3. PDF button test: when an active plan exists, the button links to
   `/api/pdf/workout-plan?clientId={id}&locale={locale}` with the correct locale
   for `/en` and `/he`.
4. Data-layer test for `getClientPushStatus`: maps subscription rows to
   `enabled` / `disabled` / `unavailable` correctly (mock the Supabase client the
   way the other `lib/db` tests do).
5. Push-status render test: the dashboard shows the correct localized indicator
   for each of the three states.
6. i18n key-parity assertion for the new dashboard keys across `en-US.json` and
   `he-IL.json`.
7. Playwright e2e (extend the existing trainer dashboard spec, creds-gated): an
   admin opens a seeded client and sees the plan detail and a PDF export control.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`
5. `npx playwright test`

Manual check (document, do not block the gate): open a client dashboard in `/en`
and `/he`; confirm the full plan detail renders with safety notes and is RTL-
correct; click PDF export and confirm a download for both locales; confirm the
push-status indicator reflects the client's actual subscription state.

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Render full plan detail, PDF export, and push status on client dashboard"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions (especially that plan detail reuses already-
   fetched data, and how the PDF button is gated on an active plan).
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
