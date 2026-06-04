# TECHNICAL REQUIREMENTS - STUDIO ITAI AI COACH ASSISTANT

## 1. Document Control

| Field                      | Value                                     |
| -------------------------- | ----------------------------------------- |
| Product                    | Studio Itai AI Coach Assistant            |
| Document                   | Technical Requirements Specification      |
| Runtime Target             | Next.js 16.1.7 App Router                 |
| Language                   | TypeScript 5.9.3                          |
| Required Document Location | `docs/planning/TECHNICAL_REQUIREMENTS.md` |

## 2. Technical Baseline

### 2.1 Locked Stack

| Layer            | Required Technology                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Framework        | Next.js 16.1.7 App Router                                                                            |
| UI Runtime       | React 19.2.4                                                                                         |
| Language         | TypeScript 5.9.3                                                                                     |
| Routing          | Locale-prefixed App Router with root `proxy.ts`                                                      |
| Localization     | `next-intl` `^4.13.0`                                                                                |
| Styling          | Tailwind CSS 4                                                                                       |
| UI Components    | shadcn/ui base-nova, Base UI                                                                         |
| Icons            | Lucide                                                                                               |
| Theme            | `next-themes`                                                                                        |
| Toasts           | Sonner                                                                                               |
| Charts           | Recharts                                                                                             |
| Drawers          | Vaul                                                                                                 |
| Carousel         | Embla                                                                                                |
| Command Palette  | cmdk                                                                                                 |
| Backend          | Server Components, Server Actions, Route Handlers                                                    |
| Auth             | Supabase Auth                                                                                        |
| Database         | Supabase Postgres                                                                                    |
| DB Security      | Supabase RLS                                                                                         |
| Supabase Clients | `@supabase/ssr`, `@supabase/supabase-js`                                                             |
| AI               | Vercel AI SDK `ai` v6, `@ai-sdk/react`, `@ai-sdk/gateway`, Vercel AI Gateway, Anthropic Claude model |
| Captcha          | Cloudflare Turnstile via `@marsidev/react-turnstile`                                                 |
| Testing          | Vitest, jsdom, Testing Library, Playwright                                                           |
| Tooling          | ESLint 9, `eslint-config-next`, Prettier, Tailwind Prettier plugin, PostCSS, npm                     |
| Dev Automation   | Claude Code template, Supabase MCP, Context7 MCP, Vercel/GitHub deployment workflow                  |

### 2.2 Already Completed Setup

The implementation must not waste effort reinstalling the baseline. It must
verify and build on top of the current project state:

1. Template installed.
2. `/start-from-template` completed.
3. `/setup-vercel-ai` completed.
4. `/setup-github` completed.
5. `/setup-vercel` completed.
6. Accounts linked.
7. Keys and secrets generated.
8. Environment variables implemented.
9. Signup, login, logout, remember me, and forgot password implemented.

### 2.3 Required Verification Before Feature Work

Run:

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

Verify:

1. `.env.local` exists locally and is ignored by Git.
2. Required Supabase variables exist.
3. Vercel AI Gateway variable exists.
4. Public app URL is correct locally.
5. Production/preview Vercel environment variables exist.
6. Auth pages work in the current template.
7. Existing auth can be localized without a full rewrite.

## 3. Target Repository Structure

The implementation should converge toward this structure. Exact component
placement may vary, but boundaries must remain clear.

