# Decision Log

An append-only, dated record of ad-hoc decisions and insights made while
building this project. Each batch (`/run-batch`) appends here before the session
is cleared, so nothing learned mid-build is lost. This is the repo-durable
record; personal cross-batch gotchas also go to auto-memory.

## Format

Newest entries at the bottom. One entry per decision or insight:

```markdown
### YYYY-MM-DD - Batch NN - Short Title

Decision or insight, stated plainly.

**Why:** the reasoning that is not obvious from the code or commit.
```

Keep entries short. Record the why, not the what (the commit already has the
what). Do not invent entries; if a batch produced nothing non-obvious, it
records nothing here.

## Entries

### 2026-06-04 - Setup - Batch System And Remote Execution

The 20-batch build runs through the `/run-batch <NN>` command, one batch per
session, driven from the Claude mobile app via Remote Control, with `/clear`
between batches.

**Why:** per-batch session isolation keeps token/context clean. Remote Control
attaches to a live local session on the Mac (it cannot spawn one remotely), so
the loop is: `/rc` + scan once, then `run batch N` -> wait -> `/clear` -> next.
`/clear` wipes the conversation but reloads `CLAUDE.md`, `MEMORY.md`, and the
command registry, so each cleared batch starts with full project context.

### 2026-06-04 - Setup - Capture Discipline Before Clear

Decisions and insights are captured to `docs/DECISIONS.md` (repo-durable) and,
when they affect a future batch, to auto-memory - as a mandatory step inside
`/run-batch` before it reports done.

**Why:** `/clear` between batches discards the conversation. Without a structural
capture step the model would rely on remembering to save insights after the fact,
when they are already gone. Making capture part of the batch contract closes the
gap. Obsidian was considered and rejected: build decisions belong with the code
and in session-loaded memory, not in a disconnected personal vault the next batch
session cannot read.

### 2026-06-04 - Setup - proxy.ts Compose, Do Not Replace

The root `proxy.ts` already runs Supabase `updateSession`. Batch 02 must compose
next-intl locale routing INTO it, not replace it, and must never add a root
`middleware.ts`.

**Why:** highest-risk integration point in the build. Replacing the proxy would
break Supabase session cookie refresh; a separate `middleware.ts` conflicts with
the Next.js 16 proxy convention the template uses.

### 2026-06-04 - Batch 00 - Baseline Verified; Env Lives Only In Primary Checkout

Baseline audit passed: stack versions match (Next 16.1.7, React 19.2.4, TS
5.9.3, ai ^6, @ai-sdk/gateway, Supabase ssr/js); `proxy.ts` runs `updateSession`
and no root `middleware.ts` exists; lint/typecheck/build green; 38 tests (7
files) pass. Supabase has `user_roles` + `profiles` with RLS on, migration
`0001_auth_schema` (20260601172533) applied. GitHub remote
`talorlik/claude-code-ai-coach-assistant` (public) and Vercel project
`claude-code-ai-coach-assistant` both linked. next-intl, `messages/`, and
`app/[locale]` are absent as expected (batch 02 builds them).

Three findings the build must carry:

1. `.env.local` exists ONLY in the primary checkout, not in per-batch worktrees,
   and is gitignored. Every batch whose gate runs `npm run build` must copy it
   into the worktree first, or the build fails on missing Supabase/AI env.
2. Required env names all present (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
   `NEXT_PUBLIC_APP_URL`, `AI_GATEWAY_API_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
   plus `EMAIL_ENABLED` and `UPSTASH_REDIS_REST_*`. VAPID push keys are NOT set;
   batch 15 must add them. No `.env.example` file exists.
3. Supabase security advisor flags one WARN: leaked-password protection
   disabled (HaveIBeenPwned check). Auth-config toggle, not a code fix;
   non-blocking. Live browser smoke of login/signup/logout was deferred -
   covered transitively by passing build + 38 auth tests, not by a manual
   session.

**Why:** the env-in-primary-checkout fact is the most likely future-batch trap:
a worktree build silently fails without it, and it is invisible in `git status`
because it is ignored. Recorded so every later batch copies env before building.
