# 01 - CREATE PLANNING DOCS AND CONVENTIONS

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

Add the planning and prompt documentation package to the repository in the
required hierarchy.

## Scope

Documentation only.

## Tasks

1. Create `docs/planning` if missing.
2. Create `docs/prompts` if missing.
3. Add `docs/planning/PRD.md`.
4. Add `docs/planning/TECHNICAL_REQUIREMENTS.md`.
5. Add `docs/planning/TASK_BREAKDOWN.md`.
6. Add all prompt files under `docs/prompts`.
7. Verify every Markdown filename is uppercase with underscores where words are
   separated and extension `.md`.
8. Verify no secrets or local-only values are included in docs.

## Required Tests

1. Manual file hierarchy check.
2. Run a grep or equivalent check to ensure no API keys, tokens, or secret
   values were accidentally added.

## Verification

1. `npm run lint`
2. `npm run typecheck`

## Commit

When the batch is complete and verified, create a commit:

```bash
git add .
git commit -m "Add planning documentation"
```

## Output Required From Claude Code

Return:

1. Files changed.
2. Key implementation decisions.
3. Tests added or updated.
4. Commands run and their results.
5. Any remaining risk or follow-up.
