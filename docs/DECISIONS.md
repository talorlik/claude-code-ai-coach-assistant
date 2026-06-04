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

### 2026-06-04 - Batch 01 - Planning Docs Pre-Existed; Batch Was A Verification Pass

The batch 01 deliverables (`docs/planning/PRD.md`,
`docs/planning/TECHNICAL_REQUIREMENTS.md`, `docs/planning/TASK_BREAKDOWN.md`, all
20 `docs/prompts/NN_*.md`, and `docs/prompts/PROMPT_INDEX.md`) already existed on
`main`, committed ad-hoc as `77453f3 "Added planning and prompt documents."`
before the formal batch system was introduced. Batch 01 therefore created no new
planning docs; it ran the prompt's verification tasks (hierarchy present, naming,
no secrets) and produced the prescribed `Add planning documentation` squash
commit carrying this log entry.

Verification results: all three planning docs and 21 prompt files present and
correctly placed. Naming conforms to UPPERCASE_WITH_UNDERSCORES.md for every doc
under `docs/planning` and `docs/prompts`. The only non-conforming `.md` files are
`docs/superpowers/plans/2026-06-01-auth-port.md` and
`docs/superpowers/specs/2026-06-01-AUTH_PORT_DESIGN.md`, which are
superpowers-skill artifacts using that tool's date-prefixed convention and are
out of scope for this batch. Secret scan over planning + prompt docs found only
empty env-var-name placeholders (`SUPABASE_SECRET_KEY=`, `AI_GATEWAY_API_KEY=`)
in the `TECHNICAL_REQUIREMENTS.md` env template - documentation, not leaked
values.

**Why:** recorded so a future audit does not mistake the missing
`Add planning documentation` content-commit for skipped work - the content landed
earlier under a different message, and batch 01's squash commit is the
verification-and-log entry, not a re-creation of files that already exist.

### 2026-06-04 - Out-Of-Batch - Mechanical Guards Enforce The proxy.ts Rule

The "never create a root `middleware.ts`" rule is now enforced by tooling, not
just by instruction (commit `0d933f6`, on `main` outside the batch sequence):

1. PreToolUse hook `scripts/hook-block-middleware.mjs` (registered in
   `.claude/settings.json`, matcher `Write|Edit|MultiEdit|NotebookEdit`) blocks
   creating a root or `src/` `middleware.ts` with exit code 2. It arms at
   session start, so it is active from the next `/clear` onward - i.e. for every
   batch from 02 up. Fails open on malformed stdin.
2. Guard script `scripts/guard-no-middleware.mjs` runs as `prebuild`,
   `pretypecheck`, and `predev`, failing the gate if a root `middleware.ts`
   exists from any source the hook cannot see (a dependency codemod, a
   next-intl/Supabase `init`, a merge). Because Vercel runs `next build`, the
   `prebuild` guard also fires on deploys. Manual check: `npm run guard:proxy`.

Implications for future batches: do NOT hand-create `middleware.ts` even if
next-intl or Supabase docs say to - translate that snippet into `proxy.ts` with
a `proxy` export. If a gate suddenly fails with "BLOCKED: forbidden middleware
file(s)", a tool scaffolded one; delete it and compose its logic into
`proxy.ts`. The guard scripts and the hook are not test fixtures - leave them in
place.

**Why:** the proxy-vs-middleware trap is the build's highest-risk integration
point (batch 02), and the whole ecosystem's docs still say `middleware.ts`.
Relying on the model re-reading a CLAUDE.md line each batch is probabilistic;
a hook plus a gate guard make it deterministic and survive `/clear`.

### 2026-06-04 - Batch 02 - Locale Foundation: Compose Order, Strict Locale Type, Locale-Aware Redirects

next-intl 4.13.0 added with `/en`->en-US, `/he`->he-IL, `localePrefix: "always"`.
Config lives in `i18n/routing.ts` (locales, tag map, RTL set, helpers),
`i18n/request.ts` (per-request config, loads `messages/<tag>.json`),
`i18n/navigation.ts` (locale-aware `Link`/`redirect`/`usePathname`). The flat
routes moved under `app/[locale]`; `app/api` and `app/auth/*` stay at root
(not localized). The root `app/layout.tsx` is now a bare pass-through returning
`children`; `app/[locale]/layout.tsx` owns `<html lang dir>` + providers and
calls `notFound()` on an unsupported locale. A root `app/not-found.tsx` renders
its own `<html>` since the root layout no longer does.

