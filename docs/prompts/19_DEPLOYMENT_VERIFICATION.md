# 19 - DEPLOYMENT VERIFICATION

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

Before editing, inspect the current code structure and explain the files you
will touch.

## Goal

Verify final local, preview, and production deployment readiness.

## Scope

Verification and final fixes only.

## Tasks

1. Run final local verification commands.
2. Verify `.env.local` is not committed.
3. Verify Vercel preview and production environment variable names exist.
4. Verify Supabase auth redirect URLs include local and Vercel URLs.
5. Verify Supabase RLS is enabled on all app tables.
6. Verify GitHub push triggers preview/production deployment according to
   branch.
7. Deploy preview from a branch if not already available.
8. Smoke test localized homepage, auth, onboarding, my-plan, chat, trainer
   admin, push settings, and PDF export in preview.
9. Smoke test AI route with safe mocked or minimal test input.
10. Verify production build and no blocking lint/type errors.
11. Produce final submission checklist status.

## Required Tests

1. Final build.
2. Final lint.
3. Final typecheck.
4. Final unit/integration/e2e tests.
5. Preview smoke tests.
6. Production smoke tests if production deploy is ready.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`
5. `npx playwright test`

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Verify deployment readiness"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
