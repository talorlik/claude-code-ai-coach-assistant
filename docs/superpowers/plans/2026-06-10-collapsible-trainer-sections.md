# Collapsible Trainer Client-Detail Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make seven heavy sections on the trainer client-detail page collapsible, collapsed by default, with a rotating-chevron affordance and per-section `localStorage` persistence.

**Architecture:** A single route-local `CollapsibleSection` client component wraps the existing Base UI `components/ui/collapsible.tsx`. It owns the card shell, a title-as-trigger header with a `ChevronDown` that rotates when open, an optional subtitle, an optional header-action slot, and SSR-safe `localStorage` persistence. Each of the seven sections drops its own card shell + `<h2>` and renders its body as `CollapsibleSection` children.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Base UI (`@base-ui/react/collapsible`), Tailwind CSS 4, lucide-react, next-intl, Vitest + Testing Library, Playwright.

---

## Background facts (verified against the codebase)

- The Base UI Collapsible trigger carries `data-panel-open` when open and sets `aria-expanded`. Tailwind selector `group-data-[panel-open]:rotate-180` on the trigger rotates a child chevron. (Confirmed in `node_modules/@base-ui/react/collapsible/trigger/CollapsibleTriggerDataAttributes.js`.)
- `components/ui/collapsible.tsx` already exports `Collapsible` (Root), `CollapsibleTrigger`, `CollapsibleContent` (Panel). `Collapsible` accepts controlled props `open` / `onOpenChange` and uncontrolled `defaultOpen` (Base UI Root API).
- The seven target sections currently each render `<section className="rounded-lg border bg-card p-4 text-card-foreground">` with an `<h2 className="text-lg font-medium">{title}</h2>`.
- Sections and their current locations:
  - `client-dashboard.tsx`: `PlanDetail`, `ChatTranscript`.
  - `plan-editor.tsx`: `PlanEditor` (header has title **and** an "Add workout" `<Button>`).
  - `progress-charts.tsx`: `ProgressCharts` (two charts in a grid; the outer component has no card shell of its own — each chart has its own `ChartCard` `<section>`).
  - `trainer-notes-panel.tsx`: `TrainerNotesPanel` (header has title **and** a subtitle `<p>`).
  - `page.tsx`: the "Training details" `<section>` and the "History" `<section>` (each has a header with title + subtitle).
- Tests that will break when sections start collapsed:
  - `__tests__/unit/trainer-client-dashboard.test.tsx` — plan-detail inner-content assertions.
  - `e2e/trainer-dashboard.spec.ts` — the add-note test and the plan-detail-workout visibility test.

## File structure

- **Create:** `app/[locale]/trainer/clients/[clientId]/collapsible-section.tsx` — the reusable wrapper. One responsibility: card shell + collapsible trigger/panel + persistence.
- **Create:** `__tests__/unit/collapsible-section.test.tsx` — unit tests for the wrapper.
- **Modify:** `app/[locale]/trainer/clients/[clientId]/client-dashboard.tsx` — wrap `PlanDetail` and `ChatTranscript`; wrap the rendered `<ProgressCharts>` in the parent.
- **Modify:** `app/[locale]/trainer/clients/[clientId]/plan-editor.tsx` — drop shell/header, use wrapper with a header-action slot for "Add workout".
- **Modify:** `app/[locale]/trainer/clients/[clientId]/trainer-notes-panel.tsx` — drop shell/header, use wrapper with subtitle.
- **Modify:** `app/[locale]/trainer/clients/[clientId]/page.tsx` — wrap "Training details" and "History" sections.
- **Modify:** `messages/en-US.json`, `messages/he-IL.json` — add `TrainerDashboard.charts.title`.
- **Modify:** `__tests__/unit/trainer-client-dashboard.test.tsx` — expand sections before asserting inner content.
- **Modify:** `e2e/trainer-dashboard.spec.ts` — expand the relevant sections before interacting.
- **Create:** `e2e/collapsible-sections.spec.ts` — persistence e2e (skips without seeded client).

## Verification gate

`npm run lint && npm run typecheck && npm run build && npm run test`. Use nvm Node v22.16.0 (`nvm use 22.16.0`) for all npm test/build commands — the shell default Node 18 breaks Vitest/rolldown. e2e (`npm run test:e2e`) only runs the new persistence spec meaningfully when `E2E_CLIENT_ID` is set; it is otherwise skipped.

