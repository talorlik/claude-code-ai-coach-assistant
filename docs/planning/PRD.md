# PRD - STUDIO ITAI AI COACH ASSISTANT

## 1. Document Control

| Field                      | Value                                                |
| -------------------------- | ---------------------------------------------------- |
| Product                    | Studio Itai AI Coach Assistant                       |
| Product Type               | Full-stack AI fitness coaching platform              |
| Primary User               | Client of Studio Itai                                |
| Admin User                 | Itai Avivi, personal trainer                         |
| Target Build Method        | Claude Code implementation in small reviewed batches |
| Planning Status            | Ready for implementation                             |
| Required Document Location | `docs/planning/PRD.md`                               |

## 2. Source Scope

This PRD is based on the uploaded assignment for a smart fitness platform with
AI, the already-installed AI Game Changer template, and the provided stack
constraints.

The implementation must treat the following as fixed baseline facts:

- The template has already been installed.
- `/start-from-template` has already been run.
- `/setup-vercel-ai` has already been run.
- `/setup-github` has already been run.
- `/setup-vercel` has already been run.
- Supabase, Vercel, GitHub, Vercel AI Gateway, and account linking have already
  been configured.
- Keys, secrets, tokens, and API keys have already been generated and placed in
  the relevant environments, but must be verified.
- Signup, login, logout, remember me, and forgot password already exist, but
  must be verified.
- The Claude API key is available from the product owner and must be requested
  only during the AI implementation stage if it is not already present in local
  and Vercel environment variables.

## 3. Product Summary

Studio Itai AI Coach Assistant is a bilingual AI-assisted coaching platform for
an independent personal trainer. It helps clients complete onboarding, receive
an AI-generated workout plan, follow weekly workouts, log completion and notes,
ask workout questions in an AI virtual trainer chat, and export plans. It helps
the trainer monitor progress, inspect chat history, contact clients through
WhatsApp, manage templates, add private notes, and regenerate plans when client
conditions change.

The product reduces manual onboarding and plan-building effort while preserving
trainer oversight.

## 4. Business Problem

Itai trains 20-30 clients per month. The current workflow creates operational
friction:

| Problem                          | Current Impact                                  | Product Response                                                    |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| Manual intro calls               | 30-45 minutes per new client                    | Structured onboarding flow                                          |
| Manual plan creation             | Hours spent preparing plans                     | AI-generated structured workout plans                               |
| Weak consistency tracking        | Trainer cannot quickly identify who is training | Completion logs, progress charts, activity indicators               |
| Forgotten technique instructions | Clients need repeated explanations              | Plan exercise instructions and AI chat                              |
| Slow feedback between sessions   | Clients wait for trainer response               | Context-aware AI virtual trainer chat                               |
| Limited client overview          | Trainer manually reviews fragmented data        | Admin dashboard with profiles, logs, plans, chat history, and notes |

## 5. Product Goals

### 5.1 Functional Goals

1. Let new clients register, log in, and complete onboarding.
2. Generate a personalized workout plan from onboarding data.
3. Persist generated plans as structured data in Supabase.
4. Let clients view plans, open workout details, mark workouts complete, and
   submit notes.
5. Let clients ask workout-related questions in an AI chat.
6. Let the trainer monitor clients, plans, progress, logs, chat messages, and
   notes.
7. Let the trainer create, edit, duplicate, and reuse plan templates.
8. Support plan regeneration when goals, availability, or limitations change.
9. Support browser push workout reminders.
10. Support workout plan PDF export.
11. Support English and Hebrew with locale-prefixed routes.
12. Support light and dark mode.

### 5.2 Learning Goals

The implementation must demonstrate:

1. Next.js 16 App Router usage.
2. Root `proxy.ts` request handling for locale routing.
3. `next-intl` translation workflow.
4. Supabase Auth, Supabase Postgres, and RLS.
5. AI generation through server-side calls only.
6. Structured AI response validation.
7. Unit, integration, and end-to-end tests.
8. Small, reviewable Git commits.

## 6. Target Users

### 6.1 Client

A client is a person training with Studio Itai.

Client capabilities:

