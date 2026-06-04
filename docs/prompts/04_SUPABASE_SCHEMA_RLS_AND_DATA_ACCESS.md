# 04 - SUPABASE SCHEMA RLS AND DATA ACCESS

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

Implement the database schema, RLS policies, indexes, triggers, and server-only
data access layer.

## Scope

Database foundation only. Do not build full feature UI yet.

## Tasks

1. Inspect existing Supabase migration conventions.
2. Create migrations for `profiles`, `clients`, `workout_plans`, `workouts`,
   `exercises`, `workout_logs`, `chat_messages`, `plan_templates`,
   `trainer_notes`, `push_subscriptions`, and `plan_generation_events`.
3. Add `created_at`, `updated_at`, and relevant lifecycle timestamps.
4. Add `updated_at` trigger function.
5. Add foreign keys and indexes.
6. Enable RLS on all app tables.
7. Add RLS helper for trainer admin check.
8. Add RLS policies for client ownership and trainer admin access.
9. Add server-only DB access modules under `lib/db`.
10. Add TSDoc to exported data functions.
11. Do not use Supabase service/secret key in browser code.

## Required Tests

1. Unit tests for permission helpers and data mappers.
2. Integration tests for client-owned access where feasible.
3. Integration tests for trainer-admin access where feasible.
4. Schema validation or migration smoke check.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Add Supabase schema and RLS policies"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
