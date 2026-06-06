# 23 - TRAINER DASHBOARD AND NAVIGATION

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

- Batches 00-22 shipped. There are exactly TWO roles: `admin` (the trainer) and
  `customer`. `/[locale]/admin` is the localized top-level admin dashboard and the
  admin's post-login landing; it links to the trainer area.
- The trainer-specific surfaces already exist and are localized and role-gated:
  - `app/[locale]/trainer/page.tsx` - the client list (name, goal, join date,
    plan status, current-month completion %, traffic-light activity), guarded by
    `requireTrainerAdmin()`. This is the analytics/overview surface.
  - `app/[locale]/trainer/clients/[clientId]/` - the per-client dashboard.
  - `app/[locale]/trainer/plans/` - the plan-template manager
    (`plans-manager.tsx`).
  - i18n namespaces `TrainerClients`, `TrainerDashboard`, `TrainerPlans`,
    `Regeneration`, `Nav`, and `AdminDashboard` (batch 22) in both catalogs.
- Helpers this batch REUSES (do not reimplement): `requireTrainerAdmin()`
  (`lib/auth/require-user.ts`); the locale-aware `Link` from `@/i18n/navigation`.

This batch adds NO new tables, NO new AI, and NO schema changes. It makes
`/[locale]/trainer` the trainer-specific DASHBOARD reached from the admin
dashboard: the hub for managing all clients and their plans. The required trainer
routes are `/en/trainer` and `/he/trainer` (see
`docs/planning/ADMIN_CAPABILITIES.md`).

Before editing, inspect the current code structure and explain the files you
will touch.

## Goal

Make `/[locale]/trainer` the trainer-specific dashboard, reached from
`/[locale]/admin`, with clear localized navigation into client management (the
client list) and plan management (the plan-template manager), and a path back to
the admin dashboard.

## Scope

Navigation and the trainer dashboard UI only. No new business features, no
schema, no AI. Do not change `proxy.ts`, the `require*` guards, or the
password-recovery flow. Do not introduce a `/trainer/layout.tsx` guard in addition
to the existing per-page `requireTrainerAdmin()` - keep a single guard.

Analytics is the existing client list (do not build a separate analytics page).
Notes are inherently per-client and are reached through a client dashboard, so the
trainer dashboard must NOT add a standalone notes link.

## Tasks

1. Trainer dashboard UI - `app/[locale]/trainer/page.tsx`. Keep the existing
   client list as the dashboard's primary content. Add a localized dashboard
   header and a navigation region (cards or a link row) that links to:
   - the client list (this page / its overview), and
   - the plan-template manager at `/trainer/plans` (this closes the gap where
     `/trainer/plans` was only reachable by typing the URL).
   Add a localized "back to admin" link to `/admin` so the two-level hub is
   navigable both ways. Use the locale-aware `Link`. Keep the page guarded by the
   existing `requireTrainerAdmin()`; do not add a second guard.

2. Confirm the `/admin` "Trainer area" link from batch 22 lands on this page;
   adjust the label/target if needed for consistency.

3. New i18n namespace - add a `TrainerHub` namespace to BOTH
   `messages/en-US.json` and `messages/he-IL.json` with matching keys (dashboard
   title, a short subtitle, the link labels for the client list and plan
   templates, and the back-to-admin label). Provide real Hebrew translations.

4. Update the TSDoc on the trainer page component to describe its role as the
   trainer-specific dashboard reached from `/admin`.

## Required Tests

1. Trainer dashboard render test: for an admin, the page renders localized in
   `/en` and `/he` and exposes links to the client list, `/trainer/plans`, and
   back to `/admin`.
2. Role-gating regression: a signed-out visitor hitting `/trainer` is redirected
   to the localized login; a non-admin is redirected to home.
3. i18n key-parity assertion for the new `TrainerHub` namespace across
   `en-US.json` and `he-IL.json`.
4. Locale-aware navigation: assert the dashboard's links carry the active locale
   prefix in both `/en` and `/he` (client list, `/trainer/plans`, and the
   back-to-admin link), and that none use `next/link` or a raw `<a href>`.
5. Playwright e2e (extend the existing trainer spec, creds-gated): an admin
   navigates `/admin` -> `/trainer` -> `/trainer/plans` in both locales, with the
   locale prefix preserved at every hop (no drop to the default locale).

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`
5. `npx playwright test`

Manual check (document, do not block the gate): from `/admin`, follow the
trainer-area link to `/trainer` in `/en` and `/he`; confirm the trainer dashboard
links reach the client list and `/trainer/plans` and back to `/admin`.

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Add trainer dashboard and admin navigation"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions (especially how the trainer dashboard relates to
   the admin dashboard in the two-level hub).
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