Key decisions:

1. **proxy.ts compose order.** Run next-intl middleware FIRST; if it returns a
   3xx (e.g. `/` -> `/en`), return that immediately (no session refresh on a
   throwaway request). Otherwise pass its 200 response as the base into
   `updateSession(request, response)`, which now writes Supabase auth cookies
   onto that SAME response so locale rewrite headers and refreshed cookies
   travel together. `updateSession`'s second arg is optional, so its old
   single-arg contract still holds. `/api` and `/auth` bypass locale routing
   but still get a session refresh.
2. **Strict locale typing via `global.ts`.** Without augmenting next-intl's
   `AppConfig.Locale`, `getLocale()` returns the broad `string`-based `Locale`,
   which is NOT assignable to the navigation helpers' `locale: "en"|"he"` param,
   so `redirect({locale})` calls fail to type-check. `global.ts` sets
   `Locale = (typeof routing.locales)[number]` and `Messages = typeof en-US`.
3. **`return redirect(...)` everywhere.** next-intl's `redirect` is typed
   `=> never`, but TS control-flow did NOT narrow `creds`/`user`/`userId` after
   a bare `redirect(...)` call in this codebase (unlike `next/navigation`'s).
   Prefixing every call with `return` makes control flow terminate explicitly
   and narrows cleanly. Applied in login/forgot/reset actions, profile + reset
   pages, and `require-admin.ts`.
4. **Server-action redirects need an explicit locale.** next-intl's `redirect`
   always requires `{href, locale}`. Actions read it via `getLocale()`; pages
   read it from `params`. This preserves the user's language on the bounce
   (a `/he` visitor lands on `/he/login`, not the default).
5. **`/register` is a thin alias** redirecting to `/login?tab=signup` (the
   template merges sign-in/up under `/login`), added only to satisfy the
   reachability requirement for `/en/register` and `/he/register`.
6. **Unsupported locale = 404, not silent rewrite.** With `localePrefix:
   "always"`, `/fr` hits the `[locale]` layout's `notFound()`. The prompt's
   "redirect unsupported locales to default" is honored at the entry point: the
   bare root `/` redirects to `/en`. A hard 404 for an unknown prefix is
   next-intl's documented behavior and safer than guessing intent.
7. **Auth copy stays English for now.** Only homepage, nav, and the language
   switcher are translated this batch (scope = "localization foundation").
   Login/forgot/reset body copy is localized in a later batch.

Test/behavior changes: `__tests__/integration/login-actions.test.ts` updated to
import from `@/app/[locale]/login/actions`, mock `@/i18n/navigation`'s `redirect`
(object `{href}` form) and `next-intl/server`'s `getLocale`. New
`__tests__/unit/i18n-routing.test.ts` (parsing/mapping/direction/fallback),
`__tests__/integration/i18n-request-config.test.ts` (resolution + catalog load;
invoking `getRequestConfig` directly is not possible under jsdom, so the
resolution rule and catalog wiring are tested directly), and
`e2e/localization.spec.ts` (`/en`,`/he`,`/en/login`,`/he/login` load; `/he` is
RTL; `/fr` 404; switcher preserves route). `lib/profile/profile-actions.ts`
revalidates `"/[locale]/profile"` (was `"/profile"`).

**Why:** the compose order and the single-shared-response merge are what keep
both concerns working at once - the most likely place a naive integration would
silently drop auth cookies or locale headers. The strict-locale-type and
`return redirect` points are the two non-obvious traps that block the typecheck
gate; recorded so a future batch adding locale-aware redirects does not
rediscover them. The build gate passed WITHOUT copying `.env.local` into the
worktree (unlike the batch-00 warning) because these routes are dynamic and the
Supabase env is only dereferenced at runtime; the env copy was needed only to
run the e2e smoke locally (copied, used, removed - it is gitignored).