```text
app/
  [locale]/
    layout.tsx
    page.tsx
    login/
      page.tsx
    register/
      page.tsx
    forgot-password/
      page.tsx
    join/
      page.tsx
    my-plan/
      page.tsx
    chat/
      page.tsx
    trainer/
      page.tsx
      clients/
        [clientId]/
          page.tsx
      plans/
        page.tsx
  api/
    ai/
      workout-plan/
        route.ts
      chat/
        route.ts
    push/
      subscribe/
        route.ts
      unsubscribe/
        route.ts
      reminders/
        route.ts
    pdf/
      workout-plan/
        route.ts
components/
  app/
  auth/
  chat/
  forms/
  layout/
  plan/
  trainer/
  ui/
config/
  locales.ts
  navigation.ts
  routes.ts
hooks/
  use-workout-chat.ts
  use-theme-preference.ts
i18n/
  request.ts
  routing.ts
lib/
  ai/
    prompts.ts
    schemas.ts
    workout-plan.ts
    chat.ts
  auth/
    permissions.ts
    redirects.ts
    server.ts
  db/
    clients.ts
    workout-plans.ts
    workout-logs.ts
    chat-messages.ts
    trainer-notes.ts
    plan-templates.ts
  locale/
    direction.ts
    parsing.ts
  pdf/
    workout-plan-document.tsx
  progress/
    completion.ts
  push/
    subscriptions.ts
  supabase/
    browser.ts
    server.ts
    admin.ts
  validation/
    onboarding.ts
    workout-plan.ts
messages/
  en-US.json
  he-IL.json
supabase/
  migrations/
tests/
  unit/
  integration/
  e2e/
docs/
  planning/
    PRD.md
    TECHNICAL_REQUIREMENTS.md
    TASK_BREAKDOWN.md
  prompts/
    *.md
proxy.ts
```

## 4. Routing And Localization

### 4.1 Locale Mapping

| Route Prefix | Internal Locale | Direction |
| ------------ | --------------- | --------- |
| `en`         | `en-US`         | `ltr`     |
| `he`         | `he-IL`         | `rtl`     |

### 4.2 Required Locale Config

Create a central locale config:

```ts
export const localePrefixes = ["en", "he"] as const
export const defaultLocalePrefix = "en"

export const localeMap = {
  en: "en-US",
  he: "he-IL",
} as const

export const localeDirection = {
  en: "ltr",
  he: "rtl",
} as const
```

### 4.3 Root Request Handling

Requirements:

1. Use root `proxy.ts`.
2. Configure `next-intl` request handling through `proxy.ts`.
3. Do not create root `middleware.ts` unless the template explicitly requires a
   shim.
4. Redirect `/` to `/en` unless a locale preference is already available.
5. Redirect unsupported locale segments to default locale.
6. Exclude static assets, internal Next.js paths, and API routes from
   localization handling where appropriate.

### 4.4 App Layout

The localized layout must:

1. Set `<html lang="en-US" dir="ltr">` for English.
2. Set `<html lang="he-IL" dir="rtl">` for Hebrew.
3. Provide `next-intl` messages.
4. Provide `ThemeProvider`.
5. Provide shared navigation.
6. Provide Sonner toaster.
7. Preserve selected language in links.

### 4.5 Translation Requirements

1. All user-facing strings must be in message files.
2. Auth error messages must be localized.
3. Form validation messages must be localized.
4. AI safety text must be localized.
5. Admin UI text must be localized.
6. PDF labels must be localized.
7. Push notification permission UI must be localized.

## 5. Authentication And Authorization

### 5.1 Supabase Auth Requirements

Use Supabase Auth for:

1. Registration.
2. Login.
3. Logout.
4. Forgot password.
5. Remember me.
6. Session refresh.
7. Localized redirects.

### 5.2 Supabase Server Client

Server-side Supabase client must:

1. Read cookies using the Next.js 16-compatible APIs from the installed
   template.
2. Be used in Server Components, Server Actions, and Route Handlers.
3. Never expose service or secret keys to browser code.

### 5.3 Supabase Browser Client

Browser client may be used only for safe client-side auth state or public
operations permitted by RLS.

### 5.4 Roles

Use `profiles.role`.

Allowed values:

```text
client
trainer_admin
```

Recommended DB constraint:

```sql
role text not null default 'client'
check (role in ('client', 'trainer_admin'))
```

### 5.5 Permission Helpers

Required helpers:

```ts
requireUser()
requireClient()
requireTrainerAdmin()
canReadClient(authUserId: string, clientId: string)
canManagePlan(authUserId: string, planId: string)
```

Each helper requires TSDoc and unit tests.

## 6. Database Design

### 6.1 General Rules

1. Use UUID primary keys.
2. Use `created_at` and `updated_at`.
3. Use RLS on all application tables.
4. Use foreign keys.
5. Use indexes on foreign keys.
6. Use constraints for enums where practical.
7. Prefer normalized workout storage.
8. Preserve original validated AI JSON in `workout_plans.source_payload` if
   useful.
9. Use soft status fields for plan lifecycle instead of deleting historical
   plans.