---

### Task 1: Add the `TrainerDashboard.charts.title` message key

**Files:**
- Modify: `messages/en-US.json`
- Modify: `messages/he-IL.json`

- [ ] **Step 1: Add the English key**

In `messages/en-US.json`, inside the `TrainerDashboard.charts` object, add a `title` key as the first entry. The block currently begins:

```json
"charts": {
  "weeklyTitle": "Weekly activity",
```

Change to:

```json
"charts": {
  "title": "Activity",
  "weeklyTitle": "Weekly activity",
```

- [ ] **Step 2: Add the Hebrew key**

In `messages/he-IL.json`, inside `TrainerDashboard.charts`, add the matching key as the first entry. Use the Hebrew word for "Activity":

```json
"charts": {
  "title": "פעילות",
  ... existing keys unchanged ...
```

(Place `"title"` first; keep every existing key and value unchanged.)

- [ ] **Step 3: Verify JSON parses**

Run: `nvm use 22.16.0 && node -e "require('./messages/en-US.json');require('./messages/he-IL.json');console.log('ok')"`
Expected: prints `ok` (no JSON syntax error).

- [ ] **Step 4: Commit**

```bash
git add messages/en-US.json messages/he-IL.json
git commit -m "feat(i18n): add TrainerDashboard.charts.title for collapsible activity section"
```

---

### Task 2: Create the `CollapsibleSection` wrapper (test first)

**Files:**
- Create: `__tests__/unit/collapsible-section.test.tsx`
- Create: `app/[locale]/trainer/clients/[clientId]/collapsible-section.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/collapsible-section.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { CollapsibleSection } from "@/app/[locale]/trainer/clients/[clientId]/collapsible-section"

const KEY = "trainer-section:test"

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  window.localStorage.clear()
})

describe("CollapsibleSection", () => {
  it("renders collapsed by default: title visible, body not", () => {
    render(
      <CollapsibleSection title="Plan detail" storageKey={KEY}>
        <p>inner body content</p>
      </CollapsibleSection>
    )
    expect(
      screen.getByRole("heading", { level: 2, name: "Plan detail" })
    ).toBeInTheDocument()
    const trigger = screen.getByRole("button", { name: /plan detail/i })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("inner body content")).not.toBeInTheDocument()
  })

  it("expands when the trigger is clicked", async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleSection title="Plan detail" storageKey={KEY}>
        <p>inner body content</p>
      </CollapsibleSection>
    )
    await user.click(screen.getByRole("button", { name: /plan detail/i }))
    expect(
      screen.getByRole("button", { name: /plan detail/i })
    ).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("inner body content")).toBeInTheDocument()
  })

  it("opens on mount when localStorage has the section flagged open", async () => {
    window.localStorage.setItem(KEY, "1")
    render(
      <CollapsibleSection title="Plan detail" storageKey={KEY}>
        <p>inner body content</p>
      </CollapsibleSection>
    )
    // Reconciliation happens in a mount effect; the content appears after it.
    expect(await screen.findByText("inner body content")).toBeInTheDocument()
  })

  it("persists the open state to localStorage when toggled", async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleSection title="Plan detail" storageKey={KEY}>
        <p>inner body content</p>
      </CollapsibleSection>
    )
    await user.click(screen.getByRole("button", { name: /plan detail/i }))
    expect(window.localStorage.getItem(KEY)).toBe("1")
    await user.click(screen.getByRole("button", { name: /plan detail/i }))
    expect(window.localStorage.getItem(KEY)).toBe("0")
  })

  it("renders an optional subtitle and header action inside the panel", async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleSection
        title="Notes"
        storageKey={KEY}
        subtitle="Only you can see these"
        headerAction={<button type="button">Add</button>}
      >
        <p>body</p>
      </CollapsibleSection>
    )
    await user.click(screen.getByRole("button", { name: /^notes$/i }))
    const region = screen.getByText("body").closest("section") as HTMLElement
    expect(
      within(region).getByText("Only you can see these")
    ).toBeInTheDocument()
    expect(
      within(region).getByRole("button", { name: "Add" })
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `nvm use 22.16.0 && npx vitest run __tests__/unit/collapsible-section.test.tsx`
Expected: FAIL — cannot resolve `collapsible-section` (module does not exist yet).

- [ ] **Step 3: Implement `CollapsibleSection`**

Create `app/[locale]/trainer/clients/[clientId]/collapsible-section.tsx`:

```tsx
"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

