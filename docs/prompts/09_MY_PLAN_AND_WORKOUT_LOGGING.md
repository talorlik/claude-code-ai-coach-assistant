# 09 - MY PLAN AND WORKOUT LOGGING

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

Build the client plan page and workout completion logging.

## Scope

Client plan consumption and logs only.

## Tasks

1. Build `/[locale]/my-plan` page.
2. Load authenticated client's active plan from Supabase.
3. Render weekly calendar view.
4. Render weekly list view.
5. Render workout detail drawer/dialog.
6. Show exercise names, sets, reps/duration, rest, instructions, and safety
   notes.
7. Add completion Server Action.
8. Add feedback form with difficulty, energy level, and notes.
9. Save `workout_logs` row.
10. Prevent duplicate completion for same client/workout/planned date.
11. Recalculate progress after completion.
12. Add empty state when no active plan exists.
13. Add TSDoc to progress and completion helpers.

## Required Tests

1. Unit tests for completion percentage calculation.
2. Unit tests for duplicate completion helper.
3. Integration test for loading active plan.
4. Integration test for saving workout log.
5. Integration test for duplicate log prevention.
6. Playwright test for viewing plan and completing workout.

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
git commit -m "Add workout plan view and logging"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