### 6.2 Tables

#### 6.2.1 `profiles`

Purpose: one row per Supabase auth user.

Columns:

| Column       | Type        | Notes                                    |
| ------------ | ----------- | ---------------------------------------- |
| `id`         | uuid        | Primary key, references `auth.users(id)` |
| `email`      | text        | Optional denormalized email              |
| `full_name`  | text        | Display name                             |
| `role`       | text        | `client` or `trainer_admin`              |
| `locale`     | text        | `en-US` or `he-IL`                       |
| `theme`      | text        | `light`, `dark`, or `system`             |
| `created_at` | timestamptz | Default now                              |
| `updated_at` | timestamptz | Updated by trigger                       |

Relationships:

- One profile may have one client record.
- Trainer admin is also a profile.

#### 6.2.2 `clients`

Purpose: client onboarding and trainer-facing metadata.

Columns:

| Column               | Type        | Notes                             |
| -------------------- | ----------- | --------------------------------- |
| `id`                 | uuid        | Primary key                       |
| `profile_id`         | uuid        | References `profiles(id)`, unique |
| `full_name`          | text        | Required                          |
| `phone`              | text        | Optional WhatsApp use             |
| `age_range`          | text        | Required                          |
| `goal`               | text        | Required                          |
| `fitness_level`      | text        | Required                          |
| `limitations`        | text        | Optional                          |
| `available_days`     | text[]      | Required                          |
| `preferred_location` | text        | home/gym/outdoors/other           |
| `equipment`          | text[]      | Optional                          |
| `preferences`        | text        | Optional                          |
| `status`             | text        | active/inactive/archived          |
| `joined_at`          | timestamptz | Default now                       |
| `created_at`         | timestamptz | Default now                       |
| `updated_at`         | timestamptz | Updated by trigger                |

#### 6.2.3 `workout_plans`

Purpose: generated, manual, or template-derived plan header.

Columns:

| Column              | Type        | Notes                                     |
| ------------------- | ----------- | ----------------------------------------- |
| `id`                | uuid        | Primary key                               |
| `client_id`         | uuid        | References `clients(id)`                  |
| `template_id`       | uuid        | Nullable, references `plan_templates(id)` |
| `title`             | text        | Required                                  |
| `description`       | text        | Optional                                  |
| `status`            | text        | draft/active/archived                     |
| `source`            | text        | ai/manual/template/regenerated            |
| `generation_reason` | text        | Optional                                  |
| `locale`            | text        | Locale of generated content               |
| `safety_notes`      | text        | Optional                                  |
| `source_payload`    | jsonb       | Validated AI response or source plan      |
| `created_by`        | uuid        | References `profiles(id)`                 |
| `created_at`        | timestamptz | Default now                               |
| `updated_at`        | timestamptz | Updated by trigger                        |

Rules:

1. Only one active plan per client.
2. Historical plans remain archived.
3. AI output must validate before inserting workouts/exercises.

#### 6.2.4 `workouts`

Purpose: individual workouts within a plan.

Columns:

| Column                       | Type        | Notes                          |
| ---------------------------- | ----------- | ------------------------------ |
| `id`                         | uuid        | Primary key                    |
| `plan_id`                    | uuid        | References `workout_plans(id)` |
| `name`                       | text        | Required                       |
| `description`                | text        | Optional                       |
| `day_of_week`                | text        | Optional                       |
| `sequence_order`             | integer     | Required                       |
| `estimated_duration_minutes` | integer     | Optional                       |
| `is_rest_day`                | boolean     | Default false                  |
| `created_at`                 | timestamptz | Default now                    |
| `updated_at`                 | timestamptz | Updated by trigger             |

#### 6.2.5 `exercises`

Purpose: exercise rows under workouts.

Columns:

| Column             | Type        | Notes                                |
| ------------------ | ----------- | ------------------------------------ |
| `id`               | uuid        | Primary key                          |
| `workout_id`       | uuid        | References `workouts(id)`            |
| `name`             | text        | Required                             |
| `sets`             | integer     | Nullable for duration-based exercise |
| `reps`             | text        | Nullable                             |
| `duration_seconds` | integer     | Nullable                             |
| `rest_seconds`     | integer     | Nullable                             |
| `instructions`     | text        | Required                             |
| `safety_notes`     | text        | Optional                             |
| `sequence_order`   | integer     | Required                             |
| `created_at`       | timestamptz | Default now                          |
| `updated_at`       | timestamptz | Updated by trigger                   |

