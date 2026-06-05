# TASK BREAKDOWN - STUDIO ITAI AI COACH ASSISTANT

## 1. Execution Model

The implementation must be performed in small to medium Claude Code batches.
Each batch must:

1. Start from a clean Git working tree unless explicitly continuing a failed
   batch.
2. Inspect the existing template and avoid rewriting working functionality.
3. Implement one coherent vertical or foundation slice.
4. Add or update tests.
5. Run verification commands.
6. Commit the result.

For each batch, use the exact prompt file listed in this document from
`docs/prompts`. The prompt file is the canonical handoff for Claude Code; the
task list in this document is the sequencing and verification summary.

## 2. Required Verification Commands

Use these after most batches:

```bash
npm run lint
npm run typecheck
npm run build
```

Use these after test batches or behavior changes:

```bash
npm run test
npx playwright test
```

If scripts are missing, add them in the relevant tooling batch.

## 3. Batch Dependency Graph

```text
00 Verify existing template and environment
  -> 01 Planning docs and repo conventions
  -> 02 Localization foundation with proxy.ts
  -> 03 Theme and shell UI foundation
  -> 04 Database schema, RLS, and typed data access
  -> 05 Auth verification, profiles, roles, route protection
  -> 06 Homepage, navigation, SEO
  -> 07 Onboarding validation and persistence
  -> 08 AI workout plan generation and persistence
  -> 09 My Plan page and workout completion
  -> 10 AI virtual trainer chat
  -> 11 Trainer admin authorization and client list
  -> 12 Trainer client dashboard, progress, notes, WhatsApp
  -> 13 Plan templates and plan management
  -> 14 Plan regeneration
  -> 15 Push notifications
  -> 16 PDF export
  -> 17 Responsive, accessibility, localization polish
  -> 18 Test hardening
  -> 19 Deployment verification
  -> 20 PWA installability
```

## 4. Batch Summary Table

