# User Signup Flow/Journey

## 1. Entry Point

The user lands on the localized homepage:

```text
/en
/he
```

The homepage explains the smart fitness platform, presents a call to action for
new clients, provides a login link for existing users, supports language-aware
navigation, and includes theme toggle support. The application must support
English and Hebrew, with `/en` and `/he` prefixes, and Hebrew must render RTL.

## 2. Registration Page

A new client clicks the join/register CTA and is routed to:

```text
/en/register
/he/register
```

The registration page uses Supabase Auth. All labels, validation messages,
errors, and success messages must be localized. The selected language must be
preserved through navigation.

## 3. Account Creation

The user submits the registration form.

Expected system behavior:

1. Supabase Auth creates the user account.
2. The user appears in the Supabase Authentication dashboard.
3. If Supabase email confirmation is enabled, the user receives a confirmation email.
4. The user must confirm the email before login is allowed.
5. Auth errors are shown in the selected language.

## 4. Profile Initialization

After registration, the app should create or initialize a `profiles` record
linked to the Supabase auth user.

The `profiles` entity must support:

```text
id
auth_user_id
role
locale
theme_preference
created_at
updated_at
```

The default role for a normal signup should be:

```text
client
```

The trainer admin role must not be self-selectable by a public user. Per the
assignment, the trainer admin role must be assignable manually in the database
and through an admin setup flow.

## 5. Login After Confirmation

Confirming a signup email establishes the session at `/auth/confirm` and routes
the user directly into the post-auth decision flow (see section 6), so a new
client lands on onboarding without a separate login step. A returning user who is
signed out logs in at:

```text
/en/login
/he/login
```

The user logs in with Supabase Auth.

Expected behavior:

1. Login succeeds.
2. Session is established server-side/client-side through the Supabase SSR setup.
3. The user is routed by a shared post-auth decision (section 6): a safe
   same-site `?redirect=` target wins when present, otherwise the onboarding/plan
   decision applies.
4. Signed-out users trying to access protected client pages are redirected back
   to the localized login page.
5. Regular clients cannot access `/en/trainer` or `/he/trainer`.
6. Password recovery is separate: a recovery link always lands on
   `/reset-password` and never enters the onboarding/plan decision flow.

## 6. First Authenticated Client Routing

After first login, the app checks whether the user has completed onboarding.

Decision flow:

```text
Authenticated user
  |
  |-- No client onboarding record
  |     -> redirect to /en/join or /he/join
  |
  |-- Client onboarding exists and active plan exists
        -> redirect to /en/my-plan or /he/my-plan
```

The onboarding route is:

```text
/en/join
/he/join
```

## 7. Smart Onboarding

The client completes a multi-step onboarding form.

Required collected data:

```text
Full name
Age or age range
Training goal
Current fitness level
Physical limitations or injuries
Available workout days
Preferred workout location
Available equipment
Notes or preferences
```

At the end, the user sees the required action button:

```text
Create my workout plan
```

On submit:

1. Save the client profile/onboarding data in Supabase.
2. Trigger the AI workout plan generator.
3. Save the generated workout plan in Supabase.
4. Show a localized success message.

## 8. AI-Generated Plan Creation

The AI generates a structured workout plan based on the onboarding data.

The generated plan must include:

```text
3-5 workouts per week
Workout names
Exercise names
Sets
Repetitions or duration
Rest times
Execution instructions
Rest days
Safety notes for limitations or injuries
```

The plan must be saved as structured data, not only free text, so the app can
later render workouts, exercises, logs, and progress tracking.

## 9. Post-Onboarding Destination

After the plan is generated and saved, the client is routed automatically (no
manual navigation) to:

```text
/en/my-plan
/he/my-plan
```

The page shows:

```text
Weekly calendar view
Weekly list view
Workout details
Exercise instructions
Mark workout as completed button
Post-workout feedback form
Workout notes
```

