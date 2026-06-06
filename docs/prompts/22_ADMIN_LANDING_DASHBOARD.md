# 22 - ADMIN LANDING DASHBOARD

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

- Template installed; `/start-from-template`, `/setup-vercel-ai`,
  `/setup-github`, `/setup-vercel` executed; accounts connected; env and auth
  implemented but requiring verification.
- Batches 00-21 shipped. There are exactly TWO roles: `admin` and `customer`,
  where the admin IS the trainer (the `public.app_role` enum is `admin |
  customer`; `is_trainer_admin()` and `requireTrainerAdmin()` are the admin gate;
  there is no separate trainer role).
- The trainer-specific surfaces already exist and are localized and role-gated:
  `app/[locale]/trainer/page.tsx` (client list),
  `app/[locale]/trainer/clients/[clientId]/` (client dashboard),
  `app/[locale]/trainer/plans/` (template manager).
- `app/[locale]/admin/page.tsx` is currently a hardcoded-English STUB with only
  chat/profile links, guarded by `app/[locale]/admin/layout.tsx`
  (`requireAdmin()`).
- The post-auth resolver `resolvePostAuthDestination(userId)` in
  `lib/auth/post-auth-redirect.ts` already returns `/admin` for admins.
- Helpers this batch REUSES (do not reimplement): the locale-aware `Link` from
  `@/i18n/navigation`; `requireAdmin()` (`lib/auth/require-admin.ts`, an alias of
  `requireTrainerAdmin()`); `isAdmin(userId)` (`lib/auth/roles.ts`).

This batch adds NO new tables, NO new AI, and NO schema changes. It turns
`/[locale]/admin` into the real, localized TOP-LEVEL admin landing dashboard: the
admin's post-login home and the hub that links to all admin capabilities,
including the trainer area. The required admin landing routes are `/en/admin` and
`/he/admin` (see `docs/planning/ADMIN_CAPABILITIES.md`).

Before editing, inspect the current code structure and explain the files you
will touch.

## Goal

Make `/[locale]/admin` the localized top-level admin dashboard and the admin's
post-login landing page, with clear navigation to the admin capabilities -
chiefly the trainer area at `/trainer` for client and plan management.

## Scope

Routing and the admin dashboard UI only. No new business features, no schema, no
AI. Do not change `proxy.ts`, the `require*` guards, or the password-recovery
flow. Do not collapse or remove `/trainer`; `/admin` links TO it. The admin and
trainer pages are authorization-identical (one `admin` role) and differ only in
purpose/content.

Settings is explicitly DEFERRED: no admin-settings model exists, so the dashboard
must NOT link to or stub a settings page. Admin-role assignment remains the manual
SQL flow documented in `docs/ADMIN_ROLE_SETUP.md`; the dashboard may reference it
but must not add a public role-assignment UI.

## Tasks

1. Post-auth destination - `lib/auth/post-auth-redirect.ts`. The admin branch
   already returns `/admin`; keep it. Update the function's decision-order TSDoc
   to describe `/admin` as the top-level admin dashboard (not a stub).

2. Admin dashboard UI - `app/[locale]/admin/page.tsx`. Replace the stub body with
   a localized dashboard: a heading, a short localized intro, and a set of
   navigation cards/links to the admin capabilities. The primary card is the
   trainer area linking to `/trainer` (described as client and plan management).
   Keep useful account/chat links. Use the locale-aware `Link`. Keep
   `app/[locale]/admin/layout.tsx` and its `requireAdmin()` guard untouched.
   RTL-correct under `/he`, readable in light and dark themes.

3. New i18n namespace - add an `AdminDashboard` namespace to BOTH
   `messages/en-US.json` and `messages/he-IL.json` with matching keys (dashboard
   title, intro, and the navigation labels). Provide real Hebrew translations.

4. Navigation - `components/site-header.tsx`. Confirm the admin sees both an
   "Admin" link to `/admin` and a "Clients" link to `/trainer`, and that neither
   renders for a non-admin. Do not remove either link.

5. Update the TSDoc on the admin page component to describe its role as the
   top-level admin dashboard.

## Required Tests

1. Unit test `resolvePostAuthDestination`: the admin branch resolves to `/admin`
   (assert it explicitly); the non-admin branches are unchanged.
2. Admin dashboard render test: for an admin, the page renders a localized
   dashboard in `/en` and `/he` and exposes a link to `/trainer`.
3. Role-gating regression: a signed-out visitor hitting `/admin` is redirected to
   the localized login; a non-admin (customer) is redirected to home.
4. Site-header test: an admin sees both the Admin (`/admin`) and Clients
   (`/trainer`) links; a non-admin sees neither.
5. i18n key-parity assertion for the new `AdminDashboard` namespace across
   `en-US.json` and `he-IL.json`.
6. Locale-aware navigation: assert the dashboard's links render with the active
   locale prefix - the trainer-area link resolves to `/en/trainer` under `/en`
   and `/he/trainer` under `/he` - and that no link uses `next/link` or a raw
   `<a href>`.
7. Playwright e2e (extend the existing trainer spec, creds-gated so it skips
   cleanly without seeded admin creds): an admin logging in lands on `/en/admin`
   (and `/he/admin`) and can follow the trainer-area link to `/trainer`, staying
   in the same locale throughout.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`
5. `npx playwright test`

Manual check (document, do not block the gate): sign in as the admin
(`talorlik@gmail.com`) in `/en` and `/he`; confirm landing on `/admin` as a
localized dashboard; confirm the trainer-area link reaches `/trainer`; confirm a
non-admin cannot reach `/admin`.

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Add localized admin landing dashboard and routing"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions (especially the two-level `/admin` -> `/trainer`
   model and that `/admin` is the post-login landing).
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up (notably whether the batch 19 deployment smoke
   should be re-run, since this changes the admin post-login landing content).