/**
 * Props for {@link CollapsibleSection}.
 */
export interface CollapsibleSectionProps {
  /** Visible section heading; also the accessible name of the trigger button. */
  title: string
  /**
   * Stable `localStorage` key for this section's open/closed state, e.g.
   * `"trainer-section:plan-detail"`. The stored value is `"1"` (open) or
   * `"0"` (closed); any missing/other value means closed.
   */
  storageKey: string
  /** The section body, revealed when the section is expanded. */
  children: ReactNode
  /** Optional muted subtitle rendered above the body when expanded. */
  subtitle?: ReactNode
  /**
   * Optional action (e.g. a button) rendered in the header, to the side of the
   * title. It sits OUTSIDE the trigger button so it stays independently
   * clickable (no nested interactive elements).
   */
  headerAction?: ReactNode
  /** Forwarded to the trigger button for e2e/unit selection. */
  "data-testid"?: string
}

/**
 * A collapsible card section for the trainer client-detail page. Renders the
 * shared card shell with a header whose title doubles as the expand/collapse
 * trigger: a full-width button showing the title and a `ChevronDown` that
 * rotates 180 degrees when open. The body and optional subtitle live in the
 * collapsible panel and are hidden when collapsed.
 *
 * State is collapsed by default and persisted per `storageKey` in
 * `localStorage`. To avoid an SSR/hydration mismatch the first client paint is
 * always collapsed; a mount effect then reads `localStorage` and opens the
 * section if it was previously left open. All storage access is guarded, so a
 * storage failure degrades to in-memory (collapsed) state.
 *
 * The header is a flex row (title at the start, chevron/action at the end), so
 * it mirrors correctly under RTL with no extra work.
 */
export function CollapsibleSection({
  title,
  storageKey,
  children,
  subtitle,
  headerAction,
  "data-testid": dataTestId,
}: CollapsibleSectionProps) {
  // Collapsed on first paint (server can't read localStorage); reconciled below.
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === "1") {
        setOpen(true)
      }
    } catch {
      // Storage unavailable (private mode/quota): keep the in-memory default.
    }
  }, [storageKey])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    try {
      window.localStorage.setItem(storageKey, next ? "1" : "0")
    } catch {
      // Storage write failed: state still lives in memory for this session.
    }
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className="rounded-lg border bg-card text-card-foreground"
    >
      <div className="flex items-center gap-2 p-4">
        <CollapsibleTrigger
          data-testid={dataTestId}
          className={cn(
            "group flex flex-1 items-center justify-between gap-2 text-start",
            "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <h2 className="text-lg font-medium">{title}</h2>
          <ChevronDown
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <CollapsibleContent>
        <div className="px-4 pb-4">
          {subtitle ? (
            <p className="mb-3 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `nvm use 22.16.0 && npx vitest run __tests__/unit/collapsible-section.test.tsx`
Expected: PASS — all five cases green.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/trainer/clients/[clientId]/collapsible-section.tsx __tests__/unit/collapsible-section.test.tsx
git commit -m "feat(trainer): add CollapsibleSection wrapper with persisted state"
```

---

### Task 3: Wrap `PlanDetail` and `ChatTranscript` in `client-dashboard.tsx`

**Files:**
- Modify: `app/[locale]/trainer/clients/[clientId]/client-dashboard.tsx`

The wrapper owns the card shell and the `<h2>`, so each function drops its own `<section ...>` wrapper and `<h2>` and returns the inner content wrapped by `CollapsibleSection`. Both the populated and the empty-state branches move inside.

- [ ] **Step 1: Import the wrapper**

Add to the imports at the top of `client-dashboard.tsx` (after the existing local imports, e.g. below the `PlanEditor` import line):

```tsx
import { CollapsibleSection } from "./collapsible-section"
```

- [ ] **Step 2: Rewrite `PlanDetail`**

Replace the entire `PlanDetail` function body's two `return` shapes. The function currently returns a `<section>` for the empty case and a `<section>` for the populated case. Replace both so the section content is the wrapper's children:

Empty branch — replace:

```tsx
    return (
      <section className="rounded-lg border bg-card p-4 text-card-foreground">
        <h2 className="mb-2 text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </section>
    )
```

with:

```tsx
    return (
      <CollapsibleSection
        title={t("title")}
        storageKey="trainer-section:plan-detail"
        data-testid="section-plan-detail"
      >
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </CollapsibleSection>
    )
```

Populated branch — replace:

```tsx
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="mb-3 text-lg font-medium">{t("title")}</h2>
      <ol className="flex flex-col gap-4">
```

with:

```tsx
  return (
    <CollapsibleSection
      title={t("title")}
      storageKey="trainer-section:plan-detail"
      data-testid="section-plan-detail"
    >
      <ol className="flex flex-col gap-4">
```

and replace the matching closing of that branch:

```tsx
      </ol>
    </section>
  )
}
```

with:

```tsx
      </ol>
    </CollapsibleSection>
  )
}
```

(Only the `PlanDetail` closing `</ol></section>` — the next function is `Detail`.)

- [ ] **Step 3: Rewrite `ChatTranscript`**

Empty branch — replace:

```tsx
    return (
      <section className="rounded-lg border bg-card p-4 text-card-foreground">
        <h2 className="mb-2 text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </section>
    )
```

with:

```tsx
    return (
      <CollapsibleSection
        title={t("title")}
        storageKey="trainer-section:ai-chat"
        data-testid="section-ai-chat"
      >
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </CollapsibleSection>
    )
```

Populated branch — replace:

```tsx
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="mb-3 text-lg font-medium">{t("title")}</h2>
      <ul className="flex flex-col gap-3">
```

with:

```tsx
  return (
    <CollapsibleSection
      title={t("title")}
      storageKey="trainer-section:ai-chat"
      data-testid="section-ai-chat"
    >
      <ul className="flex flex-col gap-3">
```

and replace its closing:

```tsx
      </ul>
    </section>
  )
}
```

with:

```tsx
      </ul>
    </CollapsibleSection>
  )
}
```

(This is the `ChatTranscript` closing — it is the last function in the file.)

- [ ] **Step 4: Typecheck**

Run: `nvm use 22.16.0 && npm run typecheck`
Expected: PASS (no new errors). `PlanDetail`/`ChatTranscript` no longer reference `<section>`.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/trainer/clients/[clientId]/client-dashboard.tsx
git commit -m "feat(trainer): collapse plan-detail and AI-chat sections"
```

