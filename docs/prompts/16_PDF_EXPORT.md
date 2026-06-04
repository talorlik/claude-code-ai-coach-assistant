# 16 - PDF EXPORT

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

Implement workout plan export as a localized PDF.

## Scope

PDF export only.

## Tasks

1. Install PDF dependency or React PDF skill integration if needed by the
   selected implementation.
2. Create protected PDF export route under `/api/pdf/workout-plan` or localized
   equivalent.
3. Authorize that client can export only own plan; trainer admin can export
   client plan if implemented.
4. Create PDF document component/template.
5. Include client name, plan title, date, weekly schedule, workouts, exercises,
   instructions, rest times, and safety notes.
6. Support English and Hebrew labels.
7. Add export button on My Plan page.
8. Add localized loading/error behavior.
9. Return correct PDF content type.
10. Add TSDoc to PDF helpers.

## Required Tests

1. Integration test for unauthorized export rejection.
2. Integration test for client exporting own plan.
3. Integration test for content type.
4. Playwright smoke test that export action is visible and callable.
5. Manual Hebrew PDF check if automated RTL PDF validation is not practical.

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
git commit -m "Add workout plan PDF export"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