- Register.
- Log in.
- Reset password.
- Complete onboarding.
- Receive a personalized workout plan.
- View weekly plan calendar.
- View weekly plan list.
- View workout and exercise instructions.
- Complete a workout.
- Add feedback and notes after a workout.
- Ask workout questions in the AI virtual trainer chat.
- Receive workout reminders through browser push notifications.
- Export workout plan to PDF.
- Request plan regeneration when relevant fields change.

### 6.2 Trainer Admin

The trainer admin is Itai Avivi.

Trainer capabilities:

- Log in.
- Land on the top-level admin dashboard at `/[locale]/admin`, which links to the
  trainer area at `/[locale]/trainer` (client and plan management).
- Access admin/trainer-only pages.
- View all clients.
- View client goals, plans, and progress.
- Review workout logs and workout notes.
- Review AI chat history.
- Review per-client push-reminder readiness.
- Open WhatsApp to contact a client.
- Export a client's plan to PDF.
- Add private trainer notes.
- Create a plan manually.
- Create a plan with AI.
- Edit a plan, including a client's live assigned plan.
- Duplicate a plan for a client.
- Save plan templates.
- Regenerate plans for clients.

## 7. User Roles And Permissions

There are exactly two roles. The `admin` is the trainer (Itai); there is no
separate trainer role.

| Role            | Description                 | Access                                          |
| --------------- | --------------------------- | ----------------------------------------------- |
| `customer`      | Regular authenticated user  | Client pages and own data                       |
| `admin`         | Itai, the trainer           | Admin dashboard, trainer dashboard, client data |
| Signed-out user | Visitor                     | Homepage, login, register, password reset       |

Authorization rules:

1. Signed-out users must be redirected to the localized login route.
2. Customers must not access `/en/admin/*`, `/he/admin/*`, `/en/trainer/*`, or
   `/he/trainer/*`.
3. Customers must only read and write their own client records, plans, logs, and
   chat messages.
4. The admin can read all client data.
5. The admin can manage plan templates and private trainer notes.
6. Role assignment must be persisted in Supabase and manually assignable.
7. A controlled admin setup flow may assign the first admin, but it must not
   remain publicly exploitable.

## 8. User Journeys

### 8.1 New Client Journey

1. Client opens `/en` or `/he`.
2. Client reviews product value proposition.
3. Client selects language and theme if needed.
4. Client registers.
5. Client confirms email if Supabase confirmation is enabled; confirming a
   signup link establishes the session and routes the client directly into the
   post-auth decision flow (a new client with no onboarding record lands on
   `/en/join` or `/he/join`).
6. Client logs in (if not already signed in from confirmation). The post-auth
   decision flow applies: a client with no onboarding record is routed to
   `/en/join` or `/he/join`; a client with an active plan is routed to
   `/en/my-plan` or `/he/my-plan`; the trainer admin is routed to the admin area.
7. Client lands on onboarding route `/en/join` or `/he/join`.
8. Client completes multi-step onboarding.
9. Client clicks `Create my workout plan`.
10. System saves profile details.
11. System calls the AI workout generator server-side.
12. System validates structured AI response.
13. System saves plan, workouts, and exercises.
14. Client sees a localized success state.
15. On success the app routes the client automatically to `/en/my-plan` or
    `/he/my-plan` (no manual navigation required).
16. Client views weekly calendar/list.
17. Client completes workouts and submits feedback.
18. System updates progress and workout logs.

### 8.2 Existing Client Journey

1. Client logs in.
2. Client opens the plan page.
3. Client reviews current workout.
4. Client marks workout complete.
5. Client adds notes.
6. Client asks a question in AI chat.
7. Chat answer uses client profile, current plan, limitations, and chat context.
8. System saves the conversation.

### 8.3 Trainer Admin Journey

1. Itai logs in.
2. System verifies the `admin` role (the admin is the trainer; there are two
   roles only, `admin` and `customer`).
3. The post-auth decision routes Itai to the top-level admin dashboard at
   `/en/admin` or `/he/admin`. From there Itai opens the trainer area at
   `/en/trainer` or `/he/trainer`, which links to the client list and the
   plan-template manager.
4. Itai sees all clients with goals, join dates, plan status, completion
   percentage, and activity indicator.
5. Itai opens a client dashboard.
6. Itai reviews client profile, the full current plan (workouts and exercises
   with sets, reps, rest, instructions, and safety notes), progress charts, logs,
   notes, chat history, and push-reminder status.