#### 6.2.6 `workout_logs`

Purpose: completed workout records.

Columns:

| Column         | Type        | Notes                          |
| -------------- | ----------- | ------------------------------ |
| `id`           | uuid        | Primary key                    |
| `client_id`    | uuid        | References `clients(id)`       |
| `workout_id`   | uuid        | References `workouts(id)`      |
| `plan_id`      | uuid        | References `workout_plans(id)` |
| `planned_date` | date        | Required                       |
| `completed_at` | timestamptz | Required                       |
| `difficulty`   | integer     | Optional 1-5                   |
| `energy_level` | integer     | Optional 1-5                   |
| `notes`        | text        | Optional                       |
| `created_at`   | timestamptz | Default now                    |
| `updated_at`   | timestamptz | Updated by trigger             |

Recommended unique constraint:

```sql
unique (client_id, workout_id, planned_date)
```

#### 6.2.7 `chat_messages`

Purpose: client and AI chat history.

Columns:

| Column       | Type        | Notes                     |
| ------------ | ----------- | ------------------------- |
| `id`         | uuid        | Primary key               |
| `client_id`  | uuid        | References `clients(id)`  |
| `profile_id` | uuid        | References `profiles(id)` |
| `role`       | text        | user/assistant/system     |
| `content`    | text        | Required                  |
| `metadata`   | jsonb       | Optional                  |
| `created_at` | timestamptz | Default now               |

Rules:

1. Client can read own messages.
2. Trainer admin can read all messages.
3. Only server-side handler should insert assistant messages.

#### 6.2.8 `plan_templates`

Purpose: reusable workout plan templates.

Columns:

| Column             | Type        | Notes                       |
| ------------------ | ----------- | --------------------------- |
| `id`               | uuid        | Primary key                 |
| `title`            | text        | Required                    |
| `description`      | text        | Optional                    |
| `goal`             | text        | Optional                    |
| `fitness_level`    | text        | Optional                    |
| `location`         | text        | Optional                    |
| `equipment`        | text[]      | Optional                    |
| `template_payload` | jsonb       | Structured template content |
| `created_by`       | uuid        | References `profiles(id)`   |
| `created_at`       | timestamptz | Default now                 |
| `updated_at`       | timestamptz | Updated by trigger          |

#### 6.2.9 `trainer_notes`

Purpose: private notes by trainer about a client.

Columns:

| Column       | Type        | Notes                     |
| ------------ | ----------- | ------------------------- |
| `id`         | uuid        | Primary key               |
| `client_id`  | uuid        | References `clients(id)`  |
| `trainer_id` | uuid        | References `profiles(id)` |
| `content`    | text        | Required                  |
| `created_at` | timestamptz | Default now               |
| `updated_at` | timestamptz | Updated by trigger        |

Rules:

1. Client cannot read these rows.
2. Trainer admin can create, read, update, delete.

#### 6.2.10 `push_subscriptions`

Purpose: browser push subscription storage.

Columns:

| Column       | Type        | Notes                    |
| ------------ | ----------- | ------------------------ |
| `id`         | uuid        | Primary key              |
| `client_id`  | uuid        | References `clients(id)` |
| `endpoint`   | text        | Required, unique         |
| `p256dh`     | text        | Required                 |
| `auth`       | text        | Required                 |
| `user_agent` | text        | Optional                 |
| `enabled`    | boolean     | Default true             |
| `created_at` | timestamptz | Default now              |
| `updated_at` | timestamptz | Updated by trigger       |

#### 6.2.11 `plan_generation_events`

Purpose: auditable AI plan generation and regeneration events.

Columns:

| Column          | Type        | Notes                                    |
| --------------- | ----------- | ---------------------------------------- |
| `id`            | uuid        | Primary key                              |
| `client_id`     | uuid        | References `clients(id)`                 |
| `plan_id`       | uuid        | Nullable, references `workout_plans(id)` |
| `requested_by`  | uuid        | References `profiles(id)`                |
| `reason`        | text        | Required                                 |
| `status`        | text        | pending/succeeded/failed                 |
| `error_message` | text        | Optional                                 |
| `created_at`    | timestamptz | Default now                              |

