# 18 - TEST HARDENING

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

Complete and stabilize required unit, integration, and end-to-end test coverage.

## Scope

Testing only unless bugs are discovered by tests.

## Tasks

1. Audit required test coverage from PRD and task breakdown.
2. Add missing unit tests for validation, locale, role, theme, progress, AI
   parsing, plan regeneration, and push helpers.
3. Add missing integration tests for auth, onboarding save, plan save, workout
   completion, chat persistence, admin authorization, trainer notes, templates,
   and regeneration.
4. Add missing Playwright tests for client registration/login, onboarding, plan
   view, completion, chat, admin list/dashboard, locale URLs, Hebrew RTL, and
   theme switching.
5. Mock external AI calls consistently.
6. Use stable seeded test data.
7. Ensure tests do not depend on real AI responses.
8. Add or fix npm scripts for test execution.
9. Document any intentionally skipped test with a precise reason.

## Required Tests

1. Full unit test suite.
2. Full integration test suite.
3. Full Playwright suite or documented CI-safe subset.
4. Coverage of all assignment-required flows.

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
git commit -m "Harden automated test coverage"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