7. Itai adds private notes.
8. Itai opens WhatsApp contact link.
9. Itai exports the client's plan as PDF.
10. Itai edits the client's live plan, or regenerates it, if needed.
11. Itai creates (manually or with AI), edits, or duplicates templates in plan
    management.

## 9. Functional Requirements

### FR-001 - Locale-Aware Routing

The application must support locale-prefixed routes:

- `/en`
- `/he`
- `/en/login`
- `/he/login`
- `/en/register`
- `/he/register`
- `/en/join`
- `/he/join`
- `/en/my-plan`
- `/he/my-plan`
- `/en/chat`
- `/he/chat`
- `/en/admin`
- `/he/admin`
- `/en/trainer`
- `/he/trainer`
- `/en/trainer/plans`
- `/he/trainer/plans`
- `/en/trainer/clients/[clientId]`
- `/he/trainer/clients/[clientId]`

Requirements:

1. Use route prefixes `en` and `he`.
2. Map `en` to `en-US`.
3. Map `he` to `he-IL`.
4. Use `next-intl`.
5. Use root `proxy.ts` for request handling.
6. Do not use root `middleware.ts` unless a compatibility shim is explicitly
   required by the installed template.
7. Redirect unsupported locale routes to default language.
8. Keep navigation in the active language.
9. Render Hebrew pages as RTL.
10. All user-facing text must come from translation files.
11. Every in-app URL must be locale-aware. Links and redirects use the
    `@/i18n/navigation` `Link` / `redirect` helpers with locale-agnostic paths so
    the active locale is preserved; route handlers and server redirects build
    locale-prefixed targets. No raw `<a href>`, `next/link`, `next/navigation`, or
    hardcoded `/en` / `/he` paths for in-app navigation.

### FR-002 - Theme Support

Requirements:

1. Support light and dark mode.
2. Use `next-themes`.
3. Persist selected theme across refreshes.
4. Keep all pages accessible in both themes.
5. Verify form fields, cards, navigation, charts, AI chat messages, dialogs,
   drawers, toasts, and tables.

### FR-003 - Homepage

Routes:

- `/en`
- `/he`

Homepage must include:

1. Short explanation of the product.
2. Call to action for new clients.
3. Login link for existing users.
4. Language switcher.
5. Theme toggle.
6. SEO metadata.
7. Responsive layout.

### FR-004 - Authentication

Requirements:

1. Use existing Supabase Auth implementation if already present.
2. Verify registration.
3. Verify login.
4. Verify logout.
5. Verify remember me.
6. Verify forgot password.
7. Localize auth pages and errors.
8. Redirect signed-out users to localized login.
9. Redirect authenticated clients via a shared post-auth decision: no onboarding
   record -> `/join`; active plan -> `/my-plan`; otherwise -> `/join`. The admin
   (the trainer) goes to the top-level admin dashboard at `/admin`. A safe
   same-site `?redirect=` target, when present, takes precedence. Signup
   confirmation enters this decision flow; password recovery does NOT - a recovery
   link always lands on `/reset-password`.
10. Protect trainer routes.

### FR-005 - Client Onboarding

Route:

- `/en/join`
- `/he/join`

The onboarding form must collect:

1. Full name.
2. Age or age range.
3. Training goal.
4. Current fitness level.
5. Physical limitations or injuries.
6. Available workout days.
7. Preferred workout location: home, gym, outdoors, or other.
8. Available equipment.
9. Notes or preferences.
10. Optional phone number for WhatsApp contact if not already collected.

Required behavior:

1. Multi-step form.
2. Localized validation.
3. Mobile-friendly layout.
4. Submit to Supabase.
5. Trigger AI plan generation.
6. Save generated plan.
7. Show localized success state.
8. Avoid duplicate client profile records on repeated submission.

### FR-006 - AI Workout Plan Generator

The generated plan must include:

1. 3-5 workouts per week based on availability.
2. Workout names.
3. Exercise names.
4. Sets.
5. Repetitions or duration.
6. Rest times.
7. Execution instructions.
8. Rest days.
9. Safety notes for limitations or injuries.

Required behavior:

1. AI call must run server-side only.
2. API keys must never reach browser bundles.
3. Use environment variables for secrets.
4. Request structured JSON output.
5. Validate AI output before saving.
6. Store plans as normalized relational data and preserve raw validated JSON if
   useful.
