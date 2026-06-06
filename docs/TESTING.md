# Testing

This document describes the automated test suite for the Studio Itai AI Coach
Assistant: how it is organized, how to run it, how AI is mocked, and which tests
are intentionally skipped and why.

## Test Layers

The suite has three layers, run by two tools.

- **Unit** (`__tests__/unit/`, Vitest + jsdom): pure helpers and small
  components. Validation, locale routing, roles, theme toggle, progress, AI
  prompt/schema parsing, plan regeneration validation, PDF labels, and push
  helpers.
- **Integration** (`__tests__/integration/`, Vitest): server actions, route
  handlers, and data-access helpers driven against mocked Supabase clients and
  mocked AI. Covers auth, onboarding save, plan save, workout completion, chat
  persistence, admin authorization, trainer notes, templates, and regeneration
  history preservation.
- **End-to-end** (`e2e/`, Playwright + Chromium): real browser against a dev
  server. Covers guest route gating, locale URLs, Hebrew RTL, theme persistence,
  responsive layouts, and (when seeded credentials are supplied) the full client
  and trainer journeys.

## Commands

```bash
npm run test        # full unit + integration suite (vitest run)
npm run test:watch  # vitest in watch mode
npm run test:e2e    # full Playwright suite (playwright test)
```

The standard verification gate after a change is:

```bash
npm run lint && npm run typecheck && npm run build && npm run test
```

Add `npm run test:e2e` for behavior changes that touch routing, locale, theme,
or a user-facing flow.

## AI Is Always Mocked

No test calls a real model or the Vercel AI Gateway. AI is server-side only, and
every test that exercises an AI path stubs the model layer:

- Unit tests assert prompt construction and output-schema parsing against fixed
  fixtures (`__tests__/unit/ai-prompts.test.ts`, `ai-schemas.test.ts`,
  `chat-context.test.ts`).
- Integration tests mock the generation and chat entry points so plan generation
  and chat persistence are verified without a network call
  (`ai-generate-plan.test.ts`, `onboarding-plan-generation.test.ts`,
  `chat-route.test.ts`, `regenerate-plan.test.ts`). Invalid or partial AI output
  is asserted to persist nothing.

This keeps the suite deterministic and free of model cost or flakiness.

## Seed Data

Unit and integration tests use inline, stable fixtures rather than a live
database; Supabase clients are mocked at the module boundary. The Playwright
journey tests that need real rows read account identifiers from the environment
(see below) so the suite carries no committed credentials and no live-data
dependency in its default run.

## Intentionally Skipped Tests (CI-Safe Subset)

The Playwright suite is split into two groups:

- **Always-on (CI-safe):** guest route gating, locale routing and Hebrew RTL,
  theme persistence, responsive layouts, and unsupported-browser push paths.
  These need no credentials and run everywhere, including CI.
- **Credential-gated:** the authenticated client and trainer journeys. Each is
  guarded by `test.skip(...)` and runs only when the corresponding environment
  variables are set. They skip - rather than fail - when unset so the default run
  stays green in environments without seeded users.

The gating variables are:

| Variable              | Unlocks                                              |
| --------------------- | --------------------------------------------------- |
| `E2E_ADMIN_EMAIL`     | Admin login, trainer list, dashboard, plan library  |
| `E2E_ADMIN_PASSWORD`  | (same as above)                                     |
| `E2E_CUSTOMER_EMAIL`  | Client login, onboarding, my-plan, completion, chat |
| `E2E_CUSTOMER_PASSWORD` | (same as above)                                   |
| `E2E_CLIENT_ID`       | Trainer dashboard for a specific seeded client      |

To run the full e2e suite, supply confirmed accounts (the admin must be promoted
per `docs/ADMIN_ROLE_SETUP.md`) and re-run `npm run test:e2e`. Optional
overrides: `E2E_PORT`, `E2E_BASE_URL`.

### Authentication and the auth captcha

Supabase auth has Turnstile captcha enforced, so a headless browser cannot
complete the login form - every UI sign-in is rejected with
`invalidCredentials`. The credential-gated specs therefore do not drive the
login form; they call `injectSession` (in `e2e/helpers/auth.ts`), which mints a
session via the secret-key password grant (the secret key bypasses captcha, a
server-side privilege), round-trips the tokens through `@supabase/ssr` to
produce the exact `sb-<ref>-auth-token` cookies the app reads, and injects them
into the browser context. Captcha stays fully enforced for real users.

This means the runner process needs the app's Supabase env, not just the
`E2E_*` vars. `playwright.config.ts` loads `.env.local` (then `.env`) so
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
`SUPABASE_SECRET_KEY` are present; shell-exported `E2E_*` values still take
precedence over file values.

The reason these are skipped rather than removed: they assert real
authenticated behavior that cannot be exercised without a confirmed Supabase
account, and committing test credentials would violate the secrets-out-of-git
constraint. The skip is therefore a deliberate, documented CI-safe subset, not a
coverage gap - the same flows are covered at the integration layer with mocked
Supabase, and the e2e versions become live once credentials are provided.