| Batch | Prompt File                                                   | Scope                                                  | Primary Tests                   | Commit Message                             |
| ----: | ------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- | ------------------------------------------ |
|    00 | `docs/prompts/00_VERIFY_TEMPLATE_AND_ENVIRONMENT.md`          | Verify baseline setup, scripts, envs, auth status      | Smoke/manual checks             | `Verify template baseline and environment` |
|    01 | `docs/prompts/01_CREATE_PLANNING_DOCS_AND_CONVENTIONS.md`     | Place planning docs and enforce naming/location rules  | Docs check                      | `Add planning documentation`               |
|    02 | `docs/prompts/02_LOCALIZATION_FOUNDATION.md`                  | next-intl, `/en`, `/he`, `proxy.ts`, RTL               | Unit + route checks             | `Add locale routing foundation`            |
|    03 | `docs/prompts/03_THEME_AND_UI_SHELL.md`                       | Theme provider, shell, nav, shadcn/Base UI conventions | Component tests                 | `Add theme and application shell`          |
|    04 | `docs/prompts/04_SUPABASE_SCHEMA_RLS_AND_DATA_ACCESS.md`      | Migrations, RLS, data functions                        | Integration/RLS checks          | `Add Supabase schema and RLS policies`     |
|    05 | `docs/prompts/05_AUTH_PROFILES_ROLES_AND_ROUTE_PROTECTION.md` | Auth verification, profiles, roles, admin protection   | Unit + integration              | `Add profile roles and route protection`   |
|    06 | `docs/prompts/06_HOMEPAGE_NAVIGATION_AND_SEO.md`              | Homepage, localized navigation, SEO metadata           | Component/e2e smoke             | `Add localized homepage and SEO`           |
|    07 | `docs/prompts/07_CLIENT_ONBOARDING_FLOW.md`                   | Multi-step onboarding, validation, client save         | Unit + integration + e2e        | `Add smart onboarding flow`                |
|    08 | `docs/prompts/08_AI_WORKOUT_PLAN_GENERATION.md`               | AI structured plan generation, validation, persistence | Unit + integration with AI mock | `Add AI workout plan generation`           |
|    09 | `docs/prompts/09_MY_PLAN_AND_WORKOUT_LOGGING.md`              | Plan display, calendar/list, completion logs           | Unit + integration + e2e        | `Add workout plan view and logging`        |
|    10 | `docs/prompts/10_AI_VIRTUAL_TRAINER_CHAT.md`                  | Chat UI, context loading, AI answers, persistence      | Integration + e2e               | `Add AI trainer chat`                      |
|    11 | `docs/prompts/11_TRAINER_ADMIN_CLIENT_LIST.md`                | Admin landing, client list, activity indicators        | Unit + integration + e2e        | `Add trainer client list`                  |
|    12 | `docs/prompts/12_TRAINER_CLIENT_DASHBOARD_NOTES_WHATSAPP.md`  | Client dashboard, charts, logs, notes, WhatsApp        | Unit + integration + e2e        | `Add trainer client dashboard`             |
|    13 | `docs/prompts/13_PLAN_TEMPLATES_AND_MANAGEMENT.md`            | Template library, create/edit/duplicate/assign         | Integration + e2e               | `Add plan template management`             |
|    14 | `docs/prompts/14_PLAN_REGENERATION.md`                        | Client/admin regeneration and history preservation     | Unit + integration              | `Add workout plan regeneration`            |
|    15 | `docs/prompts/15_PUSH_NOTIFICATIONS.md`                       | Browser push subscription and reminders                | Unit + integration              | `Add workout reminder notifications`       |
|    16 | `docs/prompts/16_PDF_EXPORT.md`                               | PDF export route/action and UI                         | Integration/e2e smoke           | `Add workout plan PDF export`              |
|    17 | `docs/prompts/17_RESPONSIVE_ACCESSIBILITY_AND_COPY_POLISH.md` | Mobile, RTL, contrast, empty/error/loading states      | Playwright visual behavior      | `Polish responsive and accessible UX`      |
|    18 | `docs/prompts/18_TEST_HARDENING.md`                           | Complete unit/integration/e2e coverage                 | Full test suite                 | `Harden automated test coverage`           |
|    19 | `docs/prompts/19_DEPLOYMENT_VERIFICATION.md`                  | Vercel/GitHub/Supabase final verification              | Production smoke                | `Verify deployment readiness`              |
|    20 | `docs/prompts/20_PWA_INSTALLABILITY.md`                       | Installable PWA: manifest, icons, offline shell, SW    | Unit + integration + e2e        | `Add installable PWA support`              |

## 5. Detailed Batch Breakdown

### Batch 00 - Verify Template And Environment

Prompt file: `docs/prompts/00_VERIFY_TEMPLATE_AND_ENVIRONMENT.md`

Goal: confirm the installed template is usable before feature work.

Tasks:

1. Inspect `package.json`, app structure, existing auth files, `.env.example`,
   and `.env.local`.
2. Confirm Next.js, React, TypeScript, next-intl, Supabase, Vercel AI SDK,
   Tailwind, shadcn/ui, Base UI, and test packages.
3. Confirm `proxy.ts` presence or absence.
4. Confirm no root `middleware.ts` conflicts with the assignment.
5. Run local commands.
6. Verify auth flows that already exist.
7. Produce a short findings note in the commit or implementation summary.

Tests:

1. No new formal tests required unless broken scripts are discovered.
2. Smoke test local app.
3. Verify auth manually or through existing tests.

### Batch 01 - Planning Docs And Repo Conventions

Prompt file: `docs/prompts/01_CREATE_PLANNING_DOCS_AND_CONVENTIONS.md`

Goal: place generated planning docs in required locations.

Tasks:

