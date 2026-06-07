# AI Processes

## AI Involvement Points

The current app uses AI in four product flows:

| Flow                            | Actor                    | AI purpose                                                                   |
| ------------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| Workout plan generation         | Client                   | Generate a personalized structured workout plan from onboarding data         |
| Virtual trainer chat            | Client                   | Answer workout-related questions using the client's profile and plan context |
| AI-assisted template creation   | Trainer admin            | Let Itai create reusable plan templates with AI from the plan manager        |
| Plan regeneration               | Client or trainer admin  | Regenerate a plan when goals, availability, limitations, or context changes  |

The AI must run server-side only, keep keys out of the browser, use
environment variables, save valid outputs in Supabase, request structured output
for plan-like data, include available client context in chat, and handle errors
clearly.

## Flow 1: AI Workout Plan Generation

This is the main AI flow.

```text
Client completes onboarding
  |
  v
Client clicks "Create my workout plan"
  |
  v
Server validates onboarding data
  |
  v
Server saves/updates client profile in Supabase
  |
  v
Server builds AI prompt from client data
  |
  v
AI generates structured workout plan
  |
  v
Server validates AI response shape
  |
  |-- valid ----> save active plan, workouts, exercises, source payload,
  |               and generation audit event in Supabase
  |
  |-- invalid --> keep saved profile, record failed generation event,
  |               save no partial plan, show localized pending/error state
  |
  v
Client is redirected to /en/my-plan or /he/my-plan only when plan generation succeeds
```

Input data sent to the AI:

```text
Training goal
Current fitness level
Age or age range
Physical limitations or injuries
Available workout days
Preferred workout location
Available equipment
Notes or preferences
Locale
```

Expected AI output:

```text
One workout session per available training day
1-7 validated workout sessions
Workout names
Exercise names
Sets
Repetitions or duration
Rest times
Execution instructions
Safety notes
```

Non-training days are implied by the client's available training days; the
current schema stores generated training sessions, not explicit rest-day rows.

The important architectural constraint is that the AI output must be structured
data, not just prose. The assignment explicitly expects a predictable shape such
as JSON with workouts, exercises, and notes.

Recommended persisted shape:

```text
workout_plans
  id
  client_id
  status = active
  locale
  source = ai
  source_payload
  created_at
  updated_at
  archived_at

workouts
  id
  plan_id
  day_of_week
  title
  focus
  position
  notes

exercises
  id
  workout_id
  name
  sets
  reps
  duration
  rest
  instructions
  safety_notes
  position

plan_generation_events
  id
  client_id
  plan_id
  triggered_by
  source = onboarding
  status = succeeded | failed
  reason
  created_at
```

## Flow 2: AI Virtual Trainer Chat

This flow is used after the client already has a profile and usually an active
plan.

```text
Client opens /en/chat or /he/chat
  |
  v
App loads client profile, active plan summary, recent logs, and chat history
  |
  v
Client submits a question
  |
  v
Server saves user message in Supabase
  |
  v
Server builds AI prompt with client context and replays persisted chat history
  |
  v
System prompt constrains scope and safety behavior
  |
  v
AI streams answer
  |
  v
Server saves non-empty AI answer in Supabase when the stream finishes
  |
  v
Client sees the answer in the chat UI
  |
  v
Trainer can later review the conversation from the trainer client dashboard
```

Context sent to the AI:

```text
Client goal
Fitness level
Active plan title/source summary
Known limitations or injuries
Recent workout logs
Relevant recent chat messages
Current locale
```

The implemented prompt sends a summary of the active plan row, not the full
workout and exercise tree. The trainer dashboard can still show the full current
plan from Supabase alongside the chat transcript.

Valid question types:

```text
Exercise technique
Exercise alternatives
Workout schedule changes
Plan clarification
Pain/injury-safe guidance with professional referral
```

The app saves chat history in Supabase so the trainer can review client
questions and AI answers from the trainer client dashboard.

Persisted shape:

```text
chat_messages
  id
  client_id
  role = user | assistant
  content
  created_at
```

## Flow 3: Trainer AI-Assisted Template Creation

The trainer admin can create reusable plan templates manually or with AI from
the plan-template manager. This is not a draft assigned directly to a client.

