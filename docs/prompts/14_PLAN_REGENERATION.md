# 14 - PLAN REGENERATION

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

Implement safe plan regeneration for clients and trainer admin while preserving
history.

## Scope

Plan regeneration only.

## Tasks

1. Add regeneration entry point on client My Plan page.
2. Add regeneration entry point on trainer client dashboard.
3. Require regeneration reason.
4. Load latest onboarding/client profile data.
5. Call existing AI generation flow with regeneration source.
6. Archive old active plan only after new plan validates.
7. Set new plan active.
8. Create `plan_generation_events` row.
9. Preserve old plans and workout logs.
10. Show localized success/error states.
11. Add TSDoc to regeneration helpers.

## Required Tests

1. Unit tests for regeneration reason validation.
2. Integration test: valid regeneration archives old active plan and creates new
   active plan.
3. Integration test: invalid AI response does not replace current active plan.
4. Integration test: old workout logs remain available.
5. Playwright smoke test for trainer-triggered regeneration with mocked AI.

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
git commit -m "Add workout plan regeneration"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
