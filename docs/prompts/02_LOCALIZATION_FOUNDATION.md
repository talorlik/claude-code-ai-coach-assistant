# 02 - LOCALIZATION FOUNDATION

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

Implement locale-prefixed routing as foundation for all future pages.

## Scope

Localization and routing only. Avoid building product features beyond
placeholders needed to verify route behavior.

## Tasks

1. Install/configure `next-intl` if not already configured.
2. Create central locale config for `en` and `he` prefixes mapped to `en-US` and
   `he-IL`.
3. Create or update `messages/en-US.json` and `messages/he-IL.json`.
4. Create root `proxy.ts` using Next.js 16-compatible `next-intl` request
   handling.
5. Do not create root `middleware.ts` unless the template explicitly requires a
   shim. Explain if a shim is required.
6. Create localized route structure under `app/[locale]` if not already present.
7. Set `lang` and `dir` attributes in localized layout.
8. Add a small localized language switcher that preserves equivalent route where
   practical.
9. Ensure unsupported locale routes redirect to default language.
10. Ensure auth pages are reachable through `/en/login`, `/he/login`,
    `/en/register`, `/he/register`.

## Required Tests

1. Unit test locale parsing, locale mapping, and direction mapping.
2. Integration or route test for unsupported locale fallback if feasible.
3. Playwright smoke test for `/en`, `/he`, `/en/login`, and `/he/login`.
4. Assert Hebrew page has RTL direction.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Add locale routing foundation"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