## 7. RLS Requirements

### 7.1 RLS Strategy

Every application table must enable RLS.

```sql
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.chat_messages enable row level security;
alter table public.plan_templates enable row level security;
alter table public.trainer_notes enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.plan_generation_events enable row level security;
```

### 7.2 Helper Function

Recommended SQL helper:

```sql
create or replace function public.is_trainer_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'trainer_admin'
  );
$$;
```

### 7.3 Policy Requirements

| Table                    | Client Policy                                       | Trainer Admin Policy      |
| ------------------------ | --------------------------------------------------- | ------------------------- |
| `profiles`               | read/update own limited fields                      | read all                  |
| `clients`                | read/update own client row                          | read/update all           |
| `workout_plans`          | read own active and historical plans                | manage all                |
| `workouts`               | read workouts under own plans                       | manage all                |
| `exercises`              | read exercises under own workouts                   | manage all                |
| `workout_logs`           | create/read own logs                                | read all                  |
| `chat_messages`          | create/read own user messages, read own AI messages | read all                  |
| `plan_templates`         | no direct access unless assigned                    | manage all                |
| `trainer_notes`          | no access                                           | manage all                |
| `push_subscriptions`     | manage own subscriptions                            | read/manage all if needed |
| `plan_generation_events` | read own events                                     | read all                  |

## 8. AI Integration

### 8.1 Architecture

Use server-side AI calls only.

Workout plan generation flow:

```text
Client onboarding form
  -> Server Action or Route Handler
  -> Validate onboarding payload
  -> Load authenticated profile
  -> Upsert client row
  -> Build AI prompt
  -> Call Vercel AI Gateway / Anthropic Claude
  -> Validate structured output
  -> Save plan + workouts + exercises in one controlled operation
  -> Return success or localized failure
```

Chat flow:

```text
Client chat UI
  -> Route Handler
  -> Verify authenticated client
  -> Load client profile + active plan + recent logs + chat history
  -> Save user message
  -> Call AI model server-side
  -> Save assistant response
  -> Return streamed or complete response
```

### 8.2 Required Environment Variables

The final names must match the installed template if it already defines
equivalents.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
AI_GATEWAY_API_KEY=
NEXT_PUBLIC_APP_URL=
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

If a direct Claude key is needed for local or remote behavior, request it at the
AI implementation stage and store it only in local `.env.local` and Vercel
project environment variables. Do not commit it.

### 8.3 Structured Workout Plan Schema

Expected shape:

```ts
type GeneratedWorkoutPlan = {
  title: string
  description: string
  weeklyFrequency: number
  safetyNotes: string[]
  restDays: string[]
  workouts: Array<{
    name: string
    dayOfWeek?: string
    estimatedDurationMinutes?: number
    instructions?: string
    exercises: Array<{
      name: string
      sets?: number
      reps?: string
      durationSeconds?: number
      restSeconds?: number
      instructions: string
      safetyNotes?: string[]
    }>
  }>
}
```

Validation rules:

1. `weeklyFrequency` must be between 3 and 5 unless availability is lower, in
   which case show a safe error or trainer review state.
2. Workouts must not exceed available days.
3. Exercise names and instructions are required.
4. Either reps or duration must exist.
5. Safety notes are required when limitations are present.
6. Output must not include unsupported medical claims.
7. Empty or malformed output must not be saved.

### 8.4 AI Safety Prompt Requirements

The system prompt must instruct the model to:

1. Act as a fitness coaching assistant, not a doctor.
2. Avoid diagnosis.
3. Respect physical limitations.
4. Provide conservative alternatives when pain or injury is mentioned.
5. Recommend contacting a qualified professional for pain, injury, or medical
   concerns.
6. Produce only structured JSON for plan generation.
7. Keep content in the active locale when possible.

### 8.5 AI Error Handling

Handle:

1. Missing API key.
2. Gateway error.
3. Timeout.
4. Invalid JSON.
5. Valid JSON but failed schema validation.
6. DB save failure.
7. Rate limit.

User-facing errors must be localized and non-technical.

