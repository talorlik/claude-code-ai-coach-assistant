# 15 - PUSH NOTIFICATIONS

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

Implement browser workout reminders through push notifications with secure
subscription storage.

## Scope

Push opt-in, subscription management, and reminder trigger.

## Tasks

1. Add notification/reminder settings UI for clients.
2. Detect browser support for Service Worker, Notification, and PushManager.
3. Add permission request flow with localized explanation.
4. Create or update service worker registration.
5. Create protected subscription route.
6. Create protected unsubscribe route.
7. Store push subscriptions in `push_subscriptions`.
8. Add VAPID env variable checks.
9. Create protected reminder trigger route suitable for Vercel Cron or manual
   test.
10. Do not include sensitive injury/medical details in push body.
11. Add graceful unsupported-browser state.
12. Add TSDoc to push helpers.

## Required Tests

1. Unit tests for push support detection helper.
2. Unit tests for subscription payload validation.
3. Integration test for saving subscription.
4. Integration test for disabling subscription.
5. Integration test for protected reminder endpoint.
6. Playwright smoke test for unsupported or permission UI path.

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
git commit -m "Add workout reminder notifications"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