---

### Task 4: Wrap the activity charts (single "Activity" section)

**Files:**
- Modify: `app/[locale]/trainer/clients/[clientId]/client-dashboard.tsx`

`ProgressCharts` itself has no outer card shell (each chart is its own `ChartCard`). Rather than edit `progress-charts.tsx`, wrap the rendered element where the dashboard composes it, using the new `charts.title` key. The dashboard's `t` is the `TrainerDashboard` namespace, so `t("charts.title")` resolves.

- [ ] **Step 1: Wrap the `<ProgressCharts>` usage**

In `ClientDashboard` (the top-level component), replace:

```tsx
      <ProgressCharts weekly={data.weekly} monthly={data.monthly} />
```

with:

```tsx
      <CollapsibleSection
        title={t("charts.title")}
        storageKey="trainer-section:activity"
        data-testid="section-activity"
      >
        <ProgressCharts weekly={data.weekly} monthly={data.monthly} />
      </CollapsibleSection>
```

- [ ] **Step 2: Typecheck**

Run: `nvm use 22.16.0 && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/trainer/clients/[clientId]/client-dashboard.tsx
git commit -m "feat(trainer): collapse weekly/monthly activity into one section"
```

---

### Task 5: Wrap `PlanEditor` (header action: "Add workout")

**Files:**
- Modify: `app/[locale]/trainer/clients/[clientId]/plan-editor.tsx`

The editor's header has the title and an "Add workout" `<Button>`. The button moves to the wrapper's `headerAction` slot (kept outside the trigger), and the rest of the body becomes children.

- [ ] **Step 1: Import the wrapper**

Add near the other local imports at the top of `plan-editor.tsx`:

```tsx
import { CollapsibleSection } from "./collapsible-section"
```

- [ ] **Step 2: Replace the `<section>`/header opening**

Replace:

```tsx
  return (
    <section
      className="rounded-lg border bg-card p-4 text-card-foreground"
      data-testid="plan-editor"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addNewWorkout}
          disabled={pending}
          data-testid="add-workout"
        >
          <Plus className="size-4" />
          {t("addWorkout")}
        </Button>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">{t("intro")}</p>
```

with:

