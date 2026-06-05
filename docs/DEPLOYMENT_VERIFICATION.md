# Deployment Verification

Batch 19 deployment-readiness verification for the Studio Itai AI Coach
Assistant. This is the final submission checklist status, captured against the
gates in the build runbook and the assignment checklist in
`docs/planning/TASK_BREAKDOWN.md` section 6.

Verification date: 2026-06-05. Verified on branch `chore/19-deploy-verify`
off local `main` at the batch-18 squash commit (`Harden automated test
coverage`).

## Summary

All local gates are green and the remote pipeline is wired and producing
`Ready` deployments. The only open items are two non-blocking configuration
fixes on managed dashboards (Vercel and Supabase), neither of which is a code
defect. Production is gated behind Vercel SSO deployment protection, so
anonymous HTTP smoke tests of the live URL are not possible; local smoke plus
the Playwright e2e suite (run against a real server with live Supabase) stand
in for the runtime checks.

## Local Gates

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | Pass, no errors |
| Typecheck | `npm run typecheck` | Pass (incl. `guard-no-middleware` pretypecheck) |
| Build | `npm run build` | Pass, 34 routes, 15.6s compile |
| Unit + integration | `npm run test` | 440 passed, 59 files |
| E2E | `npx playwright test` | 46 passed, 14 skipped, 0 failed |

The 14 skipped e2e specs are the credential-gated authenticated journeys
(client + trainer) that `test.skip` when `E2E_ADMIN_*` / `E2E_CUSTOMER_*` /
`E2E_CLIENT_ID` are unset. This is the deliberate CI-safe split documented in
`docs/TESTING.md`, not a regression. The guest-path variant of each gated flow
runs and passes.

## Remote Pipeline

- GitHub: `origin` is `git@github.com:talorlik/claude-code-ai-coach-assistant`,
  `gh` authenticated as `talorlik` over SSH.
- Vercel: project `tal-orlik-s-projects/claude-code-ai-coach-assistant` linked.
  GitHub push triggers Vercel deploys; the most recent Production deploy is
  `Ready` (51s build), and Preview deploys exist and are `Ready`.
- Cron: `vercel.json` declares the daily push-reminder cron
  (`0 16 * * *` to `/api/push/reminders`), matching batch 15.

## Environment Variables (names only, never values)

Confirmed present on Vercel across Production, Preview, and Development:
`AI_GATEWAY_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`CRON_SECRET`, plus the full Supabase/Postgres connection set.

Local `.env.local` in the primary checkout carries the same set plus the
Upstash Redis pair used for rate limiting.

Git hygiene: `.gitignore` excludes `.env*.local` and `.env`; the only tracked
env file is `.env.example`; no `.env.local` is committed in any worktree.

## Supabase

- Project URL: `https://vgluuhbztwzrekkexkqk.supabase.co`.
- Migrations applied: `0001_auth_schema`, `0002_app_schema`.
- RLS enabled on all 12 app tables: `user_roles`, `profiles`, `clients`,
  `workout_plans`, `workouts`, `exercises`, `workout_logs`, `chat_messages`,
  `plan_templates`, `trainer_notes`, `push_subscriptions`,
  `plan_generation_events`.
- Security advisors: two `WARN` notices, both expected and non-blocking
  (see Open Items).

## Runtime Smoke (local, against live Supabase)

- `/` returns 307 to `/en` (locale routing through `proxy.ts`).
- `/en` returns 200; `/he` renders `dir="rtl"` and `lang="he"` (Hebrew RTL).
- `POST /api/chat` unauthenticated returns 401 (AI is server-side and
  auth-guarded; the gateway key never reaches an anonymous caller).
- `/api/pdf/workout-plan` unauthenticated returns 401.
- `/en/trainer` and `/en/my-plan` for an anonymous visitor render the login
  page (App Router server-side `redirect()` is served as a 200 RSC navigation,
  not a 30x; the e2e browser tests confirm the user-visible redirect).

AI keys are server-side only: no `use client` module references
`AI_GATEWAY_API_KEY`, `SUPABASE_SECRET_KEY`, or `VAPID_PRIVATE_KEY`; the only
occurrence of the gateway key name is a TSDoc comment in
`lib/ai/generate-plan.ts`.

