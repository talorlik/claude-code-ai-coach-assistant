# Admin Capabilities

The admin is Itai, the trainer. The admin area exists so he can monitor
clients, review progress, manage plans, and intervene when needed. The required
localized admin routes are:

```text
/en/trainer
/he/trainer
```

Only users with the trainer admin role can access these pages. Regular clients
must be blocked, and signed-out users must be redirected to the localized login
page.

After an admin logs in, the app must redirect them to the localized admin page.
That page should work as the admin landing hub and provide clear links to the
other admin capabilities, such as clients/users, plans, templates, analytics,
notes, and settings.

## Table of Contents

- [1. View All Clients](#1-view-all-clients)
- [2. Open a Client Dashboard](#2-open-a-client-dashboard)
- [3. Review Client Profile and Onboarding Data](#3-review-client-profile-and-onboarding-data)
- [4. Review Workout Plans](#4-review-workout-plans)
- [5. Review Workout Logs](#5-review-workout-logs)
- [6. Review Progress Analytics](#6-review-progress-analytics)
- [7. Review AI Chat History](#7-review-ai-chat-history)
- [8. Contact a Client Through WhatsApp](#8-contact-a-client-through-whatsapp)
- [9. Manage Reusable Workout Plans](#9-manage-reusable-workout-plans)
- [10. Write Private Trainer Notes](#10-write-private-trainer-notes)
- [11. Regenerate Workout Plans](#11-regenerate-workout-plans)
- [12. Export or Access Workout Plan PDF Functionality](#12-export-or-access-workout-plan-pdf-functionality)
- [13. Monitor Push-Notification Readiness](#13-monitor-push-notification-readiness)
- [14. Use Localized and Theme-Compatible Admin UI](#14-use-localized-and-theme-compatible-admin-ui)
- [15. Admin-Specific Security Rules](#15-admin-specific-security-rules)
- [Consolidated Admin Checklist](#consolidated-admin-checklist)

## 1. View All Clients

The admin should be able to open a client list that shows every
registered/onboarded client.

Each client row should show:

| Field                         | Purpose                                           |
| ----------------------------- | ------------------------------------------------- |
| Name                          | Identify the client                               |
| Goal                          | Understand the client's main training objective   |
| Join date                     | Track how long the client has been active         |
| Current plan status           | See whether the client has an active workout plan |
| Monthly completion percentage | Measure current-month adherence                   |
| Visual activity indicator     | Quickly classify consistency                      |

Activity colors must be:

| Color  | Meaning              |
| ------ | -------------------- |
| Green  | Trains regularly     |
| Yellow | Partially consistent |
| Red    | Not training         |

This is the operational overview screen for Itai.

## 2. Open a Client Dashboard

The admin should be able to click a client and open a detailed client
dashboard.

The dashboard must show:

```text
Client profile summary
Current workout plan
Completion percentage
Weekly progress chart
Monthly progress chart
Workout log
Workout notes
AI chat questions and answers
WhatsApp contact button
```

This view gives Itai the complete state of one client: profile, goal, plan,
consistency, feedback, and AI interaction history.

## 3. Review Client Profile and Onboarding Data

The admin should be able to inspect the client's onboarding information:

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

This data is required because plans must respect client availability, equipment,
fitness level, and limitations.

## 4. Review Workout Plans

The admin should be able to view each client's current workout plan.

The plan should expose:

```text
Weekly structure
Workout names
Exercise names
Sets
Repetitions or duration
Rest times
Execution instructions
Rest days
Safety notes
```

The admin must be able to evaluate whether the generated or manually assigned
plan fits the client.

## 5. Review Workout Logs

The admin should be able to review completed workouts.

Workout logs should include:

```text
Completed workout
Completion timestamp
Client feedback
Client notes
Related workout plan/workout
```

This supports the core business requirement: Itai needs to know who trains
consistently and who does not.

## 6. Review Progress Analytics

The admin should be able to see calculated progress indicators.

Required analytics:

```text
Current completion percentage
Weekly progress chart
Monthly progress chart
Current-month completion percentage
Activity status color
```

The admin area must calculate client progress correctly, and the activity colors
must match completion behavior.

## 7. Review AI Chat History

The admin should be able to read the client's AI trainer conversations.

This includes:

```text
Client questions
AI answers
Timestamps
Client context used for the chat
```

The assignment explicitly requires conversation history to be saved in Supabase
so the trainer can review it from the admin dashboard.

## 8. Contact a Client Through WhatsApp

The admin should be able to open WhatsApp from the client dashboard.

This should likely use the client's stored phone number or contact metadata and
open a WhatsApp URL/action from the dashboard. The assignment requires a "Button
to open WhatsApp with the client."

## 9. Manage Reusable Workout Plans

The admin should have a plan management area.

Required plan management actions:

| Action                            | Description                                         |
| --------------------------------- | --------------------------------------------------- |
| Create plan manually              | Build a workout plan without AI                     |
| Create plan with AI               | Generate a plan from client or template context     |
| Edit existing plan                | Modify workouts, exercises, sets, reps, rest, notes |
| Duplicate plan for another client | Copy an existing plan and assign/adapt it           |
| Save templates                    | Store reusable plan templates in a library          |

The required data model includes `plan_templates`, which are reusable templates
created by the trainer.

## 10. Write Private Trainer Notes

The admin should be able to write private notes about each client.

These notes are for Itai only and should not be visible to the client.

Examples:

```text
Client prefers shorter sessions
Watch shoulder mobility
Usually misses Sunday workouts
Progressing well with bodyweight exercises
Needs follow-up about knee discomfort
```

The assignment explicitly requires trainer notes as an additional feature.

## 11. Regenerate Workout Plans

The admin should be able to regenerate a client's plan when something changes.

Regeneration triggers:

```text
Client goal changed
Available workout days changed
Physical limitation changed
Injury/medical concern added
Equipment availability changed
Trainer decides plan needs adjustment
```

The assignment requires both the client and trainer to be able to regenerate a
plan when goals, availability, or limitations change.

## 12. Export or Access Workout Plan PDF Functionality

The assignment requires PDF export for workout plans. For the admin, this should
mean he can export or access a client's workout plan as a PDF, especially from
the client dashboard or plan management area.

## 13. Monitor Push-Notification Readiness

The assignment requires browser workout reminders. The admin does not explicitly
need to send reminders manually, but the admin-facing product should expose
enough status to support the feature, such as whether a client has reminders
enabled, disabled, or unavailable. This is an implementation-derived admin
capability from the required push-notification feature.

## 14. Use Localized and Theme-Compatible Admin UI

The admin pages must obey the same global requirements as the rest of the app:

```text
English and Hebrew support
/en and /he route prefixes
RTL layout for Hebrew
Language-aware navigation
Light/dark theme support
Readable charts, cards, forms, and messages in both themes
Responsive layout for mobile, tablet, and desktop
```

The assignment makes localization, theme support, and responsive design global
requirements across the application.

## 15. Admin-Specific Security Rules

Admin capabilities must be protected by role-based access control.

Required behavior:

| Actor               | Expected behavior                          |
| ------------------- | ------------------------------------------ |
| Signed-out user     | Redirect to localized login                |
| Regular client      | Cannot access trainer admin pages          |
| Trainer admin       | Can access `/en/trainer` and `/he/trainer` |
| Browser client code | Must not receive secret AI/API keys        |
| Database access     | Must respect Supabase RLS and role checks  |

The admin role should be assignable manually in the database or through a
protected admin setup flow, not through public self-selection.

## Consolidated Admin Checklist

```text
Redirect admin users to the admin page after login
Use the admin page as a landing hub for admin capability links
View all clients
View each client's goal, plan, and progress
Review client onboarding/profile details
Review current workout plans
Review workout logs
Review workout notes
Review AI chat history
View weekly and monthly progress charts
See monthly completion percentage
See activity status: green/yellow/red
Open WhatsApp with a client
Create workout plans manually
Create workout plans with AI
Edit workout plans
Duplicate workout plans for another client
Save reusable plan templates
Write private trainer notes
Regenerate plans when client data changes
Access/export workout plans as PDF
Work in English and Hebrew
Support Hebrew RTL layout
Use light and dark themes
Use responsive admin UI
Block non-admin access
Run admin authorization tests
```