```tsx
  return (
    <CollapsibleSection
      title={t("title")}
      storageKey="trainer-section:edit-live-plan"
      data-testid="section-edit-live-plan"
      subtitle={t("intro")}
      headerAction={
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addNewWorkout}
          disabled={pending}
          data-testid="add-workout"
        >
          <Plus className="size-4" />
          {t("addWorkout")}
        </Button>
      }
    >
```

(The `data-testid="plan-editor"` is removed from the shell; the section is now identified by `section-edit-live-plan`. The `intro` paragraph becomes the wrapper `subtitle`.)

- [ ] **Step 3: Replace the closing `</section>`**

Find the closing of the editor's root element (the `</section>` that matches the opening replaced above — it is the final returned element of the component). Replace that single `</section>` with:

```tsx
    </CollapsibleSection>
```

- [ ] **Step 4: Typecheck**

Run: `nvm use 22.16.0 && npm run typecheck`
Expected: PASS. If `Plus` or `Button` were only used here they are still used (inside `headerAction`), so no unused-import error.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/trainer/clients/[clientId]/plan-editor.tsx
git commit -m "feat(trainer): collapse the live-plan editor section"
```

---

### Task 6: Wrap `TrainerNotesPanel` (with subtitle)

**Files:**
- Modify: `app/[locale]/trainer/clients/[clientId]/trainer-notes-panel.tsx`

- [ ] **Step 1: Import the wrapper**

Add near the other local imports at the top of `trainer-notes-panel.tsx`:

```tsx
import { CollapsibleSection } from "./collapsible-section"
```

- [ ] **Step 2: Replace the `<section>`/header opening**

Replace:

```tsx
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground">
      <header className="mb-3 flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
```

with:

```tsx
  return (
    <CollapsibleSection
      title={t("title")}
      storageKey="trainer-section:private-notes"
      data-testid="section-private-notes"
      subtitle={t("subtitle")}
    >
```

- [ ] **Step 3: Replace the closing `</section>`**

Find the component's final returned closing `</section>` and replace that single line with:

```tsx
    </CollapsibleSection>
```

- [ ] **Step 4: Typecheck**

Run: `nvm use 22.16.0 && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/trainer/clients/[clientId]/trainer-notes-panel.tsx
git commit -m "feat(trainer): collapse the private-notes section"
```

---

### Task 7: Wrap "Training details" and "History" in `page.tsx`

**Files:**
- Modify: `app/[locale]/trainer/clients/[clientId]/page.tsx`

These two are server-rendered `<section>`s in the page. `CollapsibleSection` is a client component; importing and rendering it from a server component is allowed (it becomes a client boundary). The section body (`<ClientOnboardingEditor>`, `<OnboardingHistory>`) is passed as children.

- [ ] **Step 1: Import the wrapper**

Add to the imports in `page.tsx` (with the other local route imports):

```tsx
import { CollapsibleSection } from "./collapsible-section"
```

- [ ] **Step 2: Wrap "Training details"**

Replace:

```tsx
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-medium">
            {tAccount("onboardingTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tAccount("onboardingDescription")}
          </p>
        </header>
        <ClientOnboardingEditor
          clientId={clientId}
          defaults={onboardingDefaults}
        />
      </section>
```

with:

```tsx
      <div className="mx-auto w-full max-w-5xl px-4">
        <CollapsibleSection
          title={tAccount("onboardingTitle")}
          storageKey="trainer-section:training-details"
          data-testid="section-training-details"
          subtitle={tAccount("onboardingDescription")}
        >
          <ClientOnboardingEditor
            clientId={clientId}
            defaults={onboardingDefaults}
          />
        </CollapsibleSection>
      </div>
```

- [ ] **Step 3: Wrap "History"**

Replace:

```tsx
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-medium">{tAccount("historyTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {tAccount("historyDescription")}
          </p>
        </header>
        <OnboardingHistory snapshots={snapshots} />
      </section>
```

with:

```tsx
      <div className="mx-auto w-full max-w-5xl px-4">
        <CollapsibleSection
          title={tAccount("historyTitle")}
          storageKey="trainer-section:history"
          data-testid="section-history"
          subtitle={tAccount("historyDescription")}
        >
          <OnboardingHistory snapshots={snapshots} />
        </CollapsibleSection>
      </div>
```

- [ ] **Step 4: Typecheck + build**

Run: `nvm use 22.16.0 && npm run typecheck && npm run build`
Expected: PASS (the build confirms the server/client boundary is valid).

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/trainer/clients/[clientId]/page.tsx
git commit -m "feat(trainer): collapse training-details and history sections"
```

---

### Task 8: Update the trainer-dashboard unit test (expand before asserting)

**Files:**
- Modify: `__tests__/unit/trainer-client-dashboard.test.tsx`

The plan-detail section now starts collapsed, so the inner-content assertions must first expand it. The section heading (level-2) is now the trigger button, so the `getByRole("heading", { level: 2, name: pd.title })` assertions still pass unchanged; only the inner-content reads need a click. Add `userEvent` and a helper.

- [ ] **Step 1: Add the userEvent import**

At the top of the test file, add:

```tsx
import userEvent from "@testing-library/user-event"
```

- [ ] **Step 2: Add a clear of localStorage between tests**

The existing import line is exactly `import { describe, expect, it, vi } from "vitest"`. Change it to add `beforeEach`:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest"
```

Then, after the imports / before the first `describe`, add:

```tsx
beforeEach(() => {
  window.localStorage.clear()
})
```

- [ ] **Step 3: Expand plan detail in the "renders every workout and exercise field (en)" test**

In that test, immediately after `renderDashboard("en")`, add a click to expand the plan-detail section before the inner-content assertions:

```tsx
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", {
        name: enMessages.TrainerDashboard.planDetail.title,
      })
    )
