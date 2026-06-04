# 00 - VERIFY TEMPLATE AND ENVIRONMENT

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

Confirm that the installed template, environment variables, auth baseline,
GitHub/Vercel setup, Supabase setup, and local scripts are ready before product
implementation starts.

## Scope

Verification only. Do not implement product features unless required to repair a
blocking setup issue.

## Tasks

1. Inspect `package.json`, lockfile, app directory, `components`, `lib`,
   `supabase`, `.env.example`, and existing auth files.
2. Verify actual installed package versions against the required stack.
3. Check whether `next-intl` is already installed and whether locale files
   exist.
4. Check whether root `proxy.ts` exists. Check whether root `middleware.ts`
   exists and whether it conflicts with the assignment.
5. Verify `.env.local` exists locally and is ignored by Git. Do not print secret
   values.
6. Verify Supabase public URL, publishable key, server secret key, AI gateway
   key, app URL, Turnstile keys, and Vercel env presence by checking variable
   names only.
7. Run local scripts and identify failures.
8. Smoke-test existing signup, login, logout, remember me, and forgot-password
   paths.
9. Document findings in the Claude Code response. Do not commit secrets.

## Required Tests

1. No new tests are required unless a broken setup helper is fixed.
2. Run existing tests if a test script already exists.
3. Verify no secret values are printed or committed.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Verify template baseline and environment"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
