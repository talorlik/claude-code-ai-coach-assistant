# 03 - THEME AND UI SHELL

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

Add global application shell and persistent light/dark theme support.

## Scope

Theme provider, shell components, navigation surface, and UI primitives. Do not
build feature pages yet.

## Tasks

1. Verify `next-themes` is installed and configured.
2. Add `ThemeProvider` to the localized root layout.
3. Create a localized `ThemeToggle` component.
4. Persist theme preference across refreshes.
5. Create shared app shell with navigation, language switcher, theme toggle, and
   responsive header.
6. Use shadcn/ui base-nova and Base UI conventions already present in the
   template.
7. Add Sonner toaster if not already globally configured.
8. Ensure shell works for LTR and RTL.
9. Ensure all new strings are translated.

## Required Tests

1. Unit test theme preference helper if one is created.
2. Component test for theme toggle if feasible.
3. Playwright test: switch theme, refresh, verify selected theme persists.
4. Visual smoke check for English and Hebrew shell.

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
git commit -m "Add theme and application shell"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
