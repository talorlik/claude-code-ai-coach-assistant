# 10 - AI VIRTUAL TRAINER CHAT

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

Build the context-aware AI virtual trainer chat and persist conversation
history.

## Scope

Client AI chat only.

## Tasks

1. Build `/[locale]/chat` page.
2. Create chat message list and input UI.
3. Load chat history for authenticated client.
4. Create server route handler for chat.
5. Before answering, load client goal, fitness level, limitations, current plan,
   recent logs, and relevant chat history.
6. Save user message before AI response.
7. Generate AI answer server-side only.
8. Save assistant response.
9. Localize loading and error states.
10. Apply safety rules for pain, injury, and medical concerns.
11. Keep AI answer in selected locale where practical.
12. Add TSDoc to chat context builder and AI route utilities.

## Required Tests

1. Unit test chat context builder.
2. Integration test for saving and loading chat messages.
3. Integration test with mocked AI answer.
4. Integration test for unauthenticated request rejection.
5. Playwright test for client asking a chat question with mocked response.

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
git commit -m "Add AI trainer chat"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
