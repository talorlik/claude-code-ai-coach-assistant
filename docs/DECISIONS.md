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

### 2026-06-04 - Batch 03 - Shell Pre-Existed; Batch Closed Two Gaps (Unmounted Toaster, Untranslated Toggle)

The theme/shell foundation was already built by the template + batch 02:
`next-themes` configured in `components/theme-provider.tsx` (`attribute="class"`,
`defaultTheme="system"`, `enableSystem`, plus a `d`-key hotkey), `SiteHeader`
with nav + `LanguageSwitcher` + `ModeToggle` + responsive sticky header, and the
full `components/ui/*` shadcn/Base UI set (including `sonner.tsx`), all wired into
`app/[locale]/layout.tsx`. Batch 03 therefore did not rebuild any of it
(constraint 15) and closed only the two real gaps:

1. **Sonner Toaster was never mounted.** `components/ui/sonner.tsx` existed but
   `<Toaster />` was rendered nowhere. Mounted it inside `ThemeProvider` in the
   localized layout (after `{children}`), because the Toaster calls
   `useTheme()` and must sit under the next-themes provider to pick up
   light/dark.
2. **`ModeToggle` shipped hardcoded English strings** ("Light", "Dark",
   "System", "Toggle theme"), violating the translate-all-copy constraint.
   Localized them via a new `ThemeToggle` message namespace
   (`label`/`light`/`dark`/`system`) in both catalogs, switching the component to
   `useTranslations("ThemeToggle")`. Also normalized its semicolon style to the
   repo's no-semi convention. Did NOT create a separate `ThemeToggle` component
   (prompt Task 3 wording): the existing `ModeToggle` already IS that control;
   adding a duplicate would be dead code.

Tests: `__tests__/unit/mode-toggle.test.tsx` (renders inside a real
`NextIntlClientProvider`, mocks `next-themes` `useTheme` to capture `setTheme`;
asserts localized trigger label, the three localized modes, each mode fires
`setTheme`, and the Hebrew catalog resolves). `e2e/theme.spec.ts`
(switch->reload persistence via the `html.dark` class round trip, and the
localized toggle in the `/he` RTL shell).

Two non-obvious test traps recorded for future component/e2e batches that use
Base UI menus/dialogs:

1. **`NextIntlClientProvider` `locale` prop is strictly typed to the URL prefix**
   (`"en" | "he"`, via the batch-02 `global.ts` augmentation), NOT the full tag.
   Passing `"en-US"` fails typecheck. Pass the prefix; the catalog object is what
   drives translation in tests.
2. **Base UI keeps a transient `pointer-events: none` overlay during the
   menu open/close transition, and jsdom never clears it** (no real animation
   frames). userEvent's pointer-events guard then throws on the next click. Fix:
   `userEvent.setup({ pointerEventsCheck: 0 })` for tests that reopen a Base UI
   menu. The Playwright e2e (real browser) does not need this.

**Why:** the unmounted-Toaster and untranslated-toggle gaps are the kind a
"shell already exists" batch silently passes over; recorded so the global
toaster mount and the i18n of every control are treated as done. The two test
traps (strict `locale` prop, Base UI pointer-events guard) will recur in every
later batch that component-tests a Base UI menu/dialog or e2e-drives one, so they
go to auto-memory too.

### 2026-06-04 - Batch 04 - Policy-Callable `is_trainer_admin()` Vs `is_admin(uuid)`

Batch 04 added `public.is_trainer_admin()` (no-arg, security definer, granted to
`authenticated`) for the new feature-table RLS policies, instead of reusing
`is_admin(uuid)` from 0001. `is_admin(uuid)` had EXECUTE revoked from
`authenticated` to keep it off the PostgREST RPC surface, so it cannot be called
from a policy expression that evaluates as the `authenticated` role.

**Why:** RLS policy expressions run as the querying role, so any function a
policy calls must be EXECUTE-able by that role. The no-arg `is_trainer_admin()`
hard-codes `auth.uid()` (no argument an attacker can vary over REST) and only
reveals the caller's own admin status, so exposing it on the RPC surface is
benign. The Supabase security advisor still WARNs
(`authenticated_security_definer_function_executable`); this warning is accepted
and expected for this pattern, not a defect. Trainer-only tables
(`plan_templates`, `trainer_notes`) use `is_trainer_admin()` as the sole
predicate; client-owned tables OR it with `auth.uid() = <owner>`. Nested
ownership (`workouts`, `exercises`) resolves through the parent plan via EXISTS.

### 2026-06-04 - Batch 04 - No `server-only` Import In `lib/db`

The `lib/db/*` data modules do not import `server-only`. The package does not
resolve under Vitest/Node (it is a Next bundler shim), and importing it would
break the integration tests that import these modules directly.

**Why:** server-scoping is already guaranteed transitively - the modules import
`lib/supabase/server.ts`, which imports `next/headers`. This matches the
existing convention in `lib/auth/roles.ts` and `lib/profile/*`, which also omit
`server-only`. The migration-smoke test resolves the SQL file via
`process.cwd()` (vitest cwd = project root), not `import.meta.url`, which is not
a `file:` URL under vitest.

### 2026-06-04 - Batch 05 - `client`/`trainer_admin` Map Onto The `admin|customer` Enum

The product roles "client" and "trainer admin" are not new enum values. The
`public.app_role` enum is `admin | customer` (set in batch 01/04). `requireClient`
requires only an authenticated session (every signed-in user is a client, and an
admin may also view client surfaces); `requireTrainerAdmin` requires the `admin`
role, matching the `is_trainer_admin()` SQL predicate. `requireClient` is a named
alias of `requireUser`, kept distinct so future role gating can tighten in one
place. The canonical guard is `requireTrainerAdmin` in `lib/auth/require-user.ts`;
`requireAdmin` is retained as a thin back-compat alias.

**Why:** future feature batches (07-16) gating client vs trainer surfaces must
call these helpers and must not assume a literal `client` role exists in the DB.
A signed-out visitor is redirected to `/login?notice=signInToContinue`; a
signed-in non-admin hitting a trainer route goes to `/` - both locale-preserving.

### 2026-06-04 - Batch 05 - `resolveAuthMessage` Now Takes A Translator

`resolveAuthMessage` changed from `(code) => string | null` (fixed English) to
`(translate, code) => string | null`, where `translate` is a next-intl
translator bound to the `AuthMessages` namespace. The stable-code allowlist
(`AUTH_MESSAGE_CODES`) and the anti-injection guarantee are preserved: an
unknown/forged code returns `null` without ever calling the translator. Auth
copy now lives in `messages/{en-US,he-IL}.json` under `AuthMessages`.

**Why:** auth errors must be localized like the rest of the app. Any future auth
server action that redirects with a `?error=`/`?notice=` code must use a code
present in `AUTH_MESSAGE_CODES` AND add the matching key to both message files,
or the message will silently not render.

### 2026-06-04 - Batch 06 - Localized Metadata Helper And `Metadata` Namespace

SEO metadata is built by `buildLocaleMetadata(locale, key, path)` in
`lib/seo/metadata.ts`. It reads a `Metadata.<key>` namespace from the message
catalogs (added a `Metadata.home` entry to both files) and returns a Next.js
`Metadata` with title, description, Open Graph (type/siteName/title/description/
url, plus the `en_US`/`he_IL` OG locale form), and `alternates` (canonical +
hreflang `languages` map keyed by BCP 47 tag). `metadataBase` comes from
`NEXT_PUBLIC_APP_URL` with a `http://localhost:3000` fallback so `next build`
never throws when the env is unset. The `key` arg is typed as
`keyof Messages["Metadata"]`, required because next-intl is strictly typed via
`global.ts` - a plain `string` namespace fails typecheck.

**Why:** every future page batch (07-16) that needs SEO should call
`buildLocaleMetadata` from a `generateMetadata` export and add a `Metadata.<page>`
key to both `messages/{en-US,he-IL}.json`, rather than hand-rolling metadata.

### 2026-06-04 - Batch 06 - Homepage Is Now A Dynamic Server Component

`app/[locale]/page.tsx` was converted from a sync component using
`use(params)` + `useTranslations` to an `async` server component using
`await params` + `getTranslations`, so it can also export `generateMetadata`.
Consequence: `/[locale]` is now server-rendered on demand (`ƒ`) in the build
output rather than prerendered static (`○`). The new-client CTA links to
`/register`, which is the existing thin redirect to `/login?tab=signup` (added in
batch 02), preserving locale - there is no standalone register page yet.

**Why:** `generateMetadata` is an async server-only export; mixing it with the
client `useTranslations` hook on the same page is awkward, and going fully
server keeps both the page body and its metadata reading from one
`getTranslations` source of truth.

### 2026-06-04 - Batch 07 - Onboarding Field Vocabulary Is Closed Enums With Message-Key Values

`lib/validation/onboarding.ts` defines goal, fitness level, age range, location,
day, and equipment as closed const tuples whose member strings are stable,
locale-independent keys (e.g. `build_muscle`, `30_39`). The validator checks
membership against these tuples; the UI and the catalog key their labels off the
same strings (`Onboarding.options.<group>.<value>`). The raw key strings are
persisted verbatim into `clients`.

**Why:** keeps the validator, the form, and the translations from drifting (one
source of vocabulary), gives the batch-08 AI generation structured enum inputs
to branch on instead of free text, and keeps stored values language-neutral so a
client who switches locale still has valid data.

