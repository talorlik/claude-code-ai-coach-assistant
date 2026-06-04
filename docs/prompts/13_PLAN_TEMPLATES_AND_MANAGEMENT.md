# 13 - PLAN TEMPLATES AND MANAGEMENT

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

Implement trainer plan template library and manual/AI-assisted plan management.

## Scope

Trainer plan management only.

## Tasks

1. Build `/[locale]/trainer/plans` page.
2. Protect with `requireTrainerAdmin`.
3. Show plan template library.
4. Add create template form.
5. Add edit template form.
6. Add duplicate template action.
7. Add assign template to client action.
8. Add manual plan creation flow.
9. Add AI-assisted plan creation if the AI generation service is available from
   batch 08.
10. Save structured template payload in `plan_templates`.
11. When assigning template to client, create a concrete `workout_plans` row
    with workouts and exercises.
12. Localize UI and validation messages.
13. Add TSDoc to template data helpers and actions.

## Required Tests

1. Unit tests for template payload validation.
2. Integration test for creating template.
3. Integration test for editing template.
4. Integration test for duplicating template.
5. Integration test for assigning template to client.
6. Integration test for admin-only access.
7. Playwright admin plan management smoke test.

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
git commit -m "Add plan template management"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
