# 08 - AI WORKOUT PLAN GENERATION

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

Generate, validate, and persist structured AI workout plans from onboarding
data.

## Scope

AI workout generation and persistence only.

## Tasks

1. Before coding, check whether `AI_GATEWAY_API_KEY` and the required AI
   provider variables exist locally and in Vercel by variable name only.
2. If a direct Claude API key is required and missing, ask the product owner for
   it before implementation. Store it only in `.env.local` and Vercel envs. Do
   not commit it.
3. Create structured AI output schema under `lib/ai/schemas.ts`.
4. Create prompt builder under `lib/ai/prompts.ts`.
5. Include client goal, fitness level, available days, location, equipment,
   limitations/injuries, and locale in the prompt.
6. Add safety instructions: not a doctor, no diagnosis, recommend professional
   for pain/injury/medical concerns, respect limitations.
7. Implement server-side generation through Vercel AI SDK/Gateway and Anthropic
   Claude model.
8. Validate JSON output before saving.
9. Save `workout_plans`, `workouts`, and `exercises` as structured rows.
10. Preserve validated raw JSON in `workout_plans.source_payload` if useful.
11. Add clear localized loading and error states to onboarding completion.
12. Do not save partial or invalid AI plans.
13. Add TSDoc to AI utilities and persistence helpers.

## Required Tests

1. Unit tests for valid generated plan schema.
2. Unit tests for malformed generated plan rejection.
3. Unit tests for safety note enforcement when limitations exist.
4. Unit tests for prompt builder context inclusion.
5. Integration test with mocked AI response that saves plan/workouts/exercises.
6. Integration test with mocked invalid AI response that saves nothing visible.

## Verification

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Add AI workout plan generation"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
