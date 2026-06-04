# Studio Itai AI Coach Assistant

A localized (English/Hebrew, RTL-aware) AI fitness coaching platform built on the
AI Game Changer template. Clients onboard, receive an AI-generated workout plan,
log workouts, and chat with an AI virtual trainer; a trainer admin manages
clients, plans, templates, and notes.

## Tech Stack

- Next.js 16.1.7 (App Router) on React 19.2.4, TypeScript 5.9.3.
- Supabase: Auth, Postgres, Row-Level Security (`@supabase/supabase-js`,
  `@supabase/ssr`).
- AI: Vercel AI SDK v6 (`ai`, `@ai-sdk/gateway`, `@ai-sdk/react`) through the
  Vercel AI Gateway, Anthropic Claude models. Server-side only.
- UI: shadcn/ui + Base UI primitives in `components/ui/`, Tailwind CSS 4
  (PostCSS mode, no `tailwind.config.ts`), `next-themes` for dark mode,
  Sonner toasts, Recharts, date-fns, Turnstile captcha.
- Localization (added during the build): `next-intl` `^4.13.0`, `/en` -> en-US,
  `/he` -> he-IL, Hebrew RTL.
- Testing: Vitest (unit + integration, jsdom), Playwright (e2e).

## Commands

```bash
npm run dev         # next dev --turbopack
npm run build       # next build
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run format      # prettier --write "**/*.{ts,tsx}"
npm run test        # vitest run (unit + integration)
npm run test:e2e    # playwright test
```

Standard verification gate after a change: `npm run lint && npm run typecheck &&
npm run build`. Add `npm run test` / `npm run test:e2e` for behavior changes.

## Layout

- `app/` - App Router routes. Existing: `login`, `forgot-password`,
  `reset-password`, `profile`, `admin`, `chat`, `auth/` (confirm, signout),
  `api/chat/route.ts`. The build moves these under `app/[locale]/`.
- `lib/` - server and shared logic:
  - `lib/supabase/` - `client.ts` (browser), `server.ts` (RLS server client +
    secret-key admin client), `middleware.ts` (`updateSession`),
    `cookie-persistence.ts`.
  - `lib/auth/` - `roles.ts`, `require-admin.ts`, `resolve-auth-message.ts`,
    `validation.ts`.
  - `lib/profile/`, `lib/types/action-result.ts`, `lib/utils.ts`.
- `components/` - `theme-provider.tsx`, `mode-toggle.tsx`, `site-header.tsx`,
  `captcha-field.tsx`, and `components/ui/*` (shadcn/Base primitives).
- `proxy.ts` - Next.js 16 root proxy; runs Supabase `updateSession`.
- `supabase/migrations/` - SQL migrations (`0001_auth_schema.sql` = user_roles,
  profiles, RLS, `is_admin()`).
- `__tests__/unit/`, `__tests__/integration/` - Vitest. `playwright.config.ts`
  for e2e.
- `docs/planning/` (PRD, TECHNICAL_REQUIREMENTS, TASK_BREAKDOWN),
  `docs/prompts/` (00-19 + PROMPT_INDEX).

## Building this project: the batch system

The build runs as 20 sequential batches (00-19), one prompt file each under
`docs/prompts/`, sequenced by `docs/planning/TASK_BREAKDOWN.md`.

**To run a batch, use the `/run-batch` command.** When the user says "run batch
N", "do batch N", "execute batch N", or anything equivalent - including plain
English with no slash - invoke `/run-batch <N>`. That command is the canonical,
self-contained, hands-off entry point: it creates the per-batch worktree off
clean `main`, runs the prompt verbatim, runs the gates, self-corrects (3-retry
cap per gate, then commits WIP and stops without touching `main`), and
squash-merges into local `main`. Do NOT execute a batch by hand or improvise the
git workflow - route through `/run-batch`.

Authoritative runbook:
`/Users/talo/.claude/plans/review-the-project-s-sleepy-castle.md`. Current batch
= count of squash commits on `main` (one per completed batch).

Ad-hoc decisions and insights are recorded in `docs/DECISIONS.md` (repo-durable,
dated, append-only) and, when they affect a future batch, in auto-memory.
`/run-batch` captures these before the session ends, since the user `/clear`s
between batches. When you make a non-obvious decision outside a batch run, append
it to `docs/DECISIONS.md` too.

## Non-negotiable constraints (every batch)

- Root `proxy.ts` for request handling; NEVER create root `middleware.ts`.
  `proxy.ts` already runs Supabase `updateSession` - batch 02 composes next-intl
  routing INTO it, does not replace it. Highest-risk integration point.
- next-intl: `/en` -> en-US, `/he` -> he-IL, Hebrew RTL. Messages in
  `messages/en-US.json` and `messages/he-IL.json`.
- Supabase RLS on every app table. Trainer admin is role-gated; clients own
  their rows. Admin user: `talorlik@gmail.com`.
- AI server-side only via Vercel AI Gateway; keys never reach the browser;
  never save invalid or partial AI output.
- TSDoc on exported helpers, server actions, route helpers, AI utilities, and
  non-trivial components. Tests for every changed behavior; mock AI in tests.
- Reuse existing utilities (`lib/auth/*`, `lib/supabase/server.ts`,
  `lib/utils.ts`, `lib/types/action-result.ts`, `components/ui/*`) rather than
  reinventing.
- Markdown filenames UPPERCASE_WITH_UNDERSCORES.md.

## Git

Per-batch worktree off clean `main` -> gates pass -> squash-merge into local
`main` -> remove worktree. One squash commit per batch with the exact commit
message from the task breakdown table. NEVER push `main`; feature branches may be
pushed. See the global `~/.claude/CLAUDE.md` for the full worktree model and code
defaults.

## Working preferences

Quality > robustness > token efficiency. Verify before declaring done; fail
loudly, not silently. Cheap-but-wrong is the worst outcome.