7. Fail safely if AI output is invalid.
8. Include clear loading and error states.
9. Do not regenerate an existing current plan unless explicitly requested.

Safety requirements:

1. AI must not present itself as a doctor.
2. AI must recommend contacting a qualified professional for pain, injury, or
   medical concerns.
3. AI must respect stated limitations.
4. AI must not generate reckless, extreme, or medically unsafe instructions.
5. If limitations are unclear, AI output must include conservative alternatives.

### FR-007 - My Plan Page

Routes:

- `/en/my-plan`
- `/he/my-plan`

Page must include:

1. Weekly calendar view.
2. Weekly list view.
3. Workout detail view.
4. Exercise instructions.
5. Complete workout button.
6. Completion feedback form.
7. Workout notes.
8. Progress updates.
9. PDF export action.
10. Plan regeneration entry point.

Completion behavior:

1. Create a `workout_logs` row.
2. Save completion timestamp.
3. Save feedback and notes.
4. Prevent duplicate completion for the same client, workout, and planned date
   unless intentionally edited.
5. Recalculate progress after completion.

### FR-008 - AI Virtual Trainer Chat

Routes:

- `/en/chat`
- `/he/chat`

The chat must:

1. Load previous chat history.
2. Save client messages.
3. Generate AI responses.
4. Save AI responses.
5. Use client context:
   - Goal.
   - Fitness level.
   - Current workout plan.
   - Limitations/injuries.
   - Recent workout logs.
6. Show loading states.
7. Show localized error states.
8. Stream responses if the selected implementation supports it safely.
9. Let trainer admin review history.

Safety requirements:

1. Avoid medical diagnosis.
2. Encourage professional care for pain, injury, dizziness, severe discomfort,
   or medical concerns.
3. Provide exercise alternatives when appropriate.
4. Stay within fitness coaching scope.

### FR-009 - Admin Dashboard, Trainer Dashboard, And Client List

Routes:

- `/en/admin`, `/he/admin` - the top-level admin dashboard.
- `/en/trainer`, `/he/trainer` - the trainer dashboard.

`/[locale]/admin` is the top-level admin landing dashboard: it is the post-login
destination for the admin and links to all admin capabilities, chiefly the
trainer area. `/[locale]/trainer` is the trainer-specific dashboard, reached from
`/admin`, where the admin manages all clients and their plans; it links to the
client list and the plan-template manager. There are two roles only - `admin`
(the trainer) and `customer` - so the admin and trainer dashboards are
authorization-identical and differ only in purpose. Analytics is the client list
itself; private notes are reached through a client dashboard; an admin settings
surface is out of scope until a settings model is introduced, and admin-role
assignment remains a manual database flow.

The client list must show:

1. Client name.
2. Goal.
3. Join date.
4. Current plan status.
5. Completion percentage for current month.
6. Visual activity indicator.

Activity indicator rules:

| Color  | Meaning              | Suggested Rule                         |
| ------ | -------------------- | -------------------------------------- |
| Green  | Trains regularly     | >= 75% expected completions this month |
| Yellow | Partially consistent | >= 40% and < 75%                       |
| Red    | Not training         | < 40%                                  |

The exact threshold must be centralized in helper functions and covered by unit
tests.

### FR-010 - Trainer Admin Client Dashboard

The client dashboard must show:

1. Profile summary.
2. Current workout plan in full detail: each workout and its exercises with
   sets, repetitions or duration, rest times, execution instructions, rest days,
   and safety notes.
3. Completion percentage.
4. Weekly progress chart.
5. Monthly progress chart.
6. Workout log.
7. Workout notes.
8. AI chat questions and answers.
9. Private trainer notes.
10. WhatsApp contact button.
11. Plan regeneration action.
12. PDF export action for the client's plan.
13. Push-reminder readiness status for the client (enabled, disabled, or
    unavailable).

### FR-011 - Plan Management

Trainer admin must be able to:

1. Create a plan manually.
2. Create a plan with AI (from the plan manager, server-side via a mockable
   seam).
3. Edit an existing plan, including a client's live assigned plan: modify
   workouts and exercises (sets, reps, duration, rest, instructions, notes,
   safety notes), add and remove exercises, and edit workout metadata. Edits are
   validated before write and must not destroy completion history (a workout with
   logged sessions cannot be hard-deleted).