### 2026-06-04 - Batch 07 - Onboarding Lives At /join, Reached After Auth; Homepage CTA Unchanged

The onboarding flow is at `/[locale]/join`, guarded by `requireClient()`
(redirects signed-out users to localized login). The homepage primary CTA still
points at `/register` (-> `/login?tab=signup`), NOT `/join`, so the batch-06
homepage e2e contract (CTA href ends `/register`) is preserved. New users
register and sign in first, then onboard.

**Why:** onboarding writes the authenticated user's own `clients` row under RLS,
so a session must already exist; pointing the public CTA straight at `/join`
would just bounce guests to login. Follow-up for a later batch: after sign-in,
route a client with no `onboarded_at` to `/join` (post-auth redirect), and
optionally add an authenticated "complete onboarding" entry point.

### 2026-06-04 - Batch 07 - Onboarding Form Holds State In React, Not FormData

`app/[locale]/join/onboarding-form.tsx` is a controlled client component that
collects answers in React state and calls the `saveOnboarding` server action
with a plain object, rather than using a `<form action>` + `FormData`.

**Why:** the multi-select controls use the Base UI `Checkbox` primitive, which
is not a native input and so does not serialize into `FormData`. Controlled
state also drives the multi-step wizard (step gating, returning to the first
errored step). The server action remains the single validation source of truth;
client-side step checks are UX-only. Runtime-composed translation keys
(`errors.<field>.<code>`, `steps.<n>.title`) are cast to the translator's key
type via a local `MessageKey` alias because next-intl types keys statically.

### 2026-06-05 - Batch 08 - AI Generation Uses generateObject + Zod Through The Gateway

Plan generation calls the AI SDK `generateObject` with a zod
(`workoutPlanSchema`) schema, routed through the Vercel AI Gateway by passing
the `provider/model` string `anthropic/claude-sonnet-4-6` (same convention as
`app/api/chat/route.ts`). The model call is wrapped behind an injectable
`ObjectGenerator` seam in `lib/ai/generate-plan.ts`.

**Why:** no direct Anthropic key is needed - `AI_GATEWAY_API_KEY` is present
locally and the Gateway is the default provider, so batch task 2 (ask owner for
a key) did not trigger. zod 4.3.6 was already a dependency, so no new package.
The generator seam lets every test run with a fake generator: no network, no
Gateway, fully deterministic, and AI calls are mocked as required.

### 2026-06-05 - Batch 08 - Limitations-Driven Safety Rule Lives In The Validator, Not The Schema

`validateGeneratedPlan(candidate, hasLimitations)` enforces non-empty
per-exercise `safety_notes` only when the client reported limitations; the base
`workoutPlanSchema` leaves `safety_notes` nullable.

**Why:** the rule is context-dependent (applies only to clients with
limitations/injuries), so encoding it in the static schema would wrongly reject
valid plans for clients without limitations. Keeping it in the validator keeps
the schema reusable and makes the "safety notes required when limitations exist"
unit test target one pure function.

### 2026-06-05 - Batch 08 - Partial-Plan Rollback By Plan-Row Delete (No DB Transaction)

`saveGeneratedPlan` inserts plan -> workouts -> exercises in order; on any child
failure it deletes the plan row, relying on `on delete cascade` to remove
children, then rethrows. Onboarding passes `archivePrevious: false`; archiving
the prior active plan is gated to the regeneration path (batch 14).

**Why:** Supabase JS has no client-side multi-statement transaction, so the
"never save a partial plan" contract is met by compensating delete instead. The
cascade FKs (already in `0002_app_schema.sql`) make a single delete sufficient.
Generation failure in `saveOnboarding` is non-fatal: the profile stays saved, a
`failed` `plan_generation_events` row is recorded, and the UI shows a localized
"try again later" state.

### 2026-06-05 - Batch 08 - saveOnboarding Now Takes A Locale And Triggers Generation

`saveOnboarding(input, locale?)` gained a second arg; the form passes
`useLocale()`. The success screen branches on `planGenerated`: a "View my plan"
CTA to `/my-plan` when true, a "try again later" message to `/profile` when
false. Updated `onboarding-actions.test.ts` to mock `generateWorkoutPlan` and
the persistence helpers so it stays focused on profile-save behavior.

**Why:** the plan must be generated in the client's language, which only the
request locale supplies. The pre-existing onboarding test broke because the
action now calls the real AI/persistence modules; mocking them is the correct
update for changed behavior. Follow-up: the `/my-plan` route does not exist
until batch 09, so the success "View my plan" button 404s until then.

### 2026-06-05 - Batch 09 - my-plan Active-Plan Read Uses Several Scoped Queries, Not One Deep Join

`getActivePlanDetail()` in `lib/db/workouts.ts` loads the plan, then workouts,
then exercises (`.in(workout_id, ...)`), then logs as separate queries and
stitches them in memory, rather than one nested PostgREST select.

**Why:** each table has its own RLS policy (exercises resolve ownership through
workout -> plan); separate scoped reads keep every row under its own policy and
map cleanly onto the typed `*Row` shapes. The completion action also calls
`clientOwnsWorkout()` before insert so a foreign workout id returns a friendly
`invalidWorkout` instead of an RLS write failure; the DB unique constraint
(`client_id, workout_id, planned_date`) remains the duplicate backstop, and a
unique-violation on insert is mapped back to the `duplicate` code.

### 2026-06-05 - Batch 09 - e2e Gate Needs .env.local Copied Into The Per-Batch Worktree

The Playwright `webServer` runs `npm run dev`, which boots the real Supabase
proxy and crashes without `NEXT_PUBLIC_SUPABASE_URL` / key. `.env.local` is
gitignored and lives only in the primary checkout, so a fresh worktree has none
and every flow times out at "Timed out waiting 120000ms from config.webServer".
Fix: `cp <primary>/.env.local <worktree>/.env.local` before `npx playwright
test`. The file stays gitignored in the worktree, so it never lands in a commit.

**Why:** this bites every batch that runs the e2e gate from a worktree (09
onward). Copy the env file as a standard pre-e2e step; it is local-only and
never committed.

### 2026-06-05 - Batch 10 - Chat Persists Server-Side; Stored History Is The Model's Source Of Truth

The AI virtual-trainer chat does not trust the client-posted message list as the
conversation. The `/api/chat` route: (1) authenticates, (2) saves the incoming
user message to `chat_messages` BEFORE calling the model, (3) re-reads the stored
history and replays THAT as the model conversation (not `body.messages`), and
(4) saves the assistant answer in `toUIMessageStreamResponse`'s `onFinish`,
guarded so a blank/partial answer is never stored. `result.consumeStream()` (no
await) ensures `onFinish` fires even if the client disconnects mid-stream. The
client context (goal, level, limitations, active plan, recent logs) is folded
into the system prompt by the pure `lib/ai/chat-context.ts` builder; prior turns
go to the model as conversation messages, not duplicated into the system prompt.
The page seeds `useChat({ messages })` from persisted history so reloads keep the
transcript; the active locale rides each turn via `sendMessage(_, {body:{locale}})`
so answers stay in the client's language.

**Why:** persisting user-before/assistant-after makes a turn durable even if
generation fails, and replaying stored history (rather than the client's posted
array) makes the server the single source of truth - a tampered or stale client
payload cannot rewrite the transcript the model sees. The mandatory medical-safety
posture (not a doctor, defer pain/injury to a professional) lives in the prompt
builder, not the UI, so it cannot be bypassed by calling the route directly. The
`chat_messages` table and its client-owned RLS already existed from batch 04; this
batch only added the data-access module, context builder, route logic, and UI.

### 2026-06-05 - Batch 11 - Trainer Client List Reuses requireTrainerAdmin And Set-Based Reads; Activity = Current-Month Completion

The trainer landing page lives at `/[locale]/trainer` (not `/admin`, which stays
the generic admin stub). It guards with the existing `requireTrainerAdmin` from
`lib/auth/require-user.ts` (no new guard was written - the prompt's
"`requireTrainerAdmin`" already existed). The activity indicator is a centralized
pure helper `lib/trainer/activity.ts`: `activityLevel(pct)` maps current-month
completion to active/atRisk/inactive at thresholds 50/20 (inclusive lower bound),
and `activityColor` maps those to green/yellow/red tokens (not CSS) so copy and
styling layers stay decoupled and the thresholds have one tested definition.
"Completion this month" reuses the existing pure progress maths: two new helpers
were added to `lib/progress/progress.ts` - `currentMonthPeriod(ref)` (UTC
first-to-last-of-month) and `logsInPeriod(logs, period)` (filters by
`completed_at`, not `planned_date`). The data layer `lib/db/trainer-clients.ts`
issues set-based reads (clients, then active plans, workouts, this-month logs by
`.in(...)`) rather than per-client queries, to avoid an N+1 as the client list
grows; completion is then computed in memory. Each query stays under its own RLS
policy. The page renders a responsive table (>= md) / card (< md) layout, with
empty and error states, and a route-level `loading.tsx`. Each row links to
`/trainer/[clientId]` - the dashboard route batch 12 builds. A "Clients" nav link
(admin-only) was added to the shared `SiteHeader`.