1. Create `docs/planning/PRD.md`.
2. Create `docs/planning/TECHNICAL_REQUIREMENTS.md`.
3. Create `docs/planning/TASK_BREAKDOWN.md`.
4. Create `docs/prompts/*.md`.
5. Ensure Markdown filenames are uppercase with underscores and `.md`.
6. Add an index file for prompts if useful.

Tests:

1. Check files exist.
2. Check no secrets were added.

### Batch 02 - Localization Foundation

Prompt file: `docs/prompts/02_LOCALIZATION_FOUNDATION.md`

Goal: implement locale-prefixed routing before expanding product features.

Tasks:

1. Configure `next-intl`.
2. Create locale config.
3. Create `messages/en-US.json`.
4. Create `messages/he-IL.json`.
5. Add root `proxy.ts`.
6. Add localized route group.
7. Add language switcher.
8. Set `lang` and `dir` attributes.
9. Redirect unsupported locales.
10. Keep auth pages under locale prefix.

Unit tests:

1. Locale prefix parsing.
2. Locale mapping.
3. Direction mapping.
4. Unsupported locale fallback.

Integration/e2e checks:

1. `/en/login` loads.
2. `/he/login` loads.
3. `/he` renders RTL.
4. Navigation preserves selected locale.

### Batch 03 - Theme And UI Shell

Prompt file: `docs/prompts/03_THEME_AND_UI_SHELL.md`

Goal: establish reusable UI shell and persisted theme behavior.

Tasks:

1. Configure `next-themes`.
2. Add theme provider to localized layout.
3. Add theme toggle.
4. Add app shell/nav.
5. Add Sonner toaster.
6. Confirm Tailwind 4 styling conventions.
7. Verify shadcn/ui and Base UI imports.

Tests:

1. Theme preference helper.
2. Theme toggle component.
3. E2E: switch theme and refresh.

### Batch 04 - Supabase Schema, RLS, And Data Access

Prompt file: `docs/prompts/04_SUPABASE_SCHEMA_RLS_AND_DATA_ACCESS.md`

Goal: create safe data foundation.

Tasks:

1. Add migration for required tables.
2. Add `updated_at` trigger.
3. Add role constraints.
4. Add foreign keys and indexes.
5. Enable RLS.
6. Add RLS policies.
7. Add server-only data access functions.
8. Add seed/test strategy if appropriate.

Tests:

1. Permission helper unit tests.
2. Integration tests with mocked or local Supabase where available.
3. RLS policy smoke checks.

### Batch 05 - Auth, Profiles, Roles, And Route Protection

Prompt file: `docs/prompts/05_AUTH_PROFILES_ROLES_AND_ROUTE_PROTECTION.md`

Goal: integrate existing auth with roles and localized route protection.

Tasks:

1. Verify existing auth components/actions.
2. Add/repair profile creation after signup.
3. Add role helpers.
4. Protect client pages.
5. Protect trainer pages.
6. Add localized auth error mapping.
7. Add admin setup flow or documented manual role assignment.

Tests:

1. Role helper tests.
2. Auth redirect integration tests.
3. Client cannot access trainer route.
4. Trainer admin can access trainer route.

### Batch 06 - Homepage, Navigation, And SEO

Prompt file: `docs/prompts/06_HOMEPAGE_NAVIGATION_AND_SEO.md`

Goal: complete public localized homepage.

Tasks:

1. Build `/en` and `/he` homepage.
2. Add product explanation.
3. Add CTA to register/join.
4. Add login link.
5. Add localized navigation.
6. Add metadata and Open Graph.
7. Add responsive layout.

Tests:

1. Homepage renders in English and Hebrew.
2. CTA routes preserve locale.
3. Metadata function returns localized values if implemented as helper.

### Batch 07 - Client Onboarding Flow

Prompt file: `docs/prompts/07_CLIENT_ONBOARDING_FLOW.md`

Goal: collect onboarding data and save client profile.

Tasks:

1. Build multi-step form.
2. Add onboarding validation schema.
3. Add localized field labels/errors.
4. Add Server Action.
5. Upsert `clients` row.
6. Add loading/success/error states.
7. Add mobile layout.