4. Duplicate a plan for another client.
5. Save plan templates in a library.
6. Edit templates.
7. Duplicate templates.
8. Assign templates to clients.

### FR-012 - Push Notifications

The application must support browser workout reminders.

Requirements:

1. Ask client permission clearly.
2. Store push subscriptions securely in Supabase.
3. Let client enable or disable reminders.
4. Trigger workout reminders based on planned workout days.
5. Handle unsupported browsers gracefully.
6. Include tests for subscription helper logic.
7. Do not send sensitive medical or injury text in push notification body.
8. Surface per-client reminder readiness (enabled, disabled, or unavailable) to
   the trainer admin on the client dashboard.

### FR-013 - PDF Export

The application must let clients export their workout plan as PDF.

Requirements:

1. Export current plan.
2. Include client name, plan date, weekly schedule, workouts, exercises,
   instructions, and safety notes.
3. Support English and Hebrew text.
4. Use locale-aware formatting.
5. Keep secrets out of PDF generation.
6. Include a stable test path for PDF generation where practical.
7. Install React PDF skill/dependency if needed by implementation.

### FR-014 - Trainer Notes

Trainer notes must:

1. Be private to trainer admin.
2. Belong to a client.
3. Support create, edit, delete, and list.
4. Include timestamps.
5. Be inaccessible to client role.

### FR-015 - Plan Regeneration

Regeneration must be available when:

1. Client goal changes.
2. Available days change.
3. Physical limitations change.
4. Equipment changes.
5. Trainer explicitly triggers regeneration.

Requirements:

1. Preserve old plan history.
2. Mark only one active plan per client.
3. Record regeneration reason.
4. Validate new AI output.
5. Do not delete old workout logs.

## 10. Data Requirements

The required entities are:

1. `profiles`.
2. `clients`.
3. `workout_plans`.
4. `workouts`.
5. `exercises`.
6. `workout_logs`.
7. `chat_messages`.
8. `plan_templates`.

Additional recommended entities:

1. `trainer_notes`.
2. `push_subscriptions`.
3. `plan_generation_events`.

## 11. Non-Functional Requirements

### 11.1 Security

1. Supabase RLS must protect all database tables.
2. Server-side APIs must verify the authenticated user.
3. Trainer routes must verify `trainer_admin`.
4. AI and Supabase secret keys must never be exposed to the browser.
5. Cloudflare Turnstile must protect public high-risk forms where applicable.
6. Use server-side validation for all writes.
7. Never trust client-submitted role values.
8. Do not log secrets, tokens, or raw private health data.
9. Store only necessary personal information.

### 11.2 Privacy

1. Clients can only access their own data.
2. Trainer can access client data for coaching purposes.
3. Private trainer notes are hidden from clients.
4. AI prompts should include only the minimum required client context.
5. Chat history and workout data must be stored intentionally and visibly.

### 11.3 Performance

1. Core routes should render quickly.
2. Avoid unnecessary client components.
3. Use Server Components where possible.
4. Use Server Actions or Route Handlers for mutations.
5. Load charts only where needed.
6. Keep AI calls asynchronous with visible loading state.

### 11.4 Reliability

1. Invalid AI responses must not corrupt the database.
2. Use transactions or staged inserts for plan persistence.
3. Use retries only where safe.
4. Display clear error states.
5. Avoid duplicate workout logs.

### 11.5 Accessibility

1. Use semantic HTML.
2. Support keyboard navigation.
3. Ensure color contrast in light and dark mode.
4. Ensure focus states are visible.
5. Ensure forms have labels.
6. Ensure Hebrew RTL layout is valid.
7. Use accessible dialog/drawer components.

### 11.6 SEO

1. Localized metadata for homepage and public auth routes.
2. Correct `lang` and `dir` attributes.
3. Canonical or alternate language metadata where practical.
4. Meaningful page titles and descriptions.
5. Open Graph metadata for homepage.

### 11.7 Documentation

1. TSDoc for exported functions, helpers, server actions, route handlers, AI
   parsing utilities, database mappers, and complex components.
2. Inline comments only where logic is non-obvious.
3. Prompt files must remain under `docs/prompts`.
4. Planning files must remain under `docs/planning`.