**Why:** computing activity from the *current calendar month* rather than all-time
completion means the indicator reflects whether a client is engaged *now*, which
is what a trainer triages on. Scoping by `completed_at` (when the workout was
logged) rather than `planned_date` credits a client who catches up on a missed
session today. Set-based reads matter because the trainer admin sees every client;
one-query-per-client would not scale. Colour tokens (not classes) keep the helper
unit-testable without a DOM and let RTL/theme styling stay in the component.

**For batch 12:** the per-client dashboard route is `/[locale]/trainer/[clientId]`
(the link target already exists). `listClientsWithActivity(reference?)` takes an
injectable `reference` Date for deterministic tests. e2e specs for trainer
surfaces need a seeded admin (`E2E_ADMIN_EMAIL`/`_PASSWORD`); without it those
tests skip, matching every other auth-gated spec.

### 2026-06-05 - Batch 12 - Trainer Client Dashboard, Notes, WhatsApp

Built `/[locale]/trainer/clients/[clientId]` (profile, current plan + completion,
weekly/monthly Recharts, workout log, AI chat transcript, WhatsApp button,
private notes CRUD). New pure helpers: `lib/trainer/phone.ts` (digits-only
`wa.me` number + validity + deep link), `lib/trainer/aggregation.ts`
(`weeklyCompletions`/`monthlyCompletions` - fixed-length, gap-filled, zero-filled
series with injectable `reference`), `lib/trainer/notes-validation.ts`. Data:
`lib/db/trainer-notes.ts` (CRUD), `lib/db/trainer-client-detail.ts` (aggregate
loader), and `listClientLogsSince` added to `lib/db/workout-logs.ts`. Server
actions in `lib/trainer/notes-actions.ts` re-guard with `requireTrainerAdmin` and
`revalidatePath` both locales. New `TrainerDashboard` i18n namespace (en/he, key
parity verified).

**Why:** completion % is computed over the **active plan's** distinct workouts
(`getActivePlanDetail` logs), but the progress **charts** pull **cross-plan**
recent logs via `listClientLogsSince` (last 180 days) so the trend reflects all
training, including archived plans, not just the current cycle. Workout titles in
the log table resolve only from the active plan's workouts; a log against an
archived-plan workout (not loaded) falls back to a generic localized "Workout"
label - acceptable because the log row still shows date/difficulty/energy/notes,
and loading every historical plan's workouts just to title old logs is not worth
the query cost. WhatsApp validity is purely length-based (7-15 digits, E.164
cap); no country code is inferred, so a number stored without one is used as-is
rather than guessing a locale and producing a wrong link. The button is hidden
(null href) when no valid number exists, per the prompt.

**Deviation (corrected):** the prompt's Task 1 route is
`/[locale]/trainer/clients/[clientId]`, but batch 11's client list linked to
`/trainer/[clientId]` (no `/clients/`). Built the prompt's route and updated the
batch-11 link (both table and mobile card) plus its TSDoc to
`/trainer/clients/[clientId]` so the list actually reaches the dashboard. Batch
11's DECISIONS note that predicted `/trainer/[clientId]` is now superseded.

**Gotcha (recurring):** the e2e gate again required copying `.env.local` into the
worktree before `npx playwright test` (the dev server crashes in `proxy.ts`
without Supabase env). The new admin "add a note" e2e needs both a seeded admin
and a seeded client id (`E2E_CLIENT_ID`); without them it skips, like the other
auth-gated specs. Guest redirect tests run unconditionally and pass.

### 2026-06-05 - Batch 13 - Plan Templates And Management

Template payload IS the `GeneratedPlan` shape (`lib/ai/schemas.ts`), not a
separate template schema. `plan_templates` stores `{ title, description, locale,
payload jsonb }` per the applied migration `0002` (simpler than the
TECHNICAL_REQUIREMENTS draft, which listed `goal/fitness_level/equipment/
template_payload` columns; the migration is the source of truth). Assigning a
template reuses `saveGeneratedPlan({ source: "template", archivePrevious: true })`
- the same never-save-a-partial-plan write path as AI generation and onboarding -
so no new persistence code, and history is preserved by archiving the prior
active plan. A `plan_generation_events` row with `source: "template"` is recorded
on both success and failure.

**Why:** making the template body identical to the generated-plan contract means
a template round-trips through one validator (`validateGeneratedPlan`) and one
writer with zero shape translation. The structured payload is edited in the UI as
a JSON textarea rather than a full nested workout/exercise editor: in-scope for
"save structured template payload" and the batch gate, and a rich editor is a
later polish concern. Client-side `JSON.parse` is only for fast feedback; the
server action re-validates authoritatively.

**Per-client safety re-validation at assignment:** templates validate with
`hasLimitations=false` (a template is generic, so per-exercise `safety_notes` are
not required). But `assignTemplateAction` re-runs `validateGeneratedPlan` against
the TARGET client's `limitations`: if that client declared an injury, a template
lacking per-exercise safety notes is rejected for them rather than silently
assigned. This keeps the same safety guarantee AI generation enforces.

**AI-assisted template creation** reuses `generateWorkoutPlan` with a synthetic
client context built from the trainer's goal/level/equipment inputs (no real
onboarded client needed), behind the same mockable `generate` seam, so the AI
stays server-side and tests never hit the network.

**Nav not wired:** the site header links to `/trainer` only; `/trainer/plans` is
reachable by URL and e2e navigates directly. Left nav untouched to keep the diff
minimal (adding a templates nav link is a trivial follow-up if desired).

**Gotcha (recurring, again):** e2e required copying `.env.local` into the
worktree before `npx playwright test` - the dev server crashes in `proxy.ts`
(`updateSession`) without Supabase env. Worktrees do not inherit the gitignored
env file. The admin/customer plan-management specs skip without seeded
`E2E_ADMIN_*` / `E2E_CUSTOMER_*` creds, like every other auth-gated spec; guest
redirect tests pass unconditionally.

### 2026-06-05 - Batch 14 - Plan Regeneration

Regeneration is a thin orchestration over batch-08/13 building blocks, not new
infrastructure. The shared core is `lib/ai/regenerate-plan.ts`
(`regeneratePlanForClient`): load the latest profile (`getClient`) ->
`generateWorkoutPlan` (mockable `generate` seam) -> only on a validated plan,
`saveGeneratedPlan({ archivePrevious: true, source: "regeneration" })` -> record
a `plan_generation_events` row (succeeded/failed, carrying the reason). Two
`"use server"` actions in `lib/workouts/regeneration-actions.ts` wrap it:
`regenerateMyPlanAction` (`requireClient`, own id) and
`regenerateClientPlanAction` (`requireTrainerAdmin`, target client). One reusable
client dialog `components/regenerate-plan-dialog.tsx` is bound by two thin
wrappers (My Plan page, client dashboard). New `Regeneration` i18n namespace
(en/he). New `lib/validation/regeneration.ts` (`validateRegenerationReason`,
required/tooShort/tooLong, min 3 / max 500 chars).

**Why archive-only-after-validate is the whole point:** `saveGeneratedPlan`
archives the prior active plan only inside the success branch, so a failed AI
call or invalid output leaves the current plan active and untouched (required
test 3). Archiving flips `status`/`archived_at` rather than deleting, and
`workout_logs` reference workouts under the archived plan, so old logs remain
queryable (required test 4) - asserted structurally in
`regeneration-history.test.ts` by driving the real orchestration over a fake
Supabase client and proving NO delete is issued against
`workout_plans`/`workouts`/`workout_logs`.

**Type change:** added `"regeneration"` to `PlanSource` (`lib/db/types.ts`) and
switched `SavePlanOptions.source` from a duplicated literal union to `PlanSource`.
The `workout_plans.source` column is free `text`, so the new value is valid at
the DB level; stamping the plan row `regeneration` (not `ai`) records true
provenance, consistent with how `template` assignment already stamps its rows.

**Base UI, not Radix:** `DialogTrigger`/`DialogClose` take a `render={<Button/>}`
prop, NOT `asChild` + child (that fails typecheck). This matches the existing
`components/ui/dialog.tsx` convention and is the same Base UI gotcha recorded in
batch 03 for menus.

**e2e mocked-AI approach:** regeneration runs through a server action, not an
HTTP route, so the batch-10 `page.route("**/api/chat")` mock does not apply. The
admin e2e instead exercises the required-reason guard (open dialog, submit
whitespace, assert the validation alert) which short-circuits in the validator
BEFORE any model call, plus a `page.route` abort over the Gateway host as a
belt-and-suspenders "no AI call" assertion. Guest redirect tests run
unconditionally; the admin test skips without `E2E_ADMIN_*` + `E2E_CLIENT_ID`.

**Gotcha (recurring):** copied `.env.local` into the worktree before
`npx playwright test`; also `npm ci` is required in a fresh worktree (no shared
`node_modules`) before any gate runs.

### 2026-06-05 - Batch 15 - Push Notifications

Implemented browser Web Push reminders on top of the existing
`push_subscriptions` table (created in batch 04). Used the `web-push` library for
server-side VAPID signing; subscription opt-in lives on the My Plan page.

**`push_subscriptions` already existed:** batch 04 created the table, index,
`updated_at` trigger, and the "Clients manage own push subscriptions" RLS policy
(`auth.uid() = client_id or is_trainer_admin()`). Batch 15 only added the
application layer (data access, routes, UI), no migration.