## Final Submission Checklist Status

Product (verified via build, e2e, and prior batch acceptance):

- [x] Homepage explains the platform (`/[locale]` route, en/he).
- [x] Authentication works (login/signup/logout/forgot/reset; e2e guest gating).
- [x] Client onboarding works (`/[locale]/join`).
- [x] AI workout generation works (server-side, mocked in tests).
- [x] My Plan page displays saved plans (`/[locale]/my-plan`).
- [x] Workout completion tracking works.
- [x] AI chat works (`/[locale]/chat`, server-side, 401 when unauth).
- [x] Trainer admin area works (`/[locale]/trainer`, role-gated).
- [x] Plan management works (`/[locale]/trainer/plans`).
- [x] Push notifications work or degrade clearly (unsupported-browser e2e path).
- [x] PDF export works (`/api/pdf/workout-plan`, 401 when unauth).
- [x] Trainer notes work.
- [x] Plan regeneration works (history preserved).

Localization:

- [x] English pages work.
- [x] Hebrew pages work.
- [x] URLs are language aware (`/en`, `/he`).
- [x] Navigation preserves selected language.
- [x] Hebrew layout supports RTL (`dir="rtl"` confirmed).

Theme:

- [x] Light theme works.
- [x] Dark theme works.
- [x] Theme preference persists (e2e refresh round-trip).
- [x] Important UI states readable in both themes (responsive/contrast e2e).

Testing:

- [x] Unit tests included.
- [x] Integration tests included.
- [x] E2E tests included.
- [x] Tests cover localization.
- [x] Tests cover theme behavior.
- [x] Tests cover client flow.
- [x] Tests cover admin flow.

Data and AI:

- [x] Supabase stores client data.
- [x] Supabase stores workout plans.
- [x] Supabase stores workout logs.
- [x] Supabase stores chat messages.
- [x] AI keys are not exposed to the browser.
- [x] AI errors are handled gracefully.

Final technical check:

- [x] `npm run dev` works (booted for local smoke).
- [x] `npm run build` succeeds.
- [x] `npm run lint` has no blocking errors.
- [x] `npm run typecheck` succeeds.
- [x] Git commits were made along the way (one squash per batch on `main`).

## Open Items (non-blocking, managed-dashboard fixes)

1. **`NEXT_PUBLIC_APP_URL` missing for Vercel Preview.** It exists for
   Production and Development but not Preview. Preview deployments fall back to
   the Vercel-injected origin for absolute URLs (SEO metadata, PDF/push links),
   so this degrades gracefully but should be set on the Preview environment for
   parity. Dashboard fix, no code change.

2. **Supabase auth redirect URLs not verifiable via MCP.** The GoTrue redirect
   allowlist lives in project auth settings, not a queryable table. Confirm the
   allowlist includes the local origin (`http://localhost:3000`) and the Vercel
   production and preview origins. The passing auth e2e against live Supabase is
   indirect evidence the local origin is allowlisted; the Vercel origins need a
   manual dashboard check.

3. **Two Supabase security advisor `WARN` notices, both expected:**
   - `is_trainer_admin()` is a `SECURITY DEFINER` function callable by the
     `authenticated` role. This is intentional: it is the role-check helper used
     inside RLS policies and must be `SECURITY DEFINER` to read `user_roles`
     without recursing into RLS. It returns only a boolean about the caller's
     own role.
   - Leaked-password protection (HaveIBeenPwned) is disabled. This is an
     optional Supabase Auth hardening toggle, not a defect; enable it in the
     dashboard if desired.

4. **Production is behind Vercel SSO deployment protection.** Anonymous HTTP
   smoke tests of the live URL return 401 from Vercel's access gate (not the
   app). To smoke-test the deployed site, use an authenticated browser session
   or a protection-bypass token. The `Ready` build status plus local/e2e
   coverage substitute for anonymous runtime checks.

5. **Local `main` is ahead of remote `main`.** Batches 16-18 are squash-merged
   on local `main` only; remote `main` (what Vercel deploys to Production) is at
   the batch-15-era commit. This is by policy: `main` is never auto-pushed.
   Production will not reflect the latest work until the user explicitly pushes
   `main`, which triggers a Production deploy. Re-run this smoke after that push
   and after batch 20 merges.