Unit tests:

1. Required fields.
2. Age/age range validation.
3. Available days validation.
4. Equipment array handling.
5. Limitations optional behavior.

Integration tests:

1. Save onboarding data.
2. Update existing onboarding data.
3. Reject invalid payload.

E2E:

1. Client completes onboarding in English.
2. Client completes onboarding in Hebrew.

### Batch 08 - AI Workout Plan Generation

Prompt file: `docs/prompts/08_AI_WORKOUT_PLAN_GENERATION.md`

Goal: generate, validate, and persist structured workout plan.

Tasks:

1. Define AI output schema.
2. Define system prompt and user prompt builder.
3. Ask product owner for Claude API key only if required and missing.
4. Verify local and Vercel AI environment variables.
5. Implement server-side AI call.
6. Validate structured output.
7. Save plan, workouts, exercises.
8. Archive old active plan only when regenerating.
9. Add error handling.
10. Add mocked AI tests.

Unit tests:

1. AI schema accepts valid plan.
2. AI schema rejects malformed plan.
3. Safety notes required when limitations exist.
4. Prompt builder includes client context.

Integration tests:

1. Onboarding triggers mocked AI generation.
2. Generated plan is saved.
3. Invalid AI output is rejected and not saved.

### Batch 09 - My Plan And Workout Logging

Prompt file: `docs/prompts/09_MY_PLAN_AND_WORKOUT_LOGGING.md`

Goal: let clients use the generated plan.

Tasks:

1. Build `/[locale]/my-plan`.
2. Add weekly calendar view.
3. Add weekly list view.
4. Add workout detail drawer/dialog.
5. Add exercise details.
6. Add completion action.
7. Add feedback and notes form.
8. Add progress calculation.
9. Prevent duplicate logs.

Unit tests:

1. Completion percentage.
2. Duplicate completion detection helper.
3. Activity period date helper.

Integration tests:

1. Load active plan.
2. Save workout log.
3. Save notes.
4. Recalculate progress.

E2E:

1. Client views plan.
2. Client completes workout.

### Batch 10 - AI Virtual Trainer Chat

Prompt file: `docs/prompts/10_AI_VIRTUAL_TRAINER_CHAT.md`

Goal: build context-aware AI chat.

Tasks:

1. Build `/[locale]/chat`.
2. Load chat history.
3. Add chat input.
4. Create chat route handler.
5. Load client context.
6. Save user and assistant messages.
7. Add AI safety prompt.
8. Add loading and error states.
9. Add mocked AI tests.

Tests:

1. Context builder includes goal, fitness level, plan, limitations.
2. Messages save and reload.
3. Medical/pain question returns safety language.
4. E2E chat question flow with mocked response.

### Batch 11 - Trainer Admin Client List

Prompt file: `docs/prompts/11_TRAINER_ADMIN_CLIENT_LIST.md`

Goal: build admin landing with client overview.

Tasks:

1. Build `/[locale]/trainer`.
2. Protect route.
3. Query all clients for trainer admin.
4. Calculate current month completion.
5. Render activity indicator.
6. Add empty/loading/error states.
7. Link each row/card to client dashboard.

Unit tests:

1. Completion threshold.
2. Activity color mapping.

Integration tests:

1. Admin can list clients.
2. Client cannot list clients.

E2E:

1. Admin sees client list.
2. Client is blocked.

### Batch 12 - Trainer Client Dashboard, Notes, And WhatsApp

Prompt file: `docs/prompts/12_TRAINER_CLIENT_DASHBOARD_NOTES_WHATSAPP.md`

Goal: provide detailed trainer view.

Tasks:

1. Build client dashboard route.
2. Show profile summary.
3. Show active plan.
4. Show weekly chart.
5. Show monthly chart.
6. Show workout log.
7. Show chat history.
8. Add private trainer notes CRUD.
9. Add WhatsApp link.
10. Add responsive layout.