## 12. Testing Requirements

### 12.1 Unit Tests

Required coverage:

1. Onboarding validation.
2. Locale parsing and redirects.
3. Role and permission helpers.
4. Theme preference helpers.
5. Completion percentage calculation.
6. Activity color calculation.
7. AI response parsing and validation.
8. Plan regeneration reason handling.
9. Push subscription helper logic.

### 12.2 Integration Tests

Required coverage:

1. Registration and login action behavior.
2. Creating and updating a client profile.
3. Saving onboarding data.
4. Saving generated workout plan.
5. Marking workout completed.
6. Saving and loading chat messages.
7. Admin authorization checks.
8. Trainer notes CRUD.
9. Plan template duplication.
10. Plan regeneration.

External AI calls must be mocked.

### 12.3 End-To-End Tests

Required flows:

1. Client registers and logs in.
2. Client completes onboarding.
3. Client views generated plan.
4. Client marks workout complete.
5. Client asks chat question.
6. Admin views client list and client dashboard.
7. English and Hebrew locale URLs work.
8. Hebrew renders RTL.
9. Light and dark themes can be selected.
10. PDF export is available.
11. Push notification opt-in path is available or gracefully skipped by browser
    capability.

## 13. Acceptance Criteria

The product is acceptable when:

1. `npm run dev` works locally.
2. `npm run build` succeeds.
3. `npm run lint` has no blocking errors.
4. `npm run typecheck` succeeds.
5. All required routes exist in both locales.
6. Signed-out client routes redirect to localized login.
7. Client role cannot access trainer admin pages.
8. Onboarding saves client details.
9. AI plan generation saves structured plan data.
10. Current plan can be reloaded without regenerating.
11. Workout completion creates a log.
12. Client chat persists messages.
13. Trainer dashboard shows client progress, full plan detail, chat history, PDF
    export, and push-reminder status.
14. The admin lands on `/[locale]/admin` (the top-level dashboard), which links to
    the trainer area at `/[locale]/trainer`.
15. Plan templates can be created (manually or with AI), edited, duplicated, and
    assigned; a client's live plan can be edited in place without losing logs.
15. Push notifications are implemented or browser capability is handled clearly.
16. PDF export works for a saved plan.
17. English and Hebrew translations are complete for user-facing text.
18. Hebrew pages are RTL.
19. Theme persists across refreshes.
20. Unit, integration, and e2e tests cover the required flows.

## 14. Out Of Scope

The following are not required unless explicitly added later:

1. Native mobile app.
2. Payment processing.
3. Wearable device integration.
4. Nutrition plan generation.
5. Video upload and form analysis.
6. Real medical diagnosis.
7. Multi-trainer studio management.
8. Appointment scheduling.
9. In-app messaging between client and trainer outside AI chat.
10. SMS reminders.

## 15. Risks And Mitigations

| Risk                                  | Impact                      | Mitigation                                              |
| ------------------------------------- | --------------------------- | ------------------------------------------------------- |
| AI output is malformed                | Plan cannot be saved safely | Validate structured output before DB writes             |
| RLS mistakes expose client data       | Privacy breach              | Write and test RLS policies early                       |
| Localization added late               | Rework across app           | Locale routing is foundation batch                      |
| Admin role assignment is insecure     | Unauthorized access         | Do not trust client role input; use server checks       |
| Auth already exists but is incomplete | Broken flows                | First task verifies auth rather than rebuilding blindly |
| Browser push support varies           | Inconsistent UX             | Capability detection and graceful fallback              |
| Hebrew PDF rendering issues           | Broken export               | Test RTL PDF path early                                 |
| Plan regeneration overwrites history  | Loss of coaching data       | Mark old plans inactive instead of deleting             |
| AI gives medical advice               | Safety risk                 | System prompt, scope guardrails, and fallback language  |

## 16. Implementation Principles

1. Build foundation first: localization, auth verification, roles, schema,
   helpers.
2. Keep tasks small to medium.
3. Commit after every working batch.
4. Test helpers before wiring UI.
5. Mock AI in tests.
6. Use Server Components by default.
7. Use Client Components only for interactive UI.
8. Keep all secrets server-side.
9. Use RLS as the main data safety layer.
10. Keep user-facing copy translatable from the start.
