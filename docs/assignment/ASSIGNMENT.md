# Assignment 2: Smart Fitness Platform With AI

Build a full-stack fitness coaching platform for an independent personal
trainer. The application must let clients complete onboarding, receive an
AI-generated workout plan, track workouts, ask questions in an AI chat, and
let the trainer monitor client progress from an admin area.

This assignment is based on the business case for "Studio Itai", a personal
fitness training studio operated by Itai Avivi.

## Table Of Contents

- [Scenario](#scenario)
- [Learning Goals](#learning-goals)
- [Required Users](#required-users)
- [Technical Baseline](#technical-baseline)
- [Global Requirements](#global-requirements)
- [Feature Requirements](#feature-requirements)
- [AI Requirements](#ai-requirements)
- [Required Data Model](#required-data-model)
- [Development Milestones](#development-milestones)
- [Testing Requirements](#testing-requirements)
- [Git Requirements](#git-requirements)
- [Additional Required Features](#additional-required-features)
- [Submission Checklist](#submission-checklist)

## Scenario

Itai Avivi is an independent personal fitness trainer who trains 20-30 clients
per month. Today, much of his work is manual:

- Every new client requires a 30-45 minute introduction call.
- Itai spends hours preparing personalized workout plans.
- It is difficult to track who trains consistently and who does not.
- Clients forget exercise instructions and proper technique.
- Clients do not have a fast way to get feedback between sessions.

The goal is to build a digital platform where clients receive personalized
AI-generated workout plans, Itai tracks their progress, and clients can ask an
AI virtual trainer for immediate help.

## Learning Goals

By completing this assignment, you will practice:

- Building a real product flow from business requirements.
- Designing a database schema for users, plans, logs, and messages.
- Implementing authentication and role-based access.
- Connecting a Next.js application to Supabase.
- Integrating an AI model safely and predictably.
- Supporting multiple languages and language-aware routes.
- Supporting light and dark frontend themes.
- Writing unit tests, integration tests, and end-to-end tests.
- Shipping the work in small, reviewable Git commits.

## Required Users

The application has two user roles.

### Client

A client can:

- Register and log in.
- Complete onboarding.
- Receive and view a personalized workout plan.
- Mark workouts as completed.
- Add notes after workouts.
- Ask the AI trainer questions.

### Trainer Admin

The trainer admin, Itai, can:

- View all clients.
- See each client's goal, plan, and progress.
- Review workout logs.
- Review AI chat history.
- Open WhatsApp to contact a client.
- Create, edit, and duplicate workout plan templates.

## Technical Baseline

Build the project using the current template conventions.

Relevant package versions:

- `next`: `16.1.7`
- `react`: `19.2.4`
- `next-intl`: `^4.13.0`
- `eslint-config-next`: `16.1.7`

This project uses Next.js 16 App Router conventions. Request interception and
locale routing must use root `proxy.ts`, not root `middleware.ts`.

Use `next-intl` for the locale routing layer and translation workflow. The
locale-aware route structure must work with the Next.js 16 `proxy.ts`
convention and must not rely on older middleware examples.

Treat localization and locale-aware routing as foundation work for the next
development phase. Add `next-intl`, locale-prefixed routes, translated message
files, and `proxy.ts` request handling before expanding the product feature
surface. Auth, navigation, forms, AI chat, admin pages, tests, and future
database-backed workflows must be built on top of this foundation instead of
being localized afterward.

## Global Requirements

These requirements apply to the entire application.

### Localization

The site must support two languages:

- English, using the `en-US` locale.
- Hebrew, using the `he-IL` locale.

All user-facing text must be translatable. Do not hard-code text in a way that
prevents translation later.

The URL structure must be language aware. Use a consistent locale prefix for
every page, such as:

```text
https://example.com/en/login
https://example.com/he/login
```

Use the route prefixes `en` and `he`, while the application locale values map
internally to `en-US` and `he-IL`.

Required behavior:

- Users can switch between English and Hebrew.
- Navigation keeps the user in the selected language.
- Authentication pages are also language aware.
- Missing or unsupported locale routes must redirect to a default language.
- Hebrew pages must use right-to-left layout.

### Theme Support

The frontend must support both light and dark themes.

Required behavior:

- Users can switch between light and dark mode.
- The selected theme must persist across page refreshes.
- All pages must remain readable and usable in both themes.
- Form fields, cards, navigation, charts, and AI chat messages must have
  accessible contrast in both themes.

### Responsive Design

The application must work well on desktop and mobile.

Test all of these responsive breakpoints:

- Mobile width around 390 px.
- Tablet width around 768 px.
- Desktop width above 1280 px.

### Authentication And Authorization

Use Supabase Auth for registration and login.

Required behavior:

- Clients can register and log in.
- The trainer admin has access to admin pages.
- Regular clients cannot access trainer admin pages.
- Signed-out users are redirected to the localized login page.
- Auth-related error messages are localized.

## Feature Requirements

### Homepage

Create a homepage that explains the product and invites clients to join.

The homepage must include:

- A short explanation of the smart fitness platform.
- A call to action for new clients.
- A login link for existing users.
- Language-aware navigation.
- Theme toggle support.

Required routes:

```text
/en
/he
```

### Login And Registration

Build localized login and registration pages using Supabase Auth.

Required routes:

```text
/en/login
/he/login
/en/register
/he/register
```

After registration:

1. The user must receive a confirmation email if email confirmation is
   enabled in Supabase.
2. The user must be able to log in after confirming the account.
3. The user must appear in the Supabase Authentication dashboard.

The trainer admin role must be assignable manually in the database and through
an admin setup flow.

### Smart Client Onboarding

Build a multi-step onboarding flow for new clients.

The onboarding form must collect:

- Full name.
- Age or age range.
- Training goal.
- Current fitness level.
- Physical limitations or injuries.
- Available workout days.
- Preferred workout location, such as home, gym, or outdoors.
- Available equipment.
- Notes or preferences.

Required routes:

```text
/en/join
/he/join
```

At the end of onboarding, show a clear button:

```text
Create my workout plan
```

When submitted:

- Save the client profile in Supabase.
- Trigger the AI workout plan generator.
- Save the generated plan in Supabase.
- Show a success message in the selected language.

### AI Workout Plan Generator

Generate a personalized workout plan from the onboarding data.

The generated plan must include:

- 3-5 workouts per week, based on client availability.
- Workout names.
- Exercise names.
- Sets.
- Repetitions or duration.
- Rest times.
- Execution instructions.
- Rest days.
- Safety notes for limitations or injuries.

The AI response must be saved as structured data, not only as free text. Use a
predictable shape such as JSON with workouts, exercises, and notes.

The client must be able to access the plan later without regenerating it.

### My Plan Page

Build a client page that displays the current workout plan.

Required routes:

```text
/en/my-plan
/he/my-plan
```

The page must include:

- A weekly calendar view.
- A weekly list view.
- Workout details when the user opens a workout.
- Exercise instructions.
- A button to mark a workout as completed.
- A short feedback form after completing a workout.
- Workout notes.

The completion action must save a workout log in Supabase.

### AI Virtual Trainer Chat

Build a chat page where clients can ask workout-related questions.

Required routes:

```text
/en/chat
/he/chat
```

The AI chat must answer questions using client context:

- The client's goal.
- The client's fitness level.
- The current workout plan.
- Known limitations or injuries.

Example questions:

- "How do I do sit-ups correctly?"
- "I have knee pain. What alternative exercise can I do?"
- "Can I move today's workout to tomorrow?"

The conversation history must be saved in Supabase so the trainer can review
it from the admin dashboard.

### Trainer Admin Area

Build a trainer admin area for Itai.

Required routes:

```text
/en/trainer
/he/trainer
```

The admin area must include the following sections.

#### Client List

Show all clients with:

- Name.
- Goal.
- Join date.
- Current plan status.
- Workout completion percentage for the current month.
- A visual activity indicator.

Use activity colors:

- Green: trains regularly.
- Yellow: partially consistent.
- Red: not training.

#### Client Dashboard

Clicking a client must open a detailed dashboard.

The dashboard must show:

- Client profile summary.
- Current workout plan.
- Completion percentage.
- Weekly progress chart.
- Monthly progress chart.
- Workout log.
- Workout notes.
- AI chat questions and answers.
- Button to open WhatsApp with the client.

#### Plan Management

Build a plan management area for reusable workout plans.

It must allow the trainer to:

- Create a plan manually.
- Create a plan with AI.
- Edit an existing plan.
- Duplicate a plan for another client.
- Save plan templates in a library.

## AI Requirements

Use an AI service to generate plans and answer client questions.

The AI integration must:

- Use server-side API calls only.
- Keep API keys out of the browser.
- Use environment variables for secrets.
- Request structured output for workout plan generation.
- Include client context when answering chat questions.
- Save AI outputs in Supabase.
- Handle loading states and errors clearly.

Safety requirements:

- The AI must not present itself as a doctor.
- The AI must recommend contacting a professional for pain, injury, or
  medical concerns.
- Plans must respect the client's stated limitations.
- If the AI cannot produce a valid plan, show a useful error message and do not
  save incomplete data.

## Required Data Model

Implement a schema that supports all required features and includes the
following entities and relationships.

Required entities:

- `profiles`: user profile, role, locale, and theme preference.
- `clients`: client onboarding details and trainer-facing metadata.
- `workout_plans`: generated and manually created plans.
- `workouts`: individual workouts inside a plan.
- `exercises`: exercises inside each workout.
- `workout_logs`: completed workouts, feedback, and notes.
- `chat_messages`: client and AI messages.
- `plan_templates`: reusable templates created by the trainer.

Required relationships:

- A profile belongs to one client record.
- A client has many workout plans.
- A workout plan has many workouts.
- A workout has many exercises.
- A client has many workout logs.
- A client has many chat messages.

Include timestamps such as `created_at`, `updated_at`, and `completed_at`.

## Development Milestones

### Step 0: Install The Template

Start from the provided project template.

Run the installation script for your operating system and choose:

- Project name.
- Target folder.
- Setup options requested by the script.

After the script finishes:

1. Open VS Code.
2. Open the generated project folder.
3. Open a new terminal inside VS Code.
4. Start the app:

```bash
npm run dev
```

1. Open the app in your browser:

```text
http://localhost:3000
```

You must see the template homepage.

### Step 1: Configure Supabase

In the Claude Code panel, run:

```text
/start-from-template
```

Follow the interactive setup flow.

When setup is complete:

- A Supabase project must be connected.
- Supabase MCP must be configured.
- The app must still run locally.
- Environment variables must be stored outside Git.

### Step 2: Plan The Application

Before implementing features, ask Claude Code to plan the application.

Include:

- The business case.
- The two user roles.
- Required pages.
- Required data entities.
- Localization requirements.
- Theme requirements.
- Testing requirements.

Ask Claude Code to produce a database plan before creating tables.

### Step 3: Build Authentication

Ask Claude Code to add Supabase login and registration.

Verify:

- Registration works.
- Login works.
- Logout works.
- Auth errors are localized.
- Admin routes are protected.
- Client routes require login.

### Step 4: Build Localization And Routing

Add language-aware routing as a foundation task for the next phase. Complete
this before adding or expanding major user-facing flows, so auth, navigation,
forms, AI chat, admin pages, and tests all share the same locale structure from
the start.

Use `next-intl` `^4.13.0` with the Next.js 16 App Router. Configure locale
request handling through root `proxy.ts`. Do not create a root `middleware.ts`
for this assignment unless the template explicitly requires a compatibility
shim.

Verify:

- `/en/login` shows the English login page.
- `/he/login` shows the Hebrew login page.
- Navigation keeps the selected language.
- Hebrew pages support right-to-left layout.
- Unknown locale routes redirect to the default language.
- Locale redirects and route matching are handled through `proxy.ts`.

### Step 5: Build Theme Support

Add light and dark theme support.

Verify:

- Theme toggle works.
- Theme choice persists.
- All main pages look correct in both themes.
- Components remain readable in both themes.

### Step 6: Build Smart Onboarding

Build the localized onboarding form and save client details to Supabase.

Verify:

- Required fields validate correctly.
- Data is saved in Supabase.
- Success and error messages are localized.
- The page works on mobile.

### Step 7: Build The AI Workout Generator

Generate and save personalized workout plans.

Verify:

- AI receives the correct client data.
- The response is structured.
- Invalid AI responses are handled safely.
- The saved plan can be loaded again.

### Step 8: Build The My Plan Page

Show the client's plan and allow workout completion tracking.

Verify:

- The plan loads from Supabase.
- Workout details are visible.
- Completed workouts create logs.
- Notes are saved.
- Progress updates correctly.

### Step 9: Build The AI Chat

Build the localized AI virtual trainer chat.

Verify:

- The AI receives client context.
- Messages are saved.
- Chat history loads after refresh.
- Error states are clear.
- The trainer can review the conversation.

### Step 10: Build The Trainer Admin Area

Build the admin dashboard, client list, and plan management pages.

Verify:

- Only admins can access trainer pages.
- Client progress is calculated correctly.
- Activity colors match completion behavior.
- The client dashboard shows logs and chat history.
- Plan templates can be created, edited, and duplicated.

### Step 11: Polish The UX

Improve the product experience.

Include:

- Clear navigation.
- Loading states.
- Empty states.
- Success messages.
- Error messages.
- Mobile layout.
- Accessible colors in light and dark mode.
- Consistent localized copy.

## Testing Requirements

Your project must include unit tests, integration tests, and end-to-end tests.

### Unit Tests

Unit tests must cover small pieces of logic without depending on the browser
or a real database.

Required coverage:

- Validation logic for onboarding.
- Locale parsing and locale redirects.
- Role and permission helpers.
- Theme preference helpers.
- Workout completion percentage calculation.
- AI response parsing and validation.

### Integration Tests

Integration tests must verify that application actions work across multiple
modules.

Required coverage:

- Registration and login action behavior.
- Creating and updating a client profile.
- Saving onboarding data.
- Saving a generated workout plan.
- Marking a workout as completed.
- Saving and loading chat messages.
- Admin authorization checks.

Mock external AI calls so tests are reliable.

### End-To-End Tests

End-to-end tests must verify the main user journeys in the browser.

Required flows:

- Client can register and log in.
- Client can complete onboarding.
- Client can view a generated plan.
- Client can mark a workout as completed.
- Client can ask a chat question.
- Admin can view the client list and client dashboard.
- Language-aware URLs work for English and Hebrew.
- Light and dark themes can be selected.

Use stable test data and avoid depending on real AI responses in end-to-end
tests.

## Git Requirements

Make commits as you complete working features.

Example commits:

```bash
git add .
git commit -m "Add localized authentication flow"
```

```bash
git add .
git commit -m "Add smart onboarding and client profile storage"
```

```bash
git add .
git commit -m "Add AI workout plan generation"
```

```bash
git add .
git commit -m "Add trainer admin dashboard"
```

Commits are checkpoints. If something breaks, you can compare against or return
to an earlier working version.

## Additional Required Features

The project must include the following additional features.

### Push Notifications

Send workout reminders through the browser.

### PDF Export

Export the workout plan as a PDF.

For PDF-specific help, install the React PDF skill from
[skills.sh React PDF](https://skills.sh/vercel-labs/json-render/react-pdf).

After installing a new skill, open a new Claude Code chat so the skill is
available.

### Trainer Notes

The app must allow Itai to write private notes about each client.

### Plan Regeneration

The app must allow a client and trainer to regenerate a plan when goals,
availability, or limitations change.

## Submission Checklist

Before submitting, verify the following.

Product:

- Homepage explains the platform.
- Authentication works.
- Client onboarding works.
- AI workout generation works.
- My Plan page displays saved plans.
- Workout completion tracking works.
- AI chat works.
- Trainer admin area works.
- Plan management works.
- Push notifications work.
- PDF export works.
- Trainer notes work.
- Plan regeneration works.

Localization:

- English pages work.
- Hebrew pages work.
- URLs are language aware.
- Navigation preserves the selected language.
- Hebrew layout supports right-to-left text.

Theme:

- Light theme works.
- Dark theme works.
- Theme preference persists.
- All important UI states are readable in both themes.

Testing:

- Unit tests are included.
- Integration tests are included.
- End-to-end tests are included.
- Tests cover localization and theme behavior.
- Tests cover the main client and admin flows.

Data And AI:

- Supabase stores client data.
- Supabase stores workout plans.
- Supabase stores workout logs.
- Supabase stores chat messages.
- AI keys are not exposed to the browser.
- AI errors are handled gracefully.

Final technical check:

- The app runs locally with `npm run dev`.
- The production build succeeds.
- There are no known blocking lint errors.
- Git commits were made along the way.