```

Make the test callback `async`: change `it("renders every workout and exercise field (en)", () => {` to `it("renders every workout and exercise field (en)", async () => {`.

The `getByRole("heading", { level: 2, name: pd.title })` assertion stays — the trigger contains the `<h2>`. The `Upper body` / `Bench press` / exercise-field assertions now run against expanded content.

- [ ] **Step 4: Expand plan detail in the "/he" test**

Change `it("renders the plan detail under /he (RTL catalog)", () => {` to `async () => {`, and after `renderDashboard("he")` add:

```tsx
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", {
        name: heMessages.TrainerDashboard.planDetail.title,
      })
    )
```

- [ ] **Step 5: Fix the empty-state test**

The "shows the empty state and hides the PDF button with no active plan" test asserts the plan-detail empty copy, which is now collapsed. Change its callback to `async`, and expand before the empty-copy assertion:

```tsx
  it("shows the empty state and hides the PDF button with no active plan", async () => {
    renderDashboard("en", { planWorkouts: null, pdfHref: null })
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", {
        name: enMessages.TrainerDashboard.planDetail.title,
      })
    )
    expect(
      screen.getByText(enMessages.TrainerDashboard.planDetail.empty)
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId("trainer-export-plan-pdf")
    ).not.toBeInTheDocument()
  })
```

(The PDF button lives in the always-expanded plan-summary card, so `queryByTestId` remains valid without expanding anything else.)

- [ ] **Step 6: Run the unit test**

Run: `nvm use 22.16.0 && npx vitest run __tests__/unit/trainer-client-dashboard.test.tsx`
Expected: PASS — all cases green.

- [ ] **Step 7: Commit**

```bash
git add __tests__/unit/trainer-client-dashboard.test.tsx
git commit -m "test(trainer): expand plan-detail section before asserting content"
```

---

### Task 9: Update the trainer-dashboard e2e + add a persistence spec

**Files:**
- Modify: `e2e/trainer-dashboard.spec.ts`
- Create: `e2e/collapsible-sections.spec.ts`

- [ ] **Step 1: Expand private notes before the add-note flow**

In `e2e/trainer-dashboard.spec.ts`, in the "an admin can open a client dashboard and add a private note" test, after the URL assertion and before locating the textarea, expand the private-notes section:

```tsx
    // The notes section starts collapsed; expand it before interacting.
    await page.getByTestId("section-private-notes").click()
```

(Place this immediately before `const noteText = ...` / the `textarea` lookup.)

- [ ] **Step 2: Expand plan detail before the plan-detail assertion**

In the "an admin sees the plan detail and a PDF export control" test, before the `plan-detail-workout` assertion, expand the section:

```tsx
    // Plan detail starts collapsed; expand it to reveal the workout blocks.
    await page.getByTestId("section-plan-detail").click()

    await expect(
      page.getByTestId("plan-detail-workout").first()
    ).toBeVisible({ timeout: 15_000 })
```

The PDF link and push-status assertions stay unchanged — both live in always-expanded cards.

- [ ] **Step 3: Create the persistence spec**

Create `e2e/collapsible-sections.spec.ts`:

```tsx
import { test, expect } from "@playwright/test"

import { adminCredentials, loginAsAdmin } from "./helpers/auth"

/**
 * Verifies the trainer client-detail collapsible sections: they start
 * collapsed, expand on click, and the open state survives a reload
 * (localStorage persistence). Requires a seeded admin and client id; skips
 * otherwise, matching the other auth-dependent specs.
 */
test.describe("trainer dashboard collapsible sections (admin)", () => {
  const clientId = process.env.E2E_CLIENT_ID

  test.skip(
    !adminCredentials.email || !adminCredentials.password || !clientId,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD / E2E_CLIENT_ID not set"
  )

  test("plan-detail section is collapsed by default, expands, and persists", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto(`/en/trainer/clients/${clientId}`)
    await expect(page).toHaveURL(new RegExp(`/en/trainer/clients/${clientId}`))

    const trigger = page.getByTestId("section-plan-detail")
    await expect(trigger).toBeVisible()

    // Collapsed by default: inner workout blocks are not rendered.
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(page.getByTestId("plan-detail-workout")).toHaveCount(0)

    // Expands on click.
    await trigger.click()
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(
      page.getByTestId("plan-detail-workout").first()
    ).toBeVisible({ timeout: 15_000 })

    // The open state survives a reload (localStorage persistence).
    await page.reload()
    const triggerAfter = page.getByTestId("section-plan-detail")
    await expect(triggerAfter).toHaveAttribute("aria-expanded", "true", {
      timeout: 15_000,
    })
  })
})
```

- [ ] **Step 4: Run e2e (skips without seeded data) to confirm it loads**

Run: `nvm use 22.16.0 && npx playwright test e2e/collapsible-sections.spec.ts e2e/trainer-dashboard.spec.ts --list`
Expected: lists the tests with no syntax/type error. (Full run requires `E2E_CLIENT_ID`; the guest tests in `trainer-dashboard.spec.ts` still run.)

- [ ] **Step 5: Commit**

```bash
git add e2e/trainer-dashboard.spec.ts e2e/collapsible-sections.spec.ts
git commit -m "test(trainer): e2e for collapsible sections + expand before interacting"
```

---

### Task 10: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Lint, typecheck, build, unit tests**

Run: `nvm use 22.16.0 && npm run lint && npm run typecheck && npm run build && npm run test`
Expected: all PASS. No NEW lint errors versus baseline (pre-existing scaffold lint errors, if any, are not introduced by this change).

- [ ] **Step 2: Manual smoke (dev server)**

Run: `nvm use 22.16.0 && npm run dev`
Open `/en/trainer/clients/<a real client id>`. Confirm:
- Plan detail, Edit live plan, Activity, AI trainer chat, Private notes, Training details, History each render as a card with a title and a down-chevron, all collapsed.
- Profile, Current plan, Workout reminders, Workout log remain fully visible (not collapsible).
- Clicking a section title expands it and rotates the chevron; clicking again collapses it.
- Expand a couple of sections, reload: they stay expanded. Collapse them, reload: they stay collapsed.
- Switch to `/he/...`: the chevron sits on the correct (left) side under RTL and titles render in Hebrew; "Activity" shows the Hebrew label.

- [ ] **Step 3: Final commit (if the smoke required any tweak)**

If everything passed with no change, nothing to commit. Otherwise commit the fix with an appropriate `fix(trainer): ...` message.

---

## Self-review notes

- **Spec coverage:** seven sections wrapped (Tasks 3-7); persistence + SSR-safe default + guarded storage (Task 2); single Activity section + new key (Tasks 1, 4); chevron-rotate affordance via `data-panel-open` (Task 2); tests updated/added (Tasks 8-9); verification gate (Task 10). Always-expanded sections untouched (no task modifies Profile/Plan summary/Push/Workout log).
- **Type consistency:** the wrapper's prop names (`title`, `storageKey`, `subtitle`, `headerAction`, `data-testid`) are used identically across Tasks 3-7. Storage keys match the spec's namespaced list exactly.
- **Accessibility:** action buttons (`Add workout`) and the subtitle are kept OUTSIDE the trigger button (Task 2 structure + Task 5 `headerAction`), avoiding nested interactive elements.
