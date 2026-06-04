# 07 - CLIENT ONBOARDING FLOW

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

Build the multi-step localized onboarding flow and persist client details.

## Scope

Client onboarding only. AI generation can be stubbed or call a placeholder until
batch 08 if needed.

## Tasks

1. Build `/[locale]/join` page.
2. Create multi-step onboarding form.
3. Collect full name, age/age range, goal, fitness level, limitations/injuries,
   available workout days, preferred location, equipment, notes/preferences, and
   optional phone.
4. Create validation helpers under `lib/validation/onboarding.ts`.
5. Localize labels, helper text, success states, and errors.
6. Create Server Action for onboarding save.
7. Upsert `clients` row for the authenticated user.
8. Redirect signed-out users to localized login.
9. Show clear `Create my workout plan` button at the end.
10. After submit, call a temporary generation placeholder or invoke batch 08
    function only if already implemented.
11. Add TSDoc to validation and Server Action helpers.

## Required Tests

1. Unit tests for onboarding validation.
2. Integration test for saving onboarding data.
3. Integration test for updating existing onboarding data.
4. Integration test for rejecting invalid payload.
5. Playwright flow for English onboarding.
6. Playwright flow for Hebrew onboarding if test data supports it.

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
git commit -m "Add smart onboarding flow"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
