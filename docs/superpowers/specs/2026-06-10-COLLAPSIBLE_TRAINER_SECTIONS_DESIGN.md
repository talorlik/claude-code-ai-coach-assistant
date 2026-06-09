# Collapsible Trainer Client-Detail Sections

## Problem

The trainer client-detail page
(`/[locale]/trainer/clients/[clientId]`) stacks every section vertically as
always-expanded cards: profile, current plan, push status, plan detail, live
plan editor, activity charts, workout log, AI chat, private notes, training
details, and history. With a full plan, a long chat transcript, and history,
the page is very long and hard to scan. The trainer wants the heavy sections
collapsed by default and expandable on demand.

## Goal

Make a defined set of sections collapsible, collapsed by default, with an
obvious expand/collapse affordance. Each section's open/closed state persists
per-section across reloads.

## Scope

### Sections that become collapsible

| Visible title (en) | Component | Source file |
| --- | --- | --- |
| Plan detail | `PlanDetail` | `client-dashboard.tsx` |
| Edit live plan | `PlanEditor` | `plan-editor.tsx` |
| Activity (weekly + monthly) | `ProgressCharts` | `progress-charts.tsx` |
| AI trainer chat | `ChatTranscript` | `client-dashboard.tsx` |
| Private notes | `TrainerNotesPanel` | `trainer-notes-panel.tsx` |
| Training details | onboarding-editor section | `page.tsx` |
| History | onboarding-history section | `page.tsx` |

The user listed "Weekly activity / Monthly activity" as a single item; both
charts share one component and are wrapped as one collapsible "Activity"
section (decision confirmed during brainstorming).

### Sections left always-expanded (out of scope)

Profile, Current plan, Workout reminders (push status), and Workout log. These
are short summary cards the user did not list; they stay as-is.

## Decisions (from brainstorming)

1. **Per-section persistence.** Each section's open/closed state is stored in
   `localStorage` under a stable key, so a trainer's expanded sections stay
   open after reload. Default (no stored value) is collapsed.
2. **Single "Activity" collapsible** wrapping both charts, not two.
3. **One route-local wrapper component** owns the card chrome, the trigger, and
   the persistence, rather than editing collapse logic into each of the seven
   sections inline.