Unit tests:

1. Phone normalization.
2. Chart aggregation helpers.
3. Trainer note validation.

Integration tests:

1. Load dashboard.
2. Create/update/delete trainer note.
3. Client cannot read trainer notes.

E2E:

1. Admin opens client dashboard.
2. Admin adds private note.
3. WhatsApp link appears when phone exists.

### Batch 13 - Plan Templates And Management

Prompt file: `docs/prompts/13_PLAN_TEMPLATES_AND_MANAGEMENT.md`

Goal: let trainer manage reusable plans.

Tasks:

1. Build `/[locale]/trainer/plans`.
2. Add template list.
3. Add create template form.
4. Add edit template form.
5. Add duplicate template action.
6. Add assign template to client action.
7. Add AI-assisted template creation if practical in this batch.

Tests:

1. Template validation.
2. Duplicate template.
3. Assign template to client.
4. Admin-only access.

### Batch 14 - Plan Regeneration

Prompt file: `docs/prompts/14_PLAN_REGENERATION.md`

Goal: safely regenerate plans without destroying history.

Tasks:

1. Add client regeneration request action.
2. Add trainer regeneration action.
3. Add reason capture.
4. Archive old active plan.
5. Generate new validated plan.
6. Save generation event.
7. Preserve old logs.

Tests:

1. Regeneration archives old plan.
2. New active plan exists.
3. Logs remain unchanged.
4. Invalid regenerated plan does not replace active plan.

### Batch 15 - Push Notifications

Prompt file: `docs/prompts/15_PUSH_NOTIFICATIONS.md`

Goal: implement browser workout reminders.

Tasks:

1. Add notification settings UI.
2. Add service worker or framework-compatible push registration.
3. Add push subscription endpoint.
4. Add unsubscribe endpoint.
5. Add reminder trigger route.
6. Add VAPID env verification.
7. Add graceful unsupported-browser behavior.
8. Add localized copy.

Tests:

1. Subscription payload validation.
2. Save subscription.
3. Disable subscription.
4. Unsupported browser message.
5. Reminder endpoint authorization.

### Batch 16 - PDF Export

Prompt file: `docs/prompts/16_PDF_EXPORT.md`

Goal: export current workout plan as PDF.

Tasks:

1. Add PDF generation dependency/skill as needed.
2. Create PDF document component/template.
3. Create protected PDF route.
4. Add export button to my-plan.
5. Include plan details and safety notes.
6. Support locale labels.
7. Test English path.
8. Test Hebrew path as far as rendering stack allows.

Tests:

1. Unauthorized export denied.
2. Client can export own plan.
3. Admin can export client plan if supported.
4. PDF route returns expected content type.

### Batch 17 - Responsive, Accessibility, And Copy Polish

Prompt file: `docs/prompts/17_RESPONSIVE_ACCESSIBILITY_AND_COPY_POLISH.md`

Goal: make the app product-grade.

Tasks:

1. Review all pages at 390 px, 768 px, 1280 px.
2. Review light/dark contrast.
3. Review RTL Hebrew.
4. Review keyboard navigation.
5. Add empty states.
6. Add loading states.
7. Add error states.
8. Improve localized copy.
9. Check SEO metadata.

Tests:

1. Playwright viewport checks.
2. Theme checks.
3. RTL checks.
4. Basic accessibility assertions where feasible.

### Batch 18 - Test Hardening

Prompt file: `docs/prompts/18_TEST_HARDENING.md`

Goal: complete required test coverage.

Tasks:

1. Review required unit tests.
2. Review required integration tests.
3. Review required e2e tests.
4. Add missing tests.
5. Stabilize mocks and seed data.
6. Ensure AI calls are mocked.
7. Add CI-friendly test scripts.

Tests:

1. Full unit suite.
2. Full integration suite.
3. Full Playwright suite or documented subset.

### Batch 19 - Deployment Verification