## 9. Frontend Requirements

### 9.1 Component Rules

1. Server Components by default.
2. Client Components only for stateful interactive UI.
3. Shared components must be small and composable.
4. Use shadcn/ui and Base UI components where useful.
5. Use Lucide icons consistently.
6. Use Sonner for toasts.
7. Use Recharts for admin progress charts.
8. Use Vaul for mobile-friendly drawers.
9. Use Embla only if carousel behavior adds value.

### 9.2 Forms

All forms must have:

1. Server-side validation.
2. Client-side ergonomic validation where useful.
3. Localized error messages.
4. Accessible labels.
5. Loading state.
6. Success state.
7. Error state.
8. TSDoc on validation helpers.

Recommended validation library may be Zod if present or if added deliberately.

### 9.3 Responsive Breakpoints

Test at:

1. 390 px mobile.
2. 768 px tablet.
3. 1280 px desktop and above.

### 9.4 RTL

Hebrew UI must:

1. Set `dir="rtl"`.
2. Align form labels and major layout direction correctly.
3. Keep numbers, dates, and technical values readable.
4. Render charts legibly.
5. Render chat bubbles naturally.
6. Render PDF content acceptably.

## 10. Backend Requirements

### 10.1 Server Actions

Use Server Actions for:

1. Onboarding submission.
2. Workout completion.
3. Trainer notes mutation.
4. Plan template mutation.
5. Plan regeneration trigger where appropriate.
6. Theme/locale preference updates if stored server-side.

### 10.2 Route Handlers

Use Route Handlers for:

1. AI plan generation if streaming or API semantics are cleaner.
2. AI chat.
3. PDF generation.
4. Push subscription.
5. Push reminder cron/webhook endpoint if used.

### 10.3 Transactions

For plan persistence:

1. Insert `workout_plans`.
2. Insert related `workouts`.
3. Insert related `exercises`.
4. Archive old active plan if generating a new active plan.
5. Record generation event.

Use a database function/RPC or careful server-side sequencing. If sequencing
fails, prevent partial visible active plans.

## 11. PDF Export

### 11.1 Output Requirements

PDF must include:

1. Studio/product name.
2. Client name.
3. Plan title.
4. Plan date.
5. Weekly overview.
6. Workouts.
7. Exercises.
8. Sets/reps/duration.
9. Instructions.
10. Rest times.
11. Safety notes.
12. Locale-aware labels.

### 11.2 Technical Requirements

1. Use a server-side route or server-compatible rendering approach.
2. Keep PDF generation deterministic.
3. Avoid exposing private plan data to other users.
4. Verify `client_id` authorization before export.
5. Support Hebrew as far as available font/rendering allows.
6. Add tests for authorization and rendering entry point.

## 12. Push Notifications

### 12.1 Subscription Flow

1. User opens reminder settings.
2. UI checks browser support.
3. UI requests notification permission.
4. UI subscribes to PushManager.
5. Subscription is saved through a server endpoint.
6. User can disable reminders.

### 12.2 Reminder Trigger

Options:

1. Vercel Cron hitting a protected Route Handler.
2. Server action/manual test trigger during development.
3. Supabase Edge Function only if explicitly chosen later.

The generated docs assume Vercel Cron or a protected Route Handler for the
simplest deployment alignment.

### 12.3 Security

1. Protect cron endpoint with a secret.
2. Store VAPID private key server-side only.
3. Do not place injury details in notification body.
4. Use generic reminder copy.

## 13. Admin Dashboard Requirements

### 13.1 Data Aggregation

Create centralized data functions for:

1. Client list.
2. Client detail.
3. Completion percentage.
4. Weekly progress.
5. Monthly progress.
6. Chat history.
7. Trainer notes.
8. Current active plan.

### 13.2 Charts

Use Recharts for:

1. Weekly completion chart.
2. Monthly completion chart.

Charts must be readable in both themes and both directions.

### 13.3 WhatsApp Link

If client phone exists:

```text
https://wa.me/<normalized-phone-number>
```

Requirements:

1. Normalize phone numbers.
2. Do not render broken link if no phone exists.
3. Keep link localized.

## 14. SEO Requirements

### 14.1 Public Pages

Implement metadata for:

