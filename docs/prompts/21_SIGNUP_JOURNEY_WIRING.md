# 21 - SIGNUP JOURNEY WIRING

## Claude Code Prompt

You are working inside an existing Next.js 16.1.7 App Router project generated
from the AI Game Changer template.

Non-negotiable constraints:

1. Use TypeScript 5.9.3.
2. Use the App Router.
3. Use root `proxy.ts` for locale-aware request handling.
4. Do not create root `middleware.ts` unless the installed template explicitly
   requires a compatibility shim.
5. Use `next-intl` `^4.13.0` with `/en` and `/he` route prefixes.
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

- Template installed.
- `/start-from-template` executed.
- `/setup-vercel-ai` executed.
- `/setup-github` executed.
- `/setup-vercel` executed.
- Accounts connected.
- Environment variables implemented but requiring verification.
- Auth mechanisms implemented but requiring verification.
- Batches 00-20 shipped. The full data layer and AI features already exist:
  - The `clients` onboarding table, the `workout_plans` / `workouts` /
    `exercises` hierarchy, `workout_logs`, and `chat_messages`, all with RLS.
  - Server-side AI plan generation (`lib/onboarding/onboarding-actions.ts`
    `saveOnboarding`, `lib/ai/*`) and regeneration (`lib/ai/regenerate-plan.ts`).
  - The onboarding questionnaire at `app/[locale]/join/`, the plan view at
    `app/[locale]/my-plan/`, the chat at `app/[locale]/chat/`, the trainer
    surfaces, PDF export, and push notifications.
  - Data-access helpers this batch REUSES (do not reimplement):
    - `getClient(clientId)` in `lib/db/clients.ts` - returns the caller's
      onboarding row or `null`.
    - `getActivePlanDetail(userId)` in `lib/db/workouts.ts` - returns the active
      plan with workouts/exercises/logs, or `null` when there is no active plan.
    - `ensureProfile(userId)` in `lib/profile/profile-actions.ts`.
    - `isAdmin(userId)` / `getCurrentUserRole()` in `lib/auth/roles.ts`.
    - `safeRedirect(formData)` already in `app/[locale]/login/actions.ts`.

This batch adds NO new tables, NO new AI, and NO schema changes. It only wires
the already-built pieces into the end-to-end journey described in
`docs/planning/USER_JOURNEY.md`. The seams are currently broken: a confirmed new
user lands on `/profile` with no path to onboarding, login ignores onboarding
state, the nav never links to the plan, and onboarding success requires a manual
button click.

Before editing, inspect the current code structure and explain the files you
will touch.

## Goal

Wire the signup-to-plan journey so a brand-new user flows homepage -> register ->
email confirm -> onboarding questionnaire (`/join`) -> AI plan generation ->
plan view (`/my-plan`) with no manual URL typing, in both `/en` and `/he`, while
leaving the password-recovery flow completely untouched.

## Scope

Routing and navigation wiring only: a shared post-auth destination resolver, the
email-confirm landing decision, the post-login decision, onboarding-success
auto-redirect, and one navigation link. No new business features, no schema, no
AI changes.

Onboarding is SOFT-routed, not hard-gated: incomplete users are routed toward
`/join`, but `/my-plan` and `/chat` are NOT blocked. Do not modify `proxy.ts` or
the `requireClient` / `requireTrainerAdmin` guards in `lib/auth/require-user.ts`.

## Tasks

1. Create a shared resolver `lib/auth/post-auth-redirect.ts` exporting an
   async server-only `resolvePostAuthDestination(userId: string):
   Promise<string>`. It returns a locale-agnostic in-app path (no locale prefix;
   callers apply the locale via the existing `redirect` helper / `NextResponse`).
   Decision order:
   - admin (`isAdmin(userId)` true) -> `/admin`.
   - else `getClient(userId)` is `null` (no onboarding row) -> `/join`.
   - else `getActivePlanDetail(userId)` is non-null (active plan exists) ->
     `/my-plan`.
   - else (onboarded but no active plan) -> `/join`.
   Add TSDoc. The resolver runs under the request-scoped Supabase client (RLS).
   It must NOT take or honor an external `redirect` target - same-site
   `?redirect=` handling stays in the login action (task 2), so the resolver has
   a single, testable responsibility.