4. **Chevron-rotate affordance:** a single `ChevronDown` that rotates 180° when
   open (not the accordion's two-chevron swap).

## Architecture

### New component: `CollapsibleSection`

A `"use client"` component added to the route folder
(`app/[locale]/trainer/clients/[clientId]/collapsible-section.tsx`). It is
route-specific composition, not a generic UI primitive, so it lives with the
route rather than in `components/ui/`. It composes the existing Base UI
primitive `components/ui/collapsible.tsx`
(`Collapsible` / `CollapsibleTrigger` / `CollapsibleContent`).

Responsibilities:

- **Card chrome.** Renders the shared shell
  `rounded-lg border bg-card text-card-foreground` that every section currently
  repeats. The trigger header and the content live inside this one card, so
  each call site stops repeating the shell.
- **Header as trigger.** The section title renders as a full-width
  `CollapsibleTrigger` button: title text on the start side, a `ChevronDown`
  (lucide) on the end side. The chevron is `aria-hidden` (decorative); Base UI
  sets `aria-expanded` and handles keyboard, focus ring, and panel wiring. The
  chevron rotates via `group-data-[panel-open]:rotate-180`
  with `transition-transform`. The trigger title keeps the existing
  `text-lg font-medium` heading weight and renders inside an `<h2>` so the
  document outline is preserved.
- **Persistence with SSR safety.** Props include `storageKey: string`. To avoid
  a hydration mismatch (the server cannot read `localStorage`), the component
  initialises `open = false` for the first paint, then in a mount `useEffect`
  reads `localStorage[storageKey]` and, if it is `"1"`, opens the section. An
  `onOpenChange` handler writes `"1"` / `"0"` back to `localStorage`. Reads and
  writes are wrapped in try/catch so a storage exception (private mode, quota)
  degrades to in-memory state rather than throwing.

Props:

```text
title: string            // visible section heading, becomes the trigger label
storageKey: string       // localStorage key, e.g. "trainer-section:plan-detail"
children: React.ReactNode // the section body (the existing inner content)
"data-testid"?: string   // forwarded to the trigger for e2e/unit selection
```

### Content extraction per section

Each of the seven sections currently renders its own
`<section className="rounded-lg border ...">` with an `<h2>` title and a body.
The refactor moves the **body** into `CollapsibleSection`'s children and the
**title** into the `title` prop; the outer `<section>` shell and the inline
`<h2>` are removed from each call site (the wrapper now owns both).

Empty-state branches (e.g. `PlanDetail` with no workouts, `ChatTranscript` with
no messages, the charts' per-chart empty label) are preserved: they move inside
the collapsible content unchanged. A collapsed empty section still shows its
title and chevron; expanding it reveals the existing localized empty copy.

### Storage keys

Stable, namespaced, one per section. Keys are independent of `clientId` so a
trainer's layout preference is consistent across every client they view
(opening "Plan detail" for one client opens it by default for the next). Keys:

```text
trainer-section:plan-detail
trainer-section:edit-live-plan
trainer-section:activity
trainer-section:ai-chat
trainer-section:private-notes
trainer-section:training-details
trainer-section:history
```

## Localization

No new message keys are required for the mechanism. Each collapsible reuses the
title string the section already renders:

- `client-dashboard.tsx` sections pass the existing
  `TrainerDashboard.planDetail.title` and `TrainerDashboard.chat.title`.
- `plan-editor.tsx` passes its existing `PlanEditor` title.
- `progress-charts.tsx`: the two charts already have
  `charts.weeklyTitle` / `charts.monthlyTitle`; the new single "Activity"
  wrapper needs one new key `TrainerDashboard.charts.title` ("Activity" /
  Hebrew equivalent) for the section header, added to both `en-US.json` and
  `he-IL.json`. The two inner chart `<h3>` subtitles stay.
- `trainer-notes-panel.tsx` passes its existing `TrainerDashboard.notes.title`.
- `page.tsx` passes the existing `AccountOnboarding.onboardingTitle`
  (Training details) and `AccountOnboarding.historyTitle` (History).

The chevron is decorative and needs no label; `aria-expanded` on the Base UI
trigger conveys state to assistive tech. RTL: the trigger is a flex row with
title at start and chevron at end, so it mirrors correctly under Hebrew with no
extra work.

## Error handling

- `localStorage` access is guarded with try/catch; failure falls back to
  in-memory open state (default collapsed). No user-facing error.
- First-paint-collapsed-then-reconcile avoids hydration warnings. A section the
  trainer left open shows a one-frame collapsed-to-open transition on reload;
  acceptable and consistent with how persisted-disclosure UIs behave.

## Testing

- **Unit (Vitest + jsdom):** render `CollapsibleSection`; assert (a) collapsed
  by default - content not in the accessible tree / panel closed; (b) clicking
  the trigger opens it and `aria-expanded` flips; (c) a pre-seeded
  `localStorage[storageKey] = "1"` opens the section after mount; (d) toggling
  writes the expected value back to `localStorage`.
- **Existing tests:** any test that asserts a wrapped section's content is
  immediately visible must now expand it first (collapsed default). Audit the
  trainer-dashboard unit/e2e tests and update selectors to click the
  `data-testid` trigger before asserting on inner content.
- **e2e (Playwright):** one spec on the trainer client page verifying a section
  starts collapsed, expands on click, and stays expanded after reload (proving
  persistence).

## Verification gate

`npm run lint && npm run typecheck && npm run build`, plus `npm run test` for
the new/updated unit tests and `npm run test:e2e` for the persistence e2e.

## Non-goals

- No change to the four always-expanded summary sections.
- No "expand all / collapse all" control.
- No accordion (multiple sections stay independently open; this is not a
  single-open accordion).
- No server-side persistence of layout preference.