1. Homepage.
2. Login.
3. Register.

### 14.2 Metadata

Each locale should include:

1. `title`.
2. `description`.
3. `openGraph.title`.
4. `openGraph.description`.
5. `alternates.languages` where practical.

### 14.3 Private Pages

Private pages may use minimal metadata and should not be indexed if applicable.

## 15. TSDoc Requirements

TSDoc required for:

1. Exported helper functions.
2. Server Actions.
3. Route Handler utility functions.
4. Database access functions.
5. AI schema parsing.
6. Progress calculations.
7. Permission helpers.
8. Push subscription utilities.
9. PDF generation utilities.
10. Non-trivial React components.

Example:

```ts
/**
 * Calculates the percentage of expected workouts completed in a date range.
 *
 * @param expectedWorkouts - Count of workouts expected in the selected period.
 * @param completedWorkouts - Count of completed workout logs in the selected period.
 * @returns Integer percentage from 0 to 100.
 */
export function calculateCompletionPercentage(
  expectedWorkouts: number,
  completedWorkouts: number
): number {
  // ...
}
```

## 16. Testing Technical Requirements

### 16.1 Vitest

Required config:

1. Unit tests in Node environment where possible.
2. jsdom for component tests.
3. Testing Library for React components.
4. Mocks for Supabase and AI.

### 16.2 Unit Test Targets

1. `lib/validation/onboarding.ts`.
2. `lib/locale/parsing.ts`.
3. `lib/auth/permissions.ts`.
4. `lib/progress/completion.ts`.
5. `lib/ai/schemas.ts`.
6. `lib/push/subscriptions.ts`.
7. `lib/pdf/*` where practical.

### 16.3 Integration Test Targets

1. Auth actions.
2. Onboarding save action.
3. Plan save action with mocked AI.
4. Workout completion action.
5. Chat message persistence with mocked AI.
6. Admin authorization.
7. Trainer notes.
8. Template duplication.
9. Plan regeneration.

### 16.4 Playwright E2E

Use stable seeded test data. Do not rely on live AI responses.

Required setup:

1. Create test client.
2. Create trainer admin.
3. Mock or pre-seed generated workout plan.
4. Test English and Hebrew routes.
5. Test theme switch.
6. Test main client journey.
7. Test admin dashboard journey.

## 17. Build And Deployment

### 17.1 Local Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run test
npx playwright test
```

If `npm run test` does not exist, add it.

### 17.2 GitHub/Vercel

Already configured workflow must be verified:

1. Push to `main` deploys production.
2. Push to branch/PR deploys preview.
3. Vercel environment variables exist for production and preview.
4. Supabase redirect URLs include local and Vercel URLs.
5. AI gateway works remotely.

### 17.3 Environment Verification Checklist

| Variable                               |             Local |    Vercel Preview | Vercel Production | Browser Safe |
| -------------------------------------- | ----------------: | ----------------: | ----------------: | -----------: |
| `NEXT_PUBLIC_SUPABASE_URL`             |          Required |          Required |          Required |          Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |          Required |          Required |          Required |          Yes |
| `SUPABASE_SECRET_KEY`                  |          Required |          Required |          Required |           No |
| `AI_GATEWAY_API_KEY`                   |          Required |          Required |          Required |           No |
| `NEXT_PUBLIC_APP_URL`                  |          Required |          Required |          Required |          Yes |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`       |         As needed |         As needed |         As needed |          Yes |
| `TURNSTILE_SECRET_KEY`                 |         As needed |         As needed |         As needed |           No |
| `VAPID_PUBLIC_KEY`                     | Required for push | Required for push | Required for push |          Yes |
| `VAPID_PRIVATE_KEY`                    | Required for push | Required for push | Required for push |           No |
| `VAPID_SUBJECT`                        | Required for push | Required for push | Required for push |           No |

## 18. Done Definition

A technical batch is done when:

1. Code compiles.
2. Typecheck passes.
3. Lint passes or only documented non-blocking warnings remain.
4. Tests for changed behavior pass.
5. User-facing text is localized.
6. Routes work in English and Hebrew if applicable.
7. RTL does not break Hebrew UI.
8. Light and dark themes remain readable.
9. No secrets are committed.
10. A Git commit is made with a precise message.