**VAPID env naming:** browser-safe public key is `NEXT_PUBLIC_VAPID_PUBLIC_KEY`;
the private key is server-only `VAPID_PRIVATE_KEY`; optional `VAPID_SUBJECT`
(defaults to the admin mailto). Generate with `npx web-push generate-vapid-keys`.
These are NOT yet set in `.env.local`/Vercel - push degrades to the graceful
unsupported state until they are. Created `.env.example` (first one in the repo)
documenting all env vars by name.

**Reminder trigger auth (dual-path):** the `/api/push/reminders` route accepts
EITHER a `Bearer ${CRON_SECRET}` header (Vercel Cron) OR a trainer-admin session
(manual test). Vercel Cron invokes via GET, so the route exposes both GET and
POST delegating to one handler. Added `vercel.json` with a daily cron
(`0 16 * * *`).

**No medical detail in push body:** the reminder payload is generic localized
copy only (title + body + deep link), never injury/medical data, because a push
payload can surface on a lock screen. Enforced by building the payload from
static strings in the route, not from client rows.

**React lint gotcha (`react-hooks/set-state-in-effect`):** the new ESLint config
forbids synchronous `setState` in a `useEffect` body. Push support can only be
detected client-side, so the settings component uses a tri-state
`supported: boolean | null` (null = not-yet-detected, renders nothing) and does
ALL state updates inside an async function the effect merely schedules. This
also avoids an SSR hydration mismatch.

**TS 5.9 `Uint8Array` gotcha:** the Push API `applicationServerKey` wants
`BufferSource`; a plain `new Uint8Array(len)` types as
`Uint8Array<ArrayBufferLike>` and fails. Allocate over an explicit
`new ArrayBuffer(len)` so the type is `Uint8Array<ArrayBuffer>`.

**Service worker is plain JS:** `public/sw.js` runs in the ServiceWorker global
scope, not the app bundle, so it stays plain JavaScript and is excluded from the
TS build (no TSDoc-on-exports rule applies; documented with a file header
comment instead).

### 2026-06-05 - Post-Batch-15 - VAPID Keys Generated And Set (Preview Pending)

Generated a VAPID key pair (`npx web-push generate-vapid-keys`) plus a 32-byte
hex `CRON_SECRET`. Wrote all four push vars
(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`CRON_SECRET`) to `.env.local` and to a gitignored backup `.env.vapid.local`.
Set them in Vercel for production and development via the CLI. Preview scope
still NOT set: `vercel env add ... preview` fails with the known
`git_branch_required` CLI bug; awaiting a token to use the REST API workaround
or a manual dashboard entry.

**Why:** push degrades to the unsupported state without VAPID keys, so the keys
had to exist before push can work in any deployed environment. Production +
development are live; only branch-preview deploys lack them.

### 2026-06-05 - Planning - Added Batch 20 (PWA Installability)

Extended the build from 00-19 to 00-20. Batch 20 makes the app an installable,
locale/RTL-aware PWA. Prompt: `docs/prompts/20_PWA_INSTALLABILITY.md`; added to
PROMPT_INDEX, TASK_BREAKDOWN (table + section + dependency list), and the
runbook. Not executed yet.

**Why:** PWA installability ships AFTER batch 19's deployment verification, so
batch 20 must (a) extend the EXISTING `public/sw.js` from batch 15 rather than
add a second service worker, and (b) trigger a re-run of the batch-19 smoke
after it merges. Both constraints are written into the batch-20 prompt.

### 2026-06-05 - Post-Batch-15 - VAPID Preview Scope Resolved

Preview-scope VAPID + CRON_SECRET vars set via the Vercel dashboard
(Preview, all branches), completing the earlier "preview pending" item. All four
push vars (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`CRON_SECRET`) are now present in Production, Preview, and Development; verified
via `vercel env ls`. Push works in all deployed environments on the next deploy.

**Why:** the CLI `git_branch_required` bug blocked setting the all-branches
preview variant, so the dashboard was used instead of the REST API workaround.

### 2026-06-05 - Batch 16 - PDF Export Stack And RTL Handling

Workout-plan PDF export uses `pdf-lib` + `@pdf-lib/fontkit` with an embedded
`NotoSansHebrew-Regular.ttf` (vendored at `lib/pdf/fonts/`, ~113KB, committed).
Route: `GET /api/pdf/workout-plan?clientId=&locale=` (client exports own plan;
trainer admin may pass another `clientId`). The font is added to
`outputFileTracingIncludes` in `next.config.mjs` so the serverless bundle ships
it.

**Why:** `pdf-lib` is pure JS (no headless browser, no native bindings), so it
runs in the Next serverless runtime; a Unicode font MUST be embedded because the
standard PDF fonts only encode WinAnsi and would throw on Hebrew codepoints.
Three non-obvious traps were hit and fixed: (1) `fs.readFile` returns a Node
`Buffer` that fails pdf-lib's `instanceof Uint8Array` check under the jsdom test
realm ("font type NaN") - copy into a fresh `Uint8Array` before `embedFont`;
(2) pdf-lib/fontkit shape a pure Hebrew run correctly when given LOGICAL order
and right-aligned, so NO full bidi reordering is needed - adding bidi-js
double-reversed the words; (3) the only real defect was embedded numeric runs
(reps `8-10`, dates `2026-06-05`) painting reversed inside the RTL run, fixed by
pre-reversing maximal numeric runs (`lib/pdf/bidi.ts#fixRtlNumerals`) so the
renderer's own reversal cancels out. Verified by rendering both locales to PNG.

### 2026-06-05 - Batch 17 - Polish Was Additive, Not Corrective

The audit found the app already responsive, RTL-correct, fully translated (333
keys, en/he parity, no untranslated values beyond numeric formats), with inline
empty/error states and `robots: noindex` on every private page. Batches 02-16
had done the per-surface responsive/a11y work. So batch 17 added the missing
*global* states rather than fixing broken layouts: a localized client-component
`app/[locale]/error.tsx` boundary (inside the locale `NextIntlClientProvider`,
so it translates and flips RTL), and route-level `loading.tsx` skeletons for the
four async data pages that lacked one (`my-plan`, `chat`,
`trainer/clients/[clientId]`, `trainer/plans`; `trainer` already had one). Each
skeleton carries a visually hidden `role=status aria-live=polite` localized
announcement since skeletons are otherwise silent to assistive tech. Four new
`Common.{loading,error.*}` keys back these.

**Why:** the prompt's "fix broken layouts" had little to fix; the real gap was
loading/error coverage. The viewport gate is satisfied by `e2e/responsive.spec.ts`
asserting zero horizontal overflow (`documentElement.scrollWidth - clientWidth
<= 1`) at 390/768/1280 on the guest-reachable shell (home + login) plus Hebrew
RTL at every width - guest pages keep the spec deterministic without seeded
accounts, matching how the other e2e flows skip when `E2E_*` creds are unset.

### 2026-06-05 - Batch 18 - Hardening Was An Audit, Coverage Already Broad

Batches 02-17 each shipped tests with their feature, so the baseline was already
green and broad: 55 vitest files / 416 tests and 60 Playwright tests (46 run, 14
skip). Batch 18 added no new behavior; it closed real coverage gaps found by
diffing `lib/**/*.ts` against modules any test imports. Four pure helpers were
untested and got unit tests: `getPdfLabels` (locale -> PDF label set + fallback),
push env guards (`requireVapidConfig`/`isPushConfigured`), remember-me cookie
helpers (`isAuthCookie`/`stripPersistence`), and the VAPID base64url decoder
(`urlBase64ToUint8Array`). New total: 59 files / 440 tests. The remaining
untested lib modules (`require-admin`, `trainer-client-detail`, `notes-actions`,
`supabase/{client,middleware}`, `utils.cn`, `action-result.ok/fail`) were left
untested deliberately: they are thin Supabase/Next glue or one-line re-exports
already exercised through integration and e2e, where a unit test would only
re-assert the mock.

Codified the e2e split in a new `docs/TESTING.md`: an always-on CI-safe subset
(guest gating, locale/RTL, theme, responsive, unsupported-push) plus a
credential-gated subset (authenticated client/trainer journeys) that `test.skip`s
when `E2E_ADMIN_*`/`E2E_CUSTOMER_*`/`E2E_CLIENT_ID` are unset.

**Why:** the prompt framed 18 as "add missing tests," but with per-feature TDD
across the prior batches there was little missing - padding the suite with tests
of mocked glue would add maintenance cost and no signal. The honest hardening
work was the gap audit plus documenting the deliberately-skipped subset (Task 9),
so batch 19's deployment smoke knows the 14 skips are a credentials-gated CI-safe
choice, not a regression. The e2e dev server needs `.env.local` to boot; copy it
into the worktree (gitignored, never committed) before `npx playwright test`.

### 2026-06-05 - Batch 19 - Deployment Verification Is Bounded By Vercel SSO And The Local-Main Policy

Batch 19 is verification-only; no app code changed. All local gates pass (lint,
typecheck, build, 440 unit/integration tests, 46 e2e passed / 14 credential-gated
skips). The deliverable is `docs/DEPLOYMENT_VERIFICATION.md`, the final
submission checklist status. Two runtime facts bound what "verify the deployment"
can mean here:

