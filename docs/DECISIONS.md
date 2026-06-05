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