Prompt file: `docs/prompts/19_DEPLOYMENT_VERIFICATION.md`

Goal: verify final local and remote readiness.

Tasks:

1. Run final local verification.
2. Confirm Vercel environment variables.
3. Confirm Supabase redirect URLs.
4. Confirm preview deployment.
5. Confirm production deployment.
6. Smoke test core routes.
7. Confirm no secrets in Git.
8. Confirm assignment checklist is satisfied.

Tests:

1. Production build.
2. Preview smoke.
3. Auth smoke.
4. AI route smoke with safe test prompt.
5. Admin route protection smoke.

### Batch 20 - PWA Installability

Prompt file: `docs/prompts/20_PWA_INSTALLABILITY.md`

Goal: make the app an installable, locale- and RTL-aware PWA without breaking
the batch-15 push service worker.

Tasks:

1. Add a Web App Manifest (`app/manifest.ts` or static `manifest.webmanifest`).
2. Add maskable/any-purpose icons (192, 512) and an Apple touch icon (180).
3. Wire manifest, theme-color, and `appleWebApp` metadata into the head.
4. Extend the existing `public/sw.js` with an offline app-shell cache and a
   navigation fallback; keep the push handlers; never cache `app/api/*`, auth,
   Supabase, or AI responses.
5. Register the service worker on normal app load for all visitors (idempotent).
6. Add a localized `/offline` route / app-shell fragment.
7. Add a dismissible install affordance (`beforeinstallprompt` on Chromium; iOS
   Add-to-Home-Screen instructions otherwise), RTL-aware.
8. iOS specifics and documentation (web push requires home-screen install).

Tests:

1. Manifest output (display standalone, icons, theme color).
2. Service-worker registration helper (registers once; no-ops unsupported).
3. Install-prompt component (iOS branch; hides when standalone).
4. Manifest served and referenced icons exist.
5. Playwright: manifest linked on `/en` + `/he`, `/he` is RTL, app shell loads.
6. Single-service-worker guard: only `public/sw.js` exists and still holds the
   batch-15 `push`/`notificationclick` handlers.

Note: batch 20 ships a user-facing feature AFTER batch 19's deployment
verification, so re-run the batch-19 production/preview smoke after merging 20.

## 6. Final Submission Checklist

Product:

- [ ] Homepage explains platform.
- [ ] Authentication works.
- [ ] Client onboarding works.
- [ ] AI workout generation works.
- [ ] My Plan page displays saved plans.
- [ ] Workout completion tracking works.
- [ ] AI chat works.
- [ ] Trainer admin area works.
- [ ] Plan management works.
- [ ] Push notifications work or degrade clearly when unsupported.
- [ ] PDF export works.
- [ ] Trainer notes work.
- [ ] Plan regeneration works.

Localization:

- [ ] English pages work.
- [ ] Hebrew pages work.
- [ ] URLs are language aware.
- [ ] Navigation preserves selected language.
- [ ] Hebrew layout supports RTL.

Theme:

- [ ] Light theme works.
- [ ] Dark theme works.
- [ ] Theme preference persists.
- [ ] Important UI states are readable in both themes.

Testing:

- [ ] Unit tests included.
- [ ] Integration tests included.
- [ ] E2E tests included.
- [ ] Tests cover localization.
- [ ] Tests cover theme behavior.
- [ ] Tests cover client flow.
- [ ] Tests cover admin flow.

Data And AI:

- [ ] Supabase stores client data.
- [ ] Supabase stores workout plans.
- [ ] Supabase stores workout logs.
- [ ] Supabase stores chat messages.
- [ ] AI keys are not exposed to browser.
- [ ] AI errors are handled gracefully.

Final technical check:

- [ ] `npm run dev` works.
- [ ] `npm run build` succeeds.
- [ ] `npm run lint` has no blocking errors.
- [ ] `npm run typecheck` succeeds.
- [ ] Git commits were made along the way.
