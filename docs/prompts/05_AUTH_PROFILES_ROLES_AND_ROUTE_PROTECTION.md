# 05 - AUTH PROFILES ROLES AND ROUTE PROTECTION

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

Verify and complete authentication, profile creation, role handling, localized
redirects, and route protection.

## Scope

Auth/authorization only. Preserve working template behavior where possible.

## Tasks

1. Inspect existing signup, login, logout, remember me, and forgot-password
   implementation.
2. Localize auth pages and auth errors.
3. Ensure a `profiles` row is created for each registered user.
4. Add or verify profile role defaults to `client`.
5. Add server-side helpers: `requireUser`, `requireClient`,
   `requireTrainerAdmin`.
6. Protect client routes from signed-out users.
7. Protect trainer routes from non-admin users.
8. Add manual/admin setup documentation or a safe setup flow for assigning Itai
   as `trainer_admin`.
9. Ensure redirects preserve active locale.
10. Add TSDoc to auth and permission helpers.

## Required Tests

1. Unit tests for auth/role helper behavior.
2. Integration tests for signed-out redirects.
3. Integration tests for client blocked from trainer routes.
4. Integration tests for trainer admin allowed into trainer routes.
5. Auth error localization test where feasible.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Add profile roles and route protection"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