```text
Admin opens trainer plan-template manager
  |
  v
Admin selects "Create with AI"
  |
  v
Admin enters template title, locale, and optional goal, level, location,
and equipment context
  |
  v
Server builds a synthetic template-generation client context
  |
  v
Server sends structured plan-generation request to AI
  |
  v
AI returns structured template payload
  |
  v
Server validates structure
  |
  |-- valid ----> save plan_templates row immediately
  |
  |-- invalid --> save nothing and show localized error
  |
  v
Admin can later edit, duplicate, assign, or discard the template
```

When a template is assigned to a client, the assignment flow re-validates the
template against that client's limitations. If valid, it materializes a concrete
active plan, archives the previous active plan, and records a generation event
with `source = template`.

```text
AI output -> validated template -> trainer edit/reuse -> assign to client
```

This gives Itai control and avoids silently replacing a client's active plan at
template-creation time.

## Flow 4: Plan Regeneration

The assignment requires both the client and trainer to be able to regenerate a
plan when goals, availability, or limitations change.

```text
Client/trainer admin updates relevant client data
  |
  v
User clicks "Regenerate plan"
  |
  v
Server captures current client context
  |
  v
Server validates and records the regeneration reason
  |
  v
AI generates new structured plan from the latest client profile context
  |
  v
Server validates output
  |
  |-- valid ----> archive previous active plan
  |               save new active plan
  |               record succeeded generation event with reason
  |
  |-- invalid --> keep existing plan active
  |               record failed generation event with reason
  |               show localized error
  |
  v
Client/trainer admin sees new active plan
```

Regeneration should be versioned, not destructive.

```text
Previous plan: status = archived
New plan: status = active
```

This preserves history for progress tracking, logs, and trainer review.

The reason is part of the audit trail in `plan_generation_events`. The current
AI prompt uses the latest persisted client profile context; it does not include
the previous plan or free-text regeneration reason as model input.

## Safety Flow

Every AI call needs a safety gate.

```text
AI request built server-side
  |
  v
System instructions include safety constraints
  |
  v
AI response received
  |
  v
Validate:
  - JSON schema
  - required fields
  - workout count (1-7 sessions)
  - exercise fields
  - per-exercise safety notes when the client has limitations
  |
  v
Persist only valid output
```

Mandatory safety rules:

```text
AI must not present itself as a doctor
AI must recommend professional help for pain, injury, or medical concerns
Plans must respect stated limitations
Invalid plans must not be saved
Errors must be useful and localized
```

For plan generation and template assignment, these rules are enforced through
the system prompt, Zod schema validation, and the additional safety-note rule
for clients with limitations. For chat, the safety boundary is enforced through
the server-side system prompt and persisted transcript handling rather than a
structured post-generation schema.

## Backend Architecture Flow

With this stack, the AI should sit behind Server Actions or Route Handlers.

```text
Browser UI
  |
  v
Server Action / Route Handler
  |
  v
Auth + role check
  |
  v
Supabase read: client/profile/plan/context
  |
  v
AI SDK / Vercel AI Gateway / Claude
  |
  v
Schema validation for plan-like output
  |
  v
Supabase write: plan/chat/template/audit output
  |
  v
Localized response to UI
```

Never call AI directly from client components.

```text
Wrong:
Client Component -> AI provider

Correct:
Client Component -> Server Action/Route Handler -> AI provider
```

## End-To-End AI Data Flow

```text
Supabase Auth user
  |
  v
profiles
  |
  v
clients
  |
  v
onboarding data
  |
  v
AI plan generator
  |
  v
workout_plans -> workouts -> exercises -> plan_generation_events
  |
  v
my-plan page
  |
  v
workout_logs
  |
  v
AI chat uses:
  profile + active plan summary + limitations + recent logs + chat history
  |
  v
chat_messages
  |
  v
trainer dashboard review
```

## Required Tests Around AI

| Test type   | Required coverage                                    |
| ----------- | ---------------------------------------------------- |
| Unit        | AI response parsing and validation                   |
| Unit        | Onboarding validation before AI call                 |
| Integration | Saving generated workout plan                        |
| Integration | Saving and loading chat messages                     |
| Integration | Admin authorization before AI/admin operations       |
| E2E         | Client completes onboarding and views generated plan |
| E2E         | Client asks a chat question                          |
| E2E         | Admin reviews chat history                           |

External AI calls should be mocked in tests so the test suite is deterministic
and does not depend on real Claude responses. The assignment explicitly requires
mocking external AI calls for reliable tests and avoiding real AI dependencies
in E2E tests.