When the client completes a workout, the app saves a `workout_logs` record in
Supabase.

## 10. Continued Client Journey

After signup and onboarding, the client can:

```text
View the current workout plan
Track completed workouts
Add workout notes
Ask questions in the AI trainer chat
Receive workout reminders through browser push notifications
Export the workout plan as PDF
Regenerate a plan when goals, availability, or limitations change
```

The AI chat route is:

```text
/en/chat
/he/chat
```

The AI chat must use the client's goal, fitness level, current workout plan, and
known limitations/injuries as context. Chat history must be saved in Supabase so
the trainer can review it.

## 11. Admin And Trainer Journey

The admin is Itai, the trainer. There are two roles only - `admin` and
`customer` - and the admin IS the trainer. The admin journey runs in parallel to
the client journey and shares the same auth and localization foundation.

After the admin logs in (or confirms a signup link), the shared post-auth
decision routes them to the top-level admin dashboard:

```text
/en/admin
/he/admin
```

The admin dashboard is localized and RTL-aware. It is the admin's landing page
and links to all admin capabilities, chiefly the trainer area. A signed-out
visitor is sent to the localized login; a customer is blocked from every `/admin`
and `/trainer` surface.

From the admin dashboard the admin opens the trainer dashboard:

```text
/en/trainer
/he/trainer
```

The trainer dashboard presents the client list as its primary content and links
to the plan-template manager (and back to the admin dashboard). From it the admin
can:

```text
See all clients with goal, join date, plan status, monthly completion %, and
  a green/yellow/red activity indicator
Open a client dashboard
Open the plan-template manager
```

Opening a client dashboard shows the complete state of one client:

```text
Profile and onboarding summary
Full current plan: workouts and exercises with sets, reps or duration, rest,
  execution instructions, rest days, and safety notes
Completion percentage
Weekly progress chart
Monthly progress chart
Workout log with feedback and notes
AI chat questions and answers
Private trainer notes
WhatsApp contact button
PDF export of the client's plan
Push-reminder readiness status (enabled / disabled / unavailable)
```

From the dashboard the trainer admin can act:

```text
Add or edit private trainer notes
Contact the client through WhatsApp
Export the plan to PDF
Edit the client's live plan (workouts and exercises) in place, validated and
  without destroying completion history
Regenerate the client's plan when goals, availability, or limitations change
```

In the plan-template manager the trainer admin can:

```text
Create a template manually
Create a template with AI
Edit a template
Duplicate a template
Assign a template to a client
```

All trainer admin actions are role-gated server-side (`requireTrainerAdmin`) and
protected by Supabase RLS, which grants the trainer admin read/write across
client data while clients remain scoped to their own rows.

## Signup Journey Schematic

```text
Homepage
  /en or /he
    |
    v
Register
  /en/register or /he/register
    |
    v
Supabase Auth creates account
    |
    v
Email confirmation, when enabled
    |
    v
Login
  /en/login or /he/login
    |
    v
Create/load profile
  default role: client
    |
    v
Onboarding check
    |
    |-- incomplete --> /en/join or /he/join
    |                  save client data
    |                  generate AI plan
    |                  save structured plan
    |                  redirect to my plan
    |
    |-- complete ----> /en/my-plan or /he/my-plan
```

## Core Acceptance Criteria

| Area          | Required result                                                                         |
| ------------- | --------------------------------------------------------------------------------------- |
| Localization  | Signup, login, onboarding, errors, and redirects work in English and Hebrew             |
| Auth          | Supabase registration, confirmation, login, logout, and protected routes work           |
| Authorization | Client routes require login, trainer routes require admin role                          |
| Data          | `profiles`, `clients`, and generated workout plan records are saved                     |
| AI            | Plan generation runs server-side and saves structured output                            |
| UX            | Loading, success, empty, and error states are clear                                     |
| Testing       | E2E verifies client registration, login, onboarding, generated plan, and localized URLs |
