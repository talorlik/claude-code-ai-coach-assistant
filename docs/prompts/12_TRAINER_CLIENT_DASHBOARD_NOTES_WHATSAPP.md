# 12 - TRAINER CLIENT DASHBOARD NOTES WHATSAPP

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

Build the trainer client dashboard with progress, logs, chat review, private
notes, and WhatsApp contact.

## Scope

Detailed admin dashboard for one client.

## Tasks

1. Build `/[locale]/trainer/clients/[clientId]` page.
2. Protect with `requireTrainerAdmin`.
3. Show client profile summary.
4. Show current workout plan.
5. Show completion percentage.
6. Render weekly progress chart with Recharts.
7. Render monthly progress chart with Recharts.
8. Render workout log and workout notes.
9. Render AI chat questions and answers.
10. Implement private trainer notes CRUD.
11. Implement WhatsApp link using normalized phone number.
12. Hide WhatsApp button if no valid phone exists.
13. Ensure charts work in light/dark themes and Hebrew RTL layout.
14. Add TSDoc to aggregation helpers, phone normalizer, and notes actions.

## Required Tests

1. Unit tests for phone normalization.
2. Unit tests for weekly/monthly aggregation helpers.
3. Unit tests for trainer note validation.
4. Integration tests for trainer note CRUD.
5. Integration test that client cannot read trainer notes.
6. Playwright test for opening dashboard and adding note.

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
git commit -m "Add trainer client dashboard"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
