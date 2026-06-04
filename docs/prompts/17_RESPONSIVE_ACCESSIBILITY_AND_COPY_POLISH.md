# 17 - RESPONSIVE ACCESSIBILITY AND COPY POLISH

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

Polish the full product for responsive layouts, accessibility, RTL, theme
contrast, and localized copy quality.

## Scope

Polish only. Avoid new major features.

## Tasks

1. Review homepage, auth, onboarding, my-plan, chat, trainer list, trainer
   dashboard, plan management, push settings, and PDF export surfaces.
2. Test 390 px mobile width.
3. Test 768 px tablet width.
4. Test 1280 px desktop width.
5. Fix broken layouts.
6. Verify all interactive controls are keyboard reachable.
7. Verify forms have labels and useful errors.
8. Verify focus states are visible.
9. Verify dark/light contrast for cards, forms, charts, chat bubbles, dialogs,
   drawers, and toasts.
10. Verify Hebrew RTL layout across all pages.
11. Add missing empty, loading, and error states.
12. Review English and Hebrew translation coverage.
13. Review SEO metadata on public pages.

## Required Tests

1. Playwright viewport tests for critical pages.
2. Playwright theme tests for representative pages.
3. Playwright RTL tests for Hebrew pages.
4. Component tests for key empty/error states if feasible.

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
git commit -m "Polish responsive and accessible UX"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