2. Post-login decision flow - `app/[locale]/login/actions.ts`, `login()`.
   Replace the final flat target (`admin ? "/admin" : "/profile"`) with:
   - if `safeRedirect(formData)` returns a safe same-site path, use it (preserve
     today's behavior exactly);
   - else use `await resolvePostAuthDestination(data.user.id)`.
   Keep `ensureProfile`, the remember-me logic, captcha, and the generic
   invalid-credentials handling unchanged.

3. Email confirm landing - `app/auth/confirm/route.ts`. The decision flow applies
   to SIGNUP confirmation only. Branch on `type`:
   - `type === "recovery"` -> redirect to `/reset-password` exactly as today.
     This branch must NEVER call `resolvePostAuthDestination`. Password recovery
     must not enter the onboarding/my-plan flow. This is a hard constraint with
     its own test.
   - otherwise (`signup`, email-change, `invite`) -> after `ensureProfile`,
     redirect to `await resolvePostAuthDestination(data.user.id)`.
   Extend `ALLOWED_NEXT` to include `/join` and `/my-plan` (keep `/profile` and
   `/reset-password`) so an explicit, allowlisted `next` is still honored; an
   explicit `next` that is present and allowlisted takes precedence over the
   resolver, otherwise the resolver decides. Preserve the open-redirect
   protection (same-host, allowlist) and the token-failure path
   (`/login?error=resetLinkInvalid`). Note `redirectTo.pathname` here is the
   non-localized path; keep the existing locale handling intact.

4. Onboarding-success auto-redirect -
   `app/[locale]/join/onboarding-form.tsx`. When `saveOnboarding` returns
   `result.ok` with `planGenerated === true`, navigate to `/my-plan`
   automatically via the locale-aware router (`router.push("/my-plan")`) instead
   of relying on a manual "View Plan" click. Keep a brief localized
   success/redirecting state (preserve `role="status"`). The `planPending`
   branch (`planGenerated === false`) is unchanged and keeps its existing button.

5. Navigation discoverability - `components/site-header.tsx`. For a signed-in
   non-admin user, add a locale-aware link to `/my-plan` using a new `Nav.myPlan`
   message key. Place it alongside the existing `chat` / `account` links. The
   `/my-plan` empty state already routes to `/join`, so `/my-plan` is the single
   client entry point; do NOT add a raw `/join` link to the header, and do NOT
   change the homepage CTA (it stays `/register`, the documented entry point for
   signed-out visitors).

6. Messages - add `Nav.myPlan` to `messages/en-US.json` and `messages/he-IL.json`
   (Hebrew translation). If task 4's redirecting state needs new copy, add
   `Onboarding.success.redirecting` to both catalogs; otherwise reuse existing
   `Onboarding.success.*` keys.

7. Add TSDoc to `resolvePostAuthDestination` and update the TSDoc on `login()`
   and the confirm route handler to describe the new routing.

## Required Tests

1. Unit test `resolvePostAuthDestination` (mock the Supabase-backed helpers):
   - admin -> `/admin`.
   - no client row -> `/join`.
   - client row + active plan -> `/my-plan`.
   - client row + no active plan -> `/join`.
2. Unit/integration test for `login()` routing (mock Supabase + the resolver):
   - a safe `?redirect=` value is honored over the resolver.
   - an unsafe/external `redirect` is rejected and the resolver decides.
   - with no redirect, the resolved destination is used.
3. Unit/integration test for the confirm route:
   - `type=signup` redirects to the resolver's destination.
   - `type=recovery` redirects to `/reset-password` and NEVER invokes
     `resolvePostAuthDestination` (assert the resolver is not called, e.g. via a
     spy, and that the target is `/reset-password`).
   - an allowlisted explicit `next` (e.g. `/my-plan`) is honored.
   - a non-allowlisted `next` falls back to the resolver (signup) or
     `/reset-password` (recovery).
   - invalid/expired token -> `/login?error=resetLinkInvalid`.
4. Reset-flow regression test: `setNewPassword`
   (`app/[locale]/reset-password/actions.ts`) still ends at
   `/login?notice=passwordUpdated` with the sign-out preserved - guards against
   the recovery path leaking into the new routing.
5. Onboarding-form test: `planGenerated === true` triggers navigation to
   `/my-plan`; `planGenerated === false` keeps the pending state and its button.
6. Site-header test: a signed-in non-admin sees the My Plan link; a signed-out
   visitor does not.
7. Playwright e2e (extend existing registration/login specs; mock or seed
   `clients` / plan state the way the current e2e harness does):
   - after login a new user (no client row) lands on `/en/join`, and the `/he`
     equivalent works.
   - after login an onboarded user with an active plan lands on `/en/my-plan`.
   - assert the localized URLs (`/en/...`, `/he/...`) are correct.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`
5. `npx playwright test`

Manual check (document, do not block the gate): in both `/en` and `/he`, register
a fresh email -> click the confirm link -> land on `/join` -> complete the
questionnaire -> auto-land on `/my-plan` with the generated plan rendered. Log in
as an existing onboarded user -> land on `/my-plan`. Confirm the header shows the
My Plan link when signed in. Confirm a password-reset link still lands on
`/reset-password` and, after setting a new password, on `/login`.

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Wire signup-to-plan journey routing"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions (especially how the recovery path is insulated
   from the new decision flow, and where `?redirect=` precedence sits).
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up (notably whether the batch 19 deployment
   smoke should be re-run, since this changes user-facing post-auth routing).