1. Production is behind Vercel SSO deployment protection, so anonymous `curl` of
   the live URL returns 401 from Vercel's gate (`_vercel_sso_nonce`,
   `vercel.com/sso`), not the app. Anonymous HTTP smoke of prod/preview is
   impossible without a bypass token or an authenticated browser session. The
   `Ready` build status plus local smoke and the e2e suite (run against a real
   server with live Supabase) are the substitute.
2. Remote `main` (Vercel's Production source) lags local `main`: batches 16-18
   are squash-merged locally only, because `main` is never auto-pushed. So
   Production does not yet reflect the latest work; it will only after the user
   explicitly pushes `main`. Re-run this smoke after that push and after batch 20.

Non-blocking config gaps found (dashboard fixes, not code): `NEXT_PUBLIC_APP_URL`
is unset on Vercel Preview (set on Prod/Dev); Supabase auth redirect-URL allowlist
is not MCP-queryable and needs a manual dashboard confirm for the Vercel origins;
two Supabase security advisor WARNs are expected (`is_trainer_admin()` is
intentionally `SECURITY DEFINER` for RLS use; leaked-password protection is an
optional toggle).

**Why:** so the next session (and batch 20's re-run of the batch-19 smoke) knows
the 401 on prod is Vercel SSO not an app break, knows Production is intentionally
behind local `main` until an explicit push, and has the three managed-dashboard
follow-ups in one place instead of re-discovering them. App-route redirects show
as HTTP 200 RSC navigations under curl, not 30x - trust the e2e browser assertions
for redirect behavior, not raw status codes.

### 2026-06-05 - Batch 20 - The Proxy Matcher Must Exclude `/sw.js` And `/manifest.webmanifest`

The root-scope PWA assets `/sw.js` and `/manifest.webmanifest` were caught by the
next-intl middleware in `proxy.ts` and 307-redirected to `/en/sw.js` /
`/en/manifest.webmanifest`, both of which 404. This silently broke TWO things:
PWA installability (the manifest was unreachable) AND the existing batch-15 push
worker (`navigator.serviceWorker.register('/sw.js')` followed the redirect to a
404, so the worker never registered). Fix: added `sw\.js` and
`manifest\.webmanifest` to the negative-lookahead in `proxy.ts`'s `config.matcher`
so the proxy never runs on them and Next serves them directly at the root scope.
Icons under `/icons/*.png` were unaffected because the matcher already excludes
the `png` extension.

**Why:** any root-scoped static asset that must NOT carry a locale prefix
(service workers are scope-sensitive; the manifest URL is locale-independent by
design) has to be excluded from the locale matcher, not just from the runtime
`bypassesLocale()` check - the redirect happens inside the next-intl middleware
before the proxy body's bypass logic runs. The e2e test that fetched
`/manifest.webmanifest` over real HTTP (not via the rendered `<link>`, which
transparently follows the redirect) is what surfaced this; a DOM-only assertion
would have passed over a production-broken manifest.

### 2026-06-05 - Batch 20 - One Service Worker Serves Both Push And PWA Offline

`public/sw.js` (batch 15's push worker) was EXTENDED, not replaced: it now also
holds the `install` (precache the `/en` + `/he` offline docs, manifest, icons),
`activate` (delete stale caches by `CACHE_VERSION`, then `clients.claim()`), and
`fetch` (network-first, falling back to the locale-matched cached `/offline`
document ONLY for failed navigations) lifecycle, alongside the untouched `push`
and `notificationclick` handlers. The `fetch` handler bypasses everything that is
not a same-origin GET navigation and explicitly never touches `/api/*`, so no
authenticated/Supabase/AI response is ever cached. A Vitest guard
(`__tests__/unit/single-service-worker.test.ts`) asserts exactly one SW file
exists and that it still contains the batch-15 handlers, so future work cannot
regress push or add a second competing worker. SW registration moved from
push-opt-in-only to every page load via `<ServiceWorkerRegister/>` (mounted in
the `[locale]` layout, reusing the injectable `lib/pwa/register.ts` helper).

**Why:** two service workers racing for one scope is a classic PWA regression, so
the single-worker constraint is enforced by a test, not just convention. Eager
registration is what makes the offline shell and installability available to
visitors who never enable reminders. Manifest colors are hard-coded hex
(`#ffffff` theme / `#0f766e` background) in `lib/pwa/manifest.ts`, not read from
the CSS `oklch` tokens, because the manifest spec requires hex/rgb. Icons are
rsvg-generated placeholder dumbbells; the trainer should replace them with brand
art (non-blocking follow-up). iOS web push still requires the user to install the
app to the Home Screen first - the install affordance shows localized
Add-to-Home-Screen steps on iOS Safari (no `beforeinstallprompt` there).

### 2026-06-06 - Planning - Added Batch 21 (Signup Journey Wiring)

Reviewing `docs/planning/USER_JOURNEY.md` against the built app showed the data
layer and AI features are complete (batches 00-20) but the journey SEAMS are
broken: signup confirmation dead-ends at `/profile`, login routes everyone to
`/profile` regardless of onboarding state, the nav never links to the plan, and
onboarding success needs a manual button click. Batch 21 wires these with a
shared `resolvePostAuthDestination(userId)` resolver (admin -> `/admin`; no
client row -> `/join`; active plan -> `/my-plan`; onboarded-no-plan -> `/join`)
used by both `login()` and `/auth/confirm`, plus an onboarding auto-redirect and
a My Plan nav link. This completes the explicit follow-up noted in the
batch-07 entry above ("after sign-in, route a client with no onboarding to
`/join`"); that batch-07 decision (homepage CTA stays `/register`, onboarding is
post-auth) still holds - the CTA is unchanged.

**Why:** the resolver is one shared source of truth so the confirm and login
paths cannot drift. Password recovery is deliberately EXCLUDED: `/auth/confirm`
branches on the OTP `type` and a `recovery` link always lands on
`/reset-password`, never the resolver, so a password reset never gets pulled into
the onboarding flow (own test enforces this). Onboarding stays SOFT-routed, not
hard-gated - `proxy.ts` and the `require*` guards are untouched and `/my-plan` /
`/chat` are not blocked - to keep the change low-risk and away from the
highest-risk integration point. Phase 1 (this entry plus the prompt, task
breakdown, PRD, technical-requirements, and user-journey edits) is docs-only on
`main`; the code ships later via `/run-batch 21`.

### 2026-06-06 - Batch 21 - Signup Journey Wiring: Execution Notes

Phase 2 (the code) shipped. The resolver lives in
`lib/auth/post-auth-redirect.ts`; `login()` and `/auth/confirm` both call it,
the onboarding form auto-redirects to `/my-plan` via a `useEffect` on
`done && planGenerated`, and the header gained a `Nav.myPlan` link gated on
`user && !admin`. Two non-obvious execution points:

1. The prompt suggested an `import "server-only"` guard on the resolver, but the
   package is not a dependency in this template (no other file imports it).
   Adding it would have meant a new dependency for a lint-time guard. Dropped the
   import; server-only-ness is carried by the request-scoped `createClient`
   helpers the resolver composes and documented in its TSDoc instead.
2. `login()` no longer imports `isAdmin` directly (the resolver owns the admin
   check), so `__tests__/integration/login-actions.test.ts` now mocks
   `@/lib/auth/post-auth-redirect` rather than `@/lib/auth/roles`, and the old
   "non-admin -> /profile" / "admin -> /admin" assertions became
   resolver-driven destination assertions.

**Why:** these are the two places a future reader would otherwise be surprised -
why the resolver has no `server-only` import despite the prompt, and why the
login test's mock surface changed. Recovery insulation, soft-routing, and the
unchanged homepage CTA are all as the phase-1 entry above describes.

**Worktree gotcha (cross-batch, also in auto-memory):** symlinking the
worktree's `node_modules` to the primary checkout makes `next build` (Turbopack)
panic with "Symlink node_modules is invalid, it points out of the filesystem
root". Lint, typecheck, and vitest tolerate the symlink; only the build fails.
Fix: `rm node_modules && npm install` a real tree inside the worktree before the
build gate. `node_modules` is gitignored, so this never touches the commit.

### 2026-06-06 - Batches 22-25 - Admin Journey Completion: Planning

Reviewed `docs/planning/ADMIN_CAPABILITIES.md` against the built code. The admin
infrastructure was already shipped across batches 11-16 and 20 (data model, RLS
with `is_trainer_admin()`, AI generation/regeneration, client list, client
dashboard, template manager, PDF route, push notifications). The real defects
were wiring and a few missing surfaces, not missing backend. Eight confirmed
gaps:

1. The post-auth resolver sent admins to `/[locale]/admin`, a hardcoded-English
   stub with only chat/profile links, while the localized console at
   `/[locale]/trainer` was reachable only via a header link.
2-8. `/admin` did not link to the trainer area; `/trainer` did not link to
   `/trainer/plans`; the client dashboard showed only plan title + completion %
   (not the exercises/sets/reps/rest/safety notes already loaded by
   `getActivePlanDetail`); the PDF route had no admin button;
   `createAiTemplateAction` had no UI; per-client push status was not surfaced;
   and there was no in-place editor for a client's live plan.

Decisions (page model set by the product owner, 2026-06-06):

- **Two roles only: `admin` and `customer`. The admin IS the trainer** - no
  separate trainer role. Matches the existing `public.app_role` enum.
- **Two-level hub.** `/[locale]/admin` is the TOP-LEVEL admin dashboard and the
  admin's post-login landing; it links to all admin capabilities, chiefly the
  trainer area. `/[locale]/trainer` is the trainer-specific dashboard reached
  FROM `/admin`, where the admin manages clients and plans. `/admin` is NOT
  collapsed into `/trainer`, and both nav links (Admin -> `/admin`, Clients ->
  `/trainer`) are kept. The resolver continues to return `/admin` (as batch 21
  set), so no resolver change is needed - only the `/admin` page content.
- Closed the gaps as FOUR themed batches: 22 (localized `/admin` top-level
  dashboard + routing), 23 (`/trainer` trainer dashboard + admin<->trainer
  navigation), 24 (client-dashboard completeness: full plan detail, PDF button,
  push status), 25 (plan authoring: AI-template UI + safe live-plan editor).
- Hub links from `/admin`: a trainer-area link to `/trainer` plus account/chat;
  admin-role assignment stays the manual SQL flow (`docs/ADMIN_ROLE_SETUP.md`).
  Hub links from `/trainer`: the client list (the analytics surface) and the
  plan-template manager; notes are per-client; Settings is deferred (no model).
- Batch 25's live-plan editor must NOT hard-delete a workout that has completion
  logs: `workout_logs.workout_id` is `ON DELETE CASCADE` (migration 0002), so an
  unguarded delete would silently destroy the client's progress history that the
  dashboard charts. The editor counts referencing logs and refuses; wholesale
  changes go through the existing archive-based regeneration flow. Edits validate
  pre-write (reusing `lib/ai/schemas` shapes and the limitations safety-note rule)
  to avoid needing transactional rollback Supabase cannot give here.
- Planning docs (PRD, TECHNICAL_REQUIREMENTS, USER_JOURNEY, TASK_BREAKDOWN, the
  prompt files, PROMPT_INDEX) were retconned to present batches 22-25 as original
  scope at the user's request; this entry is the audit trail of why they actually
  exist. RLS read access for the admin on `push_subscriptions` was confirmed
  (migration 0002 policy) before committing batch 24's push-status scope.

**Locale-aware URLs (owner emphasis, 2026-06-06):** every in-app URL across
batches 22-25 must be locale-aware - links/redirects via the `@/i18n/navigation`
`Link`/`redirect` helpers with locale-agnostic paths (e.g. `/trainer`, never
`/en/trainer`), route handlers and server redirects building locale-prefixed
targets, and no raw `<a href>` / `next/link` / `next/navigation` / hardcoded
`/en|/he` for in-app navigation. This was always a project constraint (prompt
constraint #5, FR-001), but it is called out explicitly here because these
batches add the bulk of the app's inter-page admin/trainer navigation
(admin <-> trainer <-> clients <-> plans), so a stray hardcoded path would drop
the user's locale on a hop. Batches 22 and 23 gain an explicit
locale-preservation test (links carry the active prefix in both `/en` and `/he`;
no `next/link`/`<a href>`); the batch-24 PDF link already asserts its locale
param.

**Earlier-plan supersession:** a first planning pass (same day) proposed three
batches that COLLAPSED `/admin` into `/trainer` (making `/trainer` the single
hub and removing the Admin nav link). The product owner then specified the
two-level model above - `/admin` is the main admin dashboard, `/trainer` the
trainer dashboard reached from it - so the plan was reworked into the four
batches here. Do not re-collapse `/admin`.

**Why:** a future reader seeing batches 22-25 in the planning docs as "always
planned" needs the real history - these closed wiring gaps found on 2026-06-06,
not new requirements - the two-role / two-level-hub model the owner mandated, and
the `workout_logs` cascade hazard that shapes the editor. This is docs-only on
`main`; the code ships via `/run-batch 22`, `23`, `24`, `25`.

### 2026-06-06 - Batch 22 - Admin Landing Dashboard (Mostly UI; Wiring Pre-Existed)

Batch 22 turned `/[locale]/admin` from a hardcoded-English stub into the
localized top-level admin dashboard. Net new work was the dashboard UI
(navigation cards built on `components/ui/card`, primary card -> `/trainer`), the
`AdminDashboard` i18n namespace in both catalogs, and tests. Several prompt
"tasks" were already satisfied by batch 21 and only needed confirmation, not
edits: `site-header.tsx` already renders Admin (`/admin`) and Clients
(`/trainer`) for admins only, `resolvePostAuthDestination` already returns
`/admin`, and `requireAdmin()` (an alias of `requireTrainerAdmin()`) already
gates the subtree. So Task 1 was a TSDoc-only change and Task 4 a no-op
confirmation; the rest is additive.

**Why:** the next reader should not expect batch 22 to have touched nav or
post-auth routing - it deliberately did not, to avoid re-deriving working batch-21
wiring. Two gotchas worth carrying: (1) a card-wrapped locale-aware `Link` has an
accessible name that aggregates title + description + CTA, so
`getByRole("link", { name: title })` fails - query card links by `href` (the
locale-prefix contract under test) instead. (2) Playwright's dev server needs
`.env.local` (Supabase URL/key); it is gitignored so it is NOT carried into a
fresh worktree - copy it from the primary checkout before `npx playwright test`
or the web server crashes on boot in `proxy.ts -> updateSession`.

### 2026-06-06 - Batch 23 - Trainer Dashboard Hub (Additive; Page H1 Moved To The Hub Header)

Batch 23 turned `/[locale]/trainer` from a bare client-list page into the
trainer-specific dashboard reached from `/admin`. Net new work: a localized
dashboard header (with a back-to-admin link to `/admin`), a two-card navigation
region (client-list overview + plan-template manager at `/trainer/plans`), the
`TrainerHub` i18n namespace in both catalogs, and tests. The existing client list
stays as the page's primary content, wrapped in a `<section id="trainer-clients">`
so the "client list" card can anchor to it on the same page.

Key decisions:

1. **Task 2 was a no-op confirmation.** Batch 22's `/admin` trainer card already
   targets the locale-agnostic `/trainer` via the locale-aware `Link`; no label or
   target change was needed for the two-level hub to be navigable both ways.
2. **The client-list header demoted from `<h1>` to `<h2>`.** The hub title
   (`TrainerHub.title`) is now the page's single `<h1>`; the `TrainerClients.title`
   ("Clients") became the list section's `<h2>`. The existing trainer e2e asserts
   `getByRole("heading", { name: /clients/i })` with no level, so it still matches.
   A future test that pins the trainer page `<h1>` should expect the hub title, not
   "Clients".
3. **Client-list nav card links to `/trainer#trainer-clients`** (an in-page anchor
   to the list section), not a separate route - per the prompt, analytics IS the
   existing client list, so no separate analytics page. No standalone notes link
   (notes are per-client, reached through a client dashboard).
4. **Single guard preserved.** No `/trainer/layout.tsx` was added; the per-page
   `requireTrainerAdmin()` remains the sole authorization point.

Tests: `__tests__/unit/trainer-hub.test.tsx` (render en/he, all three links
locale-prefixed, no raw anchor without the locale prefix - mocks
`requireTrainerAdmin`, `listClientsWithActivity` -> `[]`, and `getFormatter`),
`__tests__/unit/trainer-hub-i18n.test.ts` (TrainerHub key parity + translated),
and an extension to `e2e/trainer.spec.ts` (creds-gated `/admin` -> `/trainer` ->
`/trainer/plans` with the locale preserved at every hop, in both `/en` and `/he`).

**Why:** recorded so the next reader knows the trainer page is now a hub whose
`<h1>` is the dashboard title (not "Clients"), and that batch 22's nav/post-auth
wiring was deliberately left untouched. The `.env.local`-into-the-worktree step
recurred exactly as the batch-22 entry warned: the first `npx playwright test`
exited 0 but ran zero tests (webServer timed out on the missing Supabase env);
copying `.env.local` + `.env.vapid.local` from the primary checkout fixed it
(both gitignored, so they never reach the commit).

### 2026-06-06 - Batch 24 - Client Dashboard Completeness (Plan Detail, PDF, Push Status)

Batch 24 filled three rendering gaps on the per-client trainer dashboard
(`/[locale]/trainer/clients/[clientId]`): full active-plan detail (every workout
with day/focus/notes plus each exercise's sets/reps/duration/rest/instructions/
safety notes, in stored order), a PDF export control, and a push-reminder status
indicator. No new tables, no AI, no new plan query.

Key decisions:

1. **Plan detail reuses already-fetched data.** `getActivePlanDetail` already
   returns the active plan's workouts and exercises (ordered). The page maps that
   existing structure into a serializable `planWorkouts` shape on
   `ClientDashboardData` (snake_case row fields -> camelCase, e.g.
   `safety_notes` -> `safetyNotes`); no new DB read was added for the detail.
2. **Rest day is inferred from zero exercises.** A workout with an empty
   `exercises` array renders the localized rest-day indicator instead of an
   (empty) exercise list. The schema has no explicit rest-day flag, so absence of
   exercises is the signal - matches how the client `my-plan` view treats it.
3. **PDF button is a plain `<a href download>`, not the fetch-blob
   `ExportPlanButton`.** The prompt's Scope calls it "a pure link to the existing
   route" and test #3 asserts an anchor `href` carrying the locale. A GET to
   `/api/pdf/workout-plan?clientId=&locale=` returns the PDF with a
   content-disposition attachment, so a download anchor triggers the file without
   any client-side PDF code. The href is built server-side in the page (the route
   is NOT locale-prefixed; locale is a query param) and passed as `pdfHref`,
   `null` when there is no active plan, so the control is simply absent then (the
   route 404s without a plan).
4. **`getClientPushStatus` reads ALL rows, not just enabled.** Existing
   `listEnabledSubscriptions` filters `enabled = true`, which cannot distinguish
   "disabled" from "unavailable". The new helper selects by `client_id` only and
   maps: any enabled -> `enabled`; rows exist but none enabled -> `disabled`; no
   rows -> `unavailable`. RLS still scopes it (a non-admin non-owner sees no rows
   -> `unavailable`).
5. **Weekday label localized via the shared `MyPlan.weekday` catalog.** The page
   resolves `day_of_week` through a typed `isWeekdayKey` guard (next-intl messages
   ARE strictly typed in this repo, so a plain `string` key fails typecheck;
   narrowing to the literal union is required), falling back to the raw stored
   value for any non-standard label.

Tests added: `__tests__/unit/trainer-client-dashboard.test.tsx` (render every
plan-detail field en + he/RTL catalog, empty-plan state hides the PDF button, PDF
href per-locale, all three push states localized); `getClientPushStatus` cases in
`__tests__/integration/db-push-subscriptions.test.ts`;
`__tests__/unit/trainer-dashboard-detail-i18n.test.ts` (key parity for the new
`push` / `planDetail` namespaces + `plan.exportPdf`); and a creds-gated extension
to `e2e/trainer-dashboard.spec.ts` (admin sees plan-detail workout blocks, the
PDF link with the locale, and the push-status indicator).

**Why:** the PDF-as-anchor vs reuse-ExportPlanButton choice is the non-obvious
one - `ExportPlanButton` exists and accepts a `clientId`, but it uses `fetch`
(no assertable href) and `MyPlan.export` copy, so it would have failed the
prompt's "links to ... locale" test and mislabeled the trainer surface. The
rest-day-from-zero-exercises inference is a schema gap a future batch adding an
explicit rest flag should know about.

**Process note:** the `/run-batch` command still hardcodes a "00-19" valid-range
check and STOPs outside it; the build has since grown to batch 25 (prompts
`20`-`25` exist, batches 21-23 already merged). Batch 24 ran fine by treating
that check as stale. A future maintainer should widen the command's range guard
(and the runbook table, which still stops at 20) to cover 21-25.

### 2026-06-06 - Batch 25 - Live-Plan Editor Guards The workout_logs Cascade At Two Layers

The live-plan editor never hard-deletes a workout that has completion logs, and
the protection is enforced TWICE: `deleteWorkout` in `lib/db/plan-edits.ts`
counts referencing `workout_logs` (head count) and returns a typed
`{ ok:false, reason:"has_logs" }` before issuing any delete; `deleteWorkoutAction`
maps that to a `hasLogs` `ActionResult` failure; and the dashboard page passes a
per-workout `hasLogs` flag so the editor disables the delete control up front and
shows the blocking copy instead. Exercise deletes and workout-metadata edits are
left unguarded because logs reference workouts, not exercises - removing an
exercise or renaming a workout cannot cascade.

The per-client safety rule is re-validated PRE-WRITE (not in a transaction):
each exercise edit/add loads the workout's current exercises, applies the change
in memory, and rejects when the client has limitations and any resulting exercise
lacks `safety_notes`. Supabase has no client-side transaction here, so validating
before the single write avoids needing rollback - the same shape the batch-08
validator and `assignTemplateAction` use.

**Why:** `workout_logs.workout_id` is `ON DELETE CASCADE` (migration
`0002_app_schema.sql`), so a naive workout delete silently destroys the client's
progress history and charts. A UI-only guard would be bypassable (the action is a
public server entry point) and a server-only guard would let the trainer click a
control that always fails; both layers together make the safe path the only path
and keep the failure legible. Wholesale plan changes still go through
regeneration, which archives the old plan rather than mutating it.

**Editor data piggybacks on the existing load:** the dashboard page builds the
editor bundle (planId, hasLimitations, per-workout hasLogs, exercises) from the
`getActivePlanDetail` result it already fetched for batch 24's read-only plan
detail - no new query. `hasLogs` is derived from the workout ids present in the
loaded logs.

**Env note:** a fresh per-batch worktree has no `.env.local` / `.env.vapid.local`
(both gitignored), so `npm run test:e2e` fails to boot its dev server until those
are copied in from the primary checkout. Lint/typecheck/build/unit do not need
them. Future batches whose gate includes e2e must copy the local env files into
the worktree first.

## 2026-06-06 - Admin e2e auth: inject sessions past the Turnstile captcha

**Decision:** The credential-gated Playwright specs no longer drive the login
form. They authenticate via `injectSession` (`e2e/helpers/auth.ts`), which mints
a session through the Supabase secret-key password grant and injects the
resulting `sb-<ref>-auth-token` cookies into the browser context.

**Why:** Supabase auth has Turnstile captcha enforced, and the project uses a
real (not Cloudflare-test) Turnstile site key, so a headless browser cannot
solve the challenge. Every UI sign-in was rejected with `invalidCredentials`,
which made all 7 admin-authenticated e2e tests fail (verified: a raw password
grant returns `400 captcha protection: request disallowed`). The secret key
bypasses captcha server-side, so the harness mints tokens directly; round-
tripping them through `@supabase/ssr`'s `createServerClient` yields byte-exact,
correctly-chunked cookies, so the injected session is indistinguishable from a
real sign-in. Captcha stays fully enforced for real users - only the test
harness, which holds the secret key, sidesteps it. Rejected alternatives:
swapping in dummy Turnstile keys (mutates remote Supabase auth config) and
disabling captcha (removes enforcement for production traffic).

**Runner env:** `playwright.config.ts` now loads `.env.local` then `.env` via
`dotenv` so the runner process sees `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`, which
`injectSession` needs. Shell-exported `E2E_*` values still win over file values.

**Stale assertion fixed:** `auth.spec.ts`'s admin test asserted the text "signed
in as an administrator", which predates the localized admin dashboard (commit
5477ceb) and no longer exists in any source or message file. Replaced with a
copy- and locale-agnostic `getByRole("heading", { level: 1 })` check, matching
the other admin specs. The drift went unnoticed because the test had never run
with real credentials.

**Result:** 16 admin e2e tests pass, 0 fail. 6 still skip for missing seed data
(no non-admin customer password; `public.clients` is empty so no `E2E_CLIENT_ID`)
- documented skip-gates, not failures; the same flows are covered at the
integration layer with mocked Supabase.

### 2026-06-07 - out-of-batch - Forms must work without JavaScript (3-tier policy)

Project-wide standard adopted: every form uses a real `<form>`, a
`type="submit"` control, and `<label for>`-associated fields, and where feasible
submits with JavaScript disabled. A full audit sorted the forms into three tiers
and set the agreed depth per tier (Tal's call):

- **Tier 1 - auth (login/signup, forgot/reset password):** already fully no-JS
  (real `<form action={serverAction}>` over FormData). Confirmed the Base UI
  `Button` honors `type="submit"` (test `button-submit-type.test.tsx`), so the
  no-JS submit path is real, not assumed.
- **Tier 2 - profile (3 account forms):** converted to full no-JS. New
  FormData-accepting Server Action wrappers (`updateProfileForm` /
  `updateEmailForm` / `updatePasswordForm`) bind directly to `<form action>`;
  the typed-object actions are kept intact for the JS path and the existing
  tests. Feedback uses the **query-param redirect** channel (`?notice` / `?error`
  codes -> localized banner rendered server-side on `/profile`), mirroring the
  auth pattern via a new `Account` message namespace and `resolveAccountMessage`
  allowlist resolver. The password confirm check is re-done server-side so it
  holds with JS off.
- **Tier 3 - onboarding wizard, trainer admin area, chat, push reminders:**
  architecturally JS-dependent; **pragmatic markup only, no rewrites.** Onboarding
  is now wrapped in a real `<form>` with `htmlFor`/`id`-associated native fields
  and a submit button; trainer-notes got an associated `<label>` + `id`/`name`.
  Chat (live AI stream) and push (browser Web Push API, already degrades) stay
  JS-only by nature.

**Why:** Accessibility and resilience - the page must remain usable if JS fails
or is disabled. Full no-JS is high-value on the client-facing profile forms but
disproportionate effort on the admin-only trainer area and impossible for a live
AI stream, so the bar is set per surface rather than uniformly. The query-param
redirect channel was chosen over React-state inline feedback because inline state
is invisible without JS; it also reuses the auth forms' proven pattern and keeps
one source of truth for feedback. Standard is also recorded in auto-memory
(`forms-progressive-enhancement`) to govern future batches.

### 2026-06-07 - Feature - Searchable Phone Country-Code Selector

Replaced the plain `<input type="tel">` phone field (onboarding and profile) with
a searchable country-code selector: emoji flag + dial code + localized name,
searchable by dial code, ISO2 code, English name, and Hebrew name. The full
E.164 number stays in the single `phone` column; a new nullable `country_iso2`
column (migration `0004`, on both `clients` and `profiles`) records the selected
country so re-edit restores the exact flag even for shared dial codes (+1 = US,
CA, ...). Onboarding and profile phone validation were unified on one E.164 rule
`/^\+[1-9]\d{7,14}$/` (replacing onboarding's old 8-15 char and profile's old
7-20 digit rules). Built from the existing cmdk `Command` + Base UI `Popover`
primitives - no new runtime dependency. Country list is a bundled static dataset
(`lib/phone/countries.ts`, 249 entries with Hebrew names); flags are derived from
the ISO2 code via Unicode regional-indicator codepoints, never image assets.

**Why:** mamas-bakery (the cited reference) has no real country selector - just a
plain tel input - and this project already replicated that plus E.164
validation, so "copy mamas-bakery" was already satisfied; the real ask was a
genuine searchable selector. Emoji flags (not images) were a hard requirement;
the cost is that Windows browsers render the 2-letter code instead of a flag
glyph (a platform limitation), mitigated by always showing dial code + name
alongside. `country_iso2` is stored separately rather than parsed back out of the
number because shared dial codes are ambiguous on re-edit; storing the picked
ISO2 makes the flag deterministic. `combineE164` strips a single leading national
trunk-0 (correct for Israel and most countries); a few keep-the-zero cases (e.g.
Italian fixed-line) are not special-cased - a deliberate trade-off of not adding
a phone library. No-JS support is full on the profile form: the server
reconstructs E.164 from the `phone-national` + `countryIso2` fields via
`combineE164` server-side and ignores the hidden (JS-only) `phone` input, so the
typed number survives a no-JS submit; onboarding stays JS-orchestrated (it is a
React multi-step wizard) per the per-surface no-JS bar.

### 2026-06-08 - Tooling - Node 22.16.0 for gates via explicit nvm path

The verification gate (`npm run lint && npm run typecheck && npm run build &&
npm run test`) must run under Node `22.16.0`, pinned in `.nvmrc`. On this machine
Node resolution is ambiguous across contexts: an interactive login shell lands on
Homebrew's Node 26 (`/opt/homebrew/bin/node`), while a non-interactive shell
lands on nvm's stale v18.17.1 - and v18 breaks vitest/rolldown. The intended
v22.16.0 is installed at `~/.nvm/versions/node/v22.16.0` but is not active in any
default context. Verified under v22.16.0: `npm run typecheck` and a `vitest run`
smoke both pass; npm is 11.11.0.

The durable fix is to prefix gate commands with the explicit nvm bin so they are
independent of shell state and of the Homebrew/nvm PATH ordering:

```bash
PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" npm run build
```

**Why:** the user does not want to repin nvm's `default` alias or alter Homebrew
(both are system-wide changes). `.nvmrc` declares intent but a non-interactive
shell (how `/run-batch` runs gates) does not auto-`nvm use` it, so the PATH prefix
is what actually guarantees the right toolchain. `/run-batch` and any manual gate
run in this repo should use that prefix until the host's default Node is itself
22.x.

### 2026-06-08 - Batches 26-28 - Look and feel overhaul: four locked choices

The design/content overhaul (prompts `26_DESIGN_SYSTEM_FOUNDATION.md`,
`27_HOME_RESTYLE_IMAGERY_AND_FOOTER.md`,
`28_ABOUT_CONTACT_PAGES_AND_EMAIL.md`) was planned with the user, who locked four
choices that the batches encode:

1. **Theme classes: explicit `.light` + `.dark`, default `system`.** next-themes
   gets `value={{ light: "light", dark: "dark" }}` so light mode emits a real
   `.light` class; `:root` holds common tokens only, `.dark` and `.light` own
   their palettes (verbatim DESIGN.md hex). `defaultTheme="system"` stays, so OS
   preference and a persisted choice are both honored.
2. **Contact email: real delivery via a Supabase `contact` Edge Function**,
   invoked from the contact server action through `createAdminClient()`
   (`SUPABASE_SECRET_KEY`). Recipient `talorlik@gmail.com` (overridable via a
   `CONTACT_TO` function secret); Gmail SMTP creds live as function secrets. The
   server action degrades gracefully (validate + return success, log on invoke
   failure) so the gate stays green without secrets in CI.
3. **Imagery: download a curated Unsplash gym/personal-training set into
   `public/images/`** with a `CREDITS.md`. No hotlinking, no
   `images.remotePatterns` - local, committed, offline/PWA-safe.
4. **Contact form: real `<form action={serverAction}>` with progressive
   enhancement** (label-for, `type="submit"`, honeypot, works with JS disabled).
   Not mailto; consistent with the repo's existing form pattern and the
   forms-progressive-enhancement bar.

**Why:** (1) DESIGN.md is explicit that theme classes own all palette values
("do not place theme-specific colors in `:root`") and CLAUDE.md says apply
`.dark`/`.light` at the root - option (b) is design-faithful where putting light
on bare `:root` would not be; `system` default avoids overriding OS preference.
(2) There is no email-sending code in the repo and Supabase's SMTP setting only
powers Supabase Auth mail, so a real sender had to be added; the user chose an
Edge Function (secrets stay in Supabase) over adding `nodemailer` to the app, and
graceful degradation keeps CI deterministic. (3) Local images remove a runtime
third-party dependency, survive the service worker's offline shell, and need no
`next.config` change. (4) mailto is not progressive-enhancement friendly (needs a
mail client, no validation, scrapes the address); a server action matches the
forgot-password/login pattern already in the codebase.

**Reference:** before running batches 26-28, load the full technical design into
context: `~/.claude/plans/i-want-to-focus-expressive-kernighan.md`. It holds the
per-batch file lists, the globals.css token/`@theme inline` merge details, the
favicon/logo/Edge-Function specifics, and the verification steps that the prompt
files summarize.

### 2026-06-08 - Batch 26 - Design System Foundation Reconciliations

Three non-obvious choices while applying the DESIGN.md token system:

1. Kept `--font-heading` in the merged `@theme inline` (DESIGN.md's block omits
   it) and pointed it at the display face (`var(--font-family-display)`).
2. Added `--color-destructive-foreground` to the merged `@theme inline` (the
   original stock block lacked it).
3. The batch-26 unit test asserts the favicon metadata and `.light`/`.dark`
   token blocks by reading the source text of `app/[locale]/layout.tsx` and
   `app/globals.css`, not by importing the layout module.

**Why:** (1) `font-heading` is consumed across the shadcn component library
(`card`, `dialog`, `sheet`, `drawer`, `alert-dialog`, `empty`, and the offline
page); dropping the mapping would silently break every component title. Pointing
it at the display face also gives those titles the brand voice for free, matching
DESIGN.md's "display type is the primary brand voice." (2) `.dark`/`.light` both
define `--destructive-foreground` and DESIGN.md's `@theme inline` maps it, so the
Tailwind utility must exist or `text-destructive-foreground` resolves to nothing.
(3) Importing `app/[locale]/layout.tsx` pulls in the next-intl navigation client,
which fails to resolve `next/navigation` under jsdom; asserting the source text
keeps the guard honest (it reads the real file) without booting the next-intl
runtime. Note `new URL(..., import.meta.url)` cannot resolve a path containing
`[locale]` (square brackets break URL parsing), so the test uses
`path.resolve(process.cwd(), ...)` instead.

### 2026-06-08 - Batch 27 - Home restyle, imagery, and shared footer

Four decisions worth recording:

1. Unsplash photographer attribution could not be machine-resolved at download
   time. The public `napi` search and the per-photo page/oEmbed endpoints all
   now return `Authorization required` without an API key. `public/images/CREDITS.md`
   therefore records each file's exact canonical `images.unsplash.com/photo-<id>`
   source URL plus the Unsplash License terms, and explicitly states why the
   photographer column is empty rather than inventing names.
2. Pill CTAs are scoped, not global. The home hero/band CTAs get `rounded-full`
   layered on top of `buttonVariants(...)` via `cn(...)`; the shared `Button`
   and `buttonVariants` keep their `rounded-lg`. A module-level `HERO_CTA`
   constant holds the override.
3. The accent-band overlay uses a token scrim (`bg-background/60`), never an
   rgba literal, so overlay-text contrast holds in both themes automatically:
   `bg-background` resolves to the active theme's background token.
4. The accent band needed its own copy keys (`Home.bandHeading`,
   `Home.bandCta`) instead of reusing `title`/`primaryCta`.

**Why:** (1) honesty over a fabricated credit; the License does not require
attribution, so the images are compliant as committed, and the source URL
uniquely identifies each photo for a later API-based lookup. (2) Per the batch
constraint, the shared button component backs the entire app and must not become
pill-shaped everywhere; only the marketing-home CTAs are pills. (3) DESIGN.md
forbids raw rgba/hex in implementation code and requires guaranteed contrast in
both themes; a token-opacity scrim is the only way to get both. (4) The original
hero CTA and the band CTA both pointed at `/register`; reusing `primaryCta` for
both produced two links with identical accessible names, which made the existing
`homepage.test.tsx` `getByRole("link", { name: primaryCta })` throw on multiple
matches. Distinct band copy removes the collision and reads as a separate
conversion moment. Also: the locale layout `<body>` is now `flex min-h-svh
flex-col` so the shared `SiteFooter` (rendered after `{children}`) sits at the
bottom via `mt-auto`; the page no longer owns the `min-h-svh` wrapper or an
inline footer.
