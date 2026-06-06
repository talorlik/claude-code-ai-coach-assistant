# Multi-Select Main Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the onboarding "Main goal" single-select into a checkbox-based multi-select with an info tooltip, and make the backend accept and persist multiple goals.

**Architecture:** The `clients.goal text` column becomes `clients.goals text[]` (backfilled, old column dropped), mirroring the existing `available_days`/`equipment` array pattern. The validator, mappers, domain types, and server action carry `goals: Goal[]` end to end. Four read sites (AI plan prompt, chat context, two trainer views) join the array for display. The form swaps the native `<select>` for a Popover-backed checkbox list and adds an `Info` tooltip beside the label.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres + RLS), next-intl, Base UI (`Popover`, `Tooltip`, `Checkbox`), lucide-react, Vitest, Playwright.

> **Working directory:** all paths are relative to the worktree root
> `/Users/talo/www/claude-code-ai-coach-assistant/.claude/worktrees/feature+multi-select-goals`.
> Run every command from there. Do NOT operate in the primary checkout.

---

### Task 1: Validation accepts a goals array

**Files:**
- Modify: `lib/validation/onboarding.ts`
- Test: `__tests__/unit/onboarding-validation.test.ts`

- [ ] **Step 1: Update the validation test fixture and add goals cases**

In `__tests__/unit/onboarding-validation.test.ts`, the shared `valid()` helper currently sets `goal: "build_muscle"`. Replace that key with `goals: ["build_muscle"]`. Then replace the existing single-goal assertions/cases (around lines 39, 52, 58) and add the new array cases:

```typescript
it("accepts a single goal", () => {
  const result = validateOnboarding(valid({ goals: ["build_muscle"] }))
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.data.goals).toEqual(["build_muscle"])
})

it("accepts multiple goals", () => {
  const result = validateOnboarding(
    valid({ goals: ["lose_weight", "build_muscle"] })
  )
  expect(result.ok).toBe(true)
  if (result.ok)
    expect(result.data.goals).toEqual(["lose_weight", "build_muscle"])
})

it("requires at least one goal", () => {
  const result = validateOnboarding(valid({ goals: [] }))
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.fieldErrors?.goals).toBe("required")
})

it("rejects an unknown goal", () => {
  const result = validateOnboarding(valid({ goals: ["become_a_wizard"] }))
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.fieldErrors?.goals).toBe("invalid")
})

it("rejects duplicate goals", () => {
  const result = validateOnboarding(
    valid({ goals: ["build_muscle", "build_muscle"] })
  )
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.fieldErrors?.goals).toBe("invalid")
})
```

If the `valid()` helper or assertions reference `result.data.goal` anywhere else in the file, change them to `goals`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- onboarding-validation`
Expected: FAIL — `goals` does not exist on the input/validated types; assertions on `fieldErrors.goals` miss.

- [ ] **Step 3: Update the validator**

In `lib/validation/onboarding.ts`:

Change the `OnboardingInput` field (currently `goal?: string | null`) to:

```typescript
  goals?: string[]
```

Change the `ValidatedOnboarding` field (currently `goal: Goal`) to:

```typescript
  goals: Goal[]
```

Replace the single-goal validation block (currently the `let goal: Goal | null = null` ... `else { fieldErrors.goal = "invalid" }` block) with an array check that mirrors the `availableDays` block:

```typescript
  const rawGoals = input.goals ?? []
  let goals: Goal[] = []
  if (rawGoals.length === 0) {
    fieldErrors.goals = "required"
  } else if (
    rawGoals.some((g) => !isMember(GOALS, g)) ||
    new Set(rawGoals).size !== rawGoals.length
  ) {
    fieldErrors.goals = "invalid"
  } else {
    goals = rawGoals as Goal[]
  }
```

In the success `ok({...})` return, replace `goal: goal!,` with `goals,`.

Update the function's TSDoc rule line for goal: replace
`- \`goal\` and \`fitnessLevel\` are required and must be known values.`
with
`- \`fitnessLevel\` is required and must be a known value.`
and add
`- \`goals\` must contain at least one known goal; unknown or duplicate goals are rejected.`

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- onboarding-validation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validation/onboarding.ts __tests__/unit/onboarding-validation.test.ts
git commit -m "feat(validation): accept a goals array in onboarding"
```

---

### Task 2: Mappers and domain types carry goals

**Files:**
- Modify: `lib/db/types.ts:35`
- Modify: `lib/db/mappers.ts`
- Test: `__tests__/unit/db-mappers.test.ts`

- [ ] **Step 1: Update the mapper test**

In `__tests__/unit/db-mappers.test.ts`, find the cases that use `goal` (around lines 35-36, 54, 74). Replace the scalar with the array form:

```typescript
it("maps goals to the goals column", () => {
  const row = toClientUpsertRow({ userId: "user-1", goals: ["strength"] })
  expect(row).toEqual({ user_id: "user-1", goals: ["strength"] })
})
```

In any `fromClientRow` round-trip fixtures in this file that set `goal: "strength"` on the row, change them to `goals: ["strength"]`, and change assertions reading `.goal` to `.goals` expecting `["strength"]`. For the row fixture, also ensure the `ClientRow` shape uses `goals`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- db-mappers`
Expected: FAIL — `goals` not recognized on `ClientUpsertInput`/`Client`; `toClientUpsertRow` still emits `goal`.

- [ ] **Step 3: Update `lib/db/types.ts`**

Change the `ClientRow` goal field (currently `goal: string | null`) to:

```typescript
  goals: string[] | null
```

- [ ] **Step 4: Update `lib/db/mappers.ts`**

In `ClientUpsertInput`, change `goal?: string | null` to:

```typescript
  goals?: string[]
```

In `toClientUpsertRow`, replace the line `if (input.goal !== undefined) row.goal = input.goal` with:

```typescript
  if (input.goals !== undefined) row.goals = input.goals
```

In the `Client` interface, change `goal: string | null` to:

```typescript
  goals: string[]
```

In `fromClientRow`, replace `goal: row.goal,` with:

```typescript
    goals: row.goals ?? [],
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- db-mappers`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/db/types.ts lib/db/mappers.ts __tests__/unit/db-mappers.test.ts
git commit -m "feat(db): carry goals array through client mappers and types"
```

---

### Task 3: Server action passes goals through

**Files:**
- Modify: `lib/onboarding/onboarding-actions.ts:89`

- [ ] **Step 1: Update the action**

In `lib/onboarding/onboarding-actions.ts`, inside the `upsertClient({...})` call, replace `goal: data.goal,` with:

```typescript
      goals: data.goals,
```

(No new test here — Task 2 covers the mapper and the integration tests in Task 6 cover the action end to end. This is a one-line type-driven change; `npm run typecheck` in Task 8 is its gate.)

- [ ] **Step 2: Commit**

```bash
git add lib/onboarding/onboarding-actions.ts
git commit -m "feat(onboarding): persist goals array from the save action"
```

---

### Task 4: AI prompt and chat context render the goals list

**Files:**
- Modify: `lib/ai/prompts.ts:79`
- Modify: `lib/ai/chat-context.ts:88`
- Test: `__tests__/unit/ai-prompts.test.ts`
- Test: `__tests__/unit/chat-context.test.ts`

- [ ] **Step 1: Update both test fixtures and assertions**

In `__tests__/unit/ai-prompts.test.ts`, change the client fixture `goal: "build_muscle"` to `goals: ["build_muscle", "lose_weight"]`. Add/adjust an assertion that the prompt contains the joined list:

```typescript
expect(prompt).toContain("Goal: build_muscle, lose_weight")
```

In `__tests__/unit/chat-context.test.ts`, change the `client()` fixture `goal: "build_muscle"` to `goals: ["build_muscle"]`, and update any assertion referencing the goal line to expect the joined value (`Goal: build_muscle`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- ai-prompts chat-context`
Expected: FAIL — fixtures set `goals` but the builders still read `client.goal`; the joined-list assertions miss.

- [ ] **Step 3: Update `lib/ai/prompts.ts`**

Replace `` `- Goal: ${client.goal ?? "general_fitness"}`, `` with:

```typescript
    `- Goal: ${list(client.goals, "general_fitness")}`,
```

(The `list(values, emptyLabel)` helper already exists at the top of this file.)

- [ ] **Step 4: Update `lib/ai/chat-context.ts`**

Replace `` `- Goal: ${client.goal ?? "general_fitness"}`, `` with:

```typescript
    `- Goal: ${client.goals.length > 0 ? client.goals.join(", ") : "general_fitness"}`,
```

(This file has no shared `list` helper, so the join is inlined to match its surrounding style.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- ai-prompts chat-context`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/prompts.ts lib/ai/chat-context.ts __tests__/unit/ai-prompts.test.ts __tests__/unit/chat-context.test.ts
git commit -m "feat(ai): render the goals list in plan prompt and chat context"
```

---

### Task 5: Trainer views display the goals list

**Files:**
- Modify: `app/[locale]/trainer/trainer-clients.tsx`
- Modify: `app/[locale]/trainer/clients/[clientId]/page.tsx:127`
- Modify: `app/[locale]/trainer/page.tsx:84`

- [ ] **Step 1: Update the trainer client list**

In `app/[locale]/trainer/trainer-clients.tsx`:

Change the row type field (currently `goal: string | null`, around line 30) to:

```typescript
  goals: string[]
```

Change `goalLabel` (currently `const goalLabel = (goal: string | null) => goal ?? t("noGoal")`, around line 65) to:

```typescript
  const goalLabel = (goals: string[]) =>
    goals.length > 0 ? goals.join(", ") : t("noGoal")
```

Update the two call sites (around lines 97 and 152) from `goalLabel(row.goal)` to:

```typescript
{goalLabel(row.goals)}
```

- [ ] **Step 2: Update the trainer list page mapping**

In `app/[locale]/trainer/page.tsx` (around line 84), replace `goal: client.goal,` with:

```typescript
        goals: client.goals,
```

- [ ] **Step 3: Update the client detail page**

In `app/[locale]/trainer/clients/[clientId]/page.tsx` (around line 127), replace `{ labelKey: "goal", value: client.goal },` with a joined value matching the `availableDays` field's pattern in the same array:

```typescript
    {
      labelKey: "goal",
      value: client.goals.length ? client.goals.join(", ") : null,
    },
```

- [ ] **Step 4: Verify types compile**

Run: `npm run typecheck`
Expected: PASS (no errors in the three trainer files). If `app/[locale]/trainer/clients/[clientId]/client-dashboard.tsx` references a `goal` profile key, it keys off `labelKey: "goal"` (the i18n label key), which is unchanged — confirm no `.goal` property access remains there.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/trainer/trainer-clients.tsx" "app/[locale]/trainer/page.tsx" "app/[locale]/trainer/clients/[clientId]/page.tsx"
git commit -m "feat(trainer): display the client goals list"
```

---

### Task 6: Database migration

**Files:**
- Create: `supabase/migrations/0003_client_goals_array.sql`
- Modify: `__tests__/integration/db-clients.test.ts`
- Modify: `__tests__/integration/onboarding-plan-generation.test.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_client_goals_array.sql`:

```sql
-- Replace the single-choice clients.goal with a multi-select goals text[].
-- Mirrors the existing available_days / equipment array columns. RLS on
-- public.clients is row-scoped and column-agnostic, so no policy changes.

alter table public.clients
  add column goals text[] not null default '{}';

-- Backfill: lift each existing single goal into a one-element array.
update public.clients
  set goals = array[goal]
  where goal is not null and goal <> '';

alter table public.clients
  drop column goal;
```

- [ ] **Step 2: Update integration fixtures that set `goal`**

In `__tests__/integration/db-clients.test.ts` (around line 75) and `__tests__/integration/onboarding-plan-generation.test.ts` (around line 71), change `goal: "strength"` / `goal: "build_muscle"` to the array form (`goals: ["strength"]` / `goals: ["build_muscle"]`). Search both files for any other `goal:` client fixture keys or `.goal` assertions and convert them to `goals`.

Also search the remaining integration tests for client fixtures with `goal:` and convert them:

```bash
grep -rn "goal:" __tests__/integration/ | grep -v "goals:"
```

Convert each client-row/`Client` fixture hit to `goals: [...]`. (The trainer template/plan `goal` free-text field is unrelated — leave `goal:` keys that belong to `aiForm`/template inputs untouched; those live in `plans-manager`/`template-actions` fixtures, not `Client` fixtures.)

- [ ] **Step 3: Apply the migration to the local/remote Supabase project**

This project uses the Supabase MCP. Apply via `mcp__supabase__apply_migration` with name `client_goals_array` and the SQL body above. If a local CLI stack is in use instead, run `supabase db reset` or `supabase migration up`. Confirm with `mcp__supabase__list_tables` that `clients.goals` exists (`text[]`, not null) and `clients.goal` is gone.

- [ ] **Step 4: Regenerate Supabase types if the project tracks generated types**

```bash
grep -rl "Database\b" lib/ | head
```

If a generated `database.types.ts` (or similar) exists and is imported, regenerate it via `mcp__supabase__generate_typescript_types` and write the result over that file. If no generated types file is tracked (the project hand-maintains `lib/db/types.ts`), skip this step — Task 2 already updated `ClientRow`.

- [ ] **Step 5: Run the integration tests**

Run: `npm run test -- integration`
Expected: PASS (fixtures now use `goals`; the action persists `goals`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_client_goals_array.sql __tests__/integration/
git commit -m "feat(db): migrate clients.goal to a goals text[] column"
```

---

### Task 7: Onboarding form multi-select with info tooltip

**Files:**
- Modify: `messages/en-US.json`
- Modify: `messages/he-IL.json`
- Modify: `app/[locale]/join/onboarding-form.tsx`
- Modify: `app/[locale]/join/page.tsx:51`
- Test: `__tests__/unit/onboarding-form-redirect.test.tsx`

- [ ] **Step 1: Update the message catalogs**

In `messages/en-US.json`, under `Onboarding`:

- Rename `errors.goal` to `errors.goals` (keep the same object: `{"required": "Choose your main goal.", "invalid": "Choose a valid goal."}`). Reword to plural: `{"required": "Choose at least one goal.", "invalid": "Choose valid goals."}`.
- Add to `hints`: `"goal": "You can choose more than one goal."`.
- Add to `fields` (if not present) a placeholder key used by the popover trigger; reuse the existing `options.unselected` ("Select...") — no new key needed.

In `messages/he-IL.json`, under `Onboarding`:

- Rename `errors.goal` to `errors.goals` with Hebrew plural copy: `{"required": "בחרו לפחות מטרה אחת.", "invalid": "בחרו מטרות תקינות."}`.
- Add to `hints`: `"goal": "ניתן לבחור יותר ממטרה אחת."`.

- [ ] **Step 2: Update the form-redirect test fixture**

In `__tests__/unit/onboarding-form-redirect.test.tsx` (around line 41), change the defaults fixture `goal: "muscle"` to `goals: ["build_muscle"]`. If the test asserts on a `goal` select, update it to the popover (see Step 5 trigger text) or leave the assertion on the redirect behavior unchanged if it does not touch goal.

- [ ] **Step 3: Run the form test to verify the current state**

Run: `npm run test -- onboarding-form-redirect`
Expected: FAIL to compile — `OnboardingDefaults` still has `goal: string`, fixture now sets `goals`.

- [ ] **Step 4: Update `OnboardingDefaults`, imports, and submit payload**

In `app/[locale]/join/onboarding-form.tsx`:

Add `Info` to the lucide import:

```typescript
import { CheckCircle2, Info, TriangleAlert } from "lucide-react"
```

Add the Popover and Tooltip imports:

```typescript
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
```

In `OnboardingDefaults`, change `goal: string` to:

```typescript
  goals: string[]
```

In `EMPTY_DEFAULTS`, change `goal: ""` to:

```typescript
  goals: [],
```

In `onSubmit`'s `saveOnboarding({...})` payload, change `goal: values.goal,` to:

```typescript
        goals: values.goals,
```

In `stepOfFirstError`'s `stepByField` map, change `goal: 1,` to:

```typescript
    goals: 1,
```

- [ ] **Step 5: Replace the goal NativeSelect with a Popover checkbox list**

In `StepTraining`, replace the entire goal `<Field>...<NativeSelect>...</NativeSelect></Field>` block (the first field, for `t("fields.goal")`) with a Popover-backed multi-select. The `Field` component is extended in Step 6 to accept `labelAdornment`:

```tsx
      <Field
        label={t("fields.goal")}
        error={fieldError("goals")}
        labelAdornment={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={t("hints.goal")}
                    className="inline-flex text-muted-foreground"
                  />
                }
              >
                <Info className="size-4" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{t("hints.goal")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      >
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
              />
            }
          >
            <span
              className={
                values.goals.length === 0 ? "text-muted-foreground" : undefined
              }
            >
              {values.goals.length === 0
                ? t("options.unselected")
                : values.goals.map((g) => t(`options.goal.${g}`)).join(", ")}
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--anchor-width)">
            <div className="flex flex-col gap-2">
              {GOALS.map((g) => (
                <CheckboxRow
                  key={g}
                  label={t(`options.goal.${g}`)}
                  checked={values.goals.includes(g)}
                  onToggle={() => set("goals", toggle(values.goals, g))}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </Field>
```

> If Base UI's `Trigger`/`TooltipTrigger` does not accept a `render` prop in this version, fall back to wrapping the child directly (`<PopoverTrigger asChild>`/plain children) — check `components/ui/popover.tsx` usage elsewhere in the repo with `grep -rn "PopoverTrigger" app/ components/`. Match whatever pattern existing call sites use. If no existing call site exists, render the trigger as its default `<button>` child:
>
> ```tsx
> <PopoverTrigger className="...">{label}</PopoverTrigger>
> ```

- [ ] **Step 6: Extend the `Field` component with a label adornment slot**

In the `Field` function, add the optional prop and render it beside the label:

```tsx
function Field({
  label,
  hint,
  error,
  labelAdornment,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  labelAdornment?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {labelAdornment}
      </div>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 7: Update the prefill page**

In `app/[locale]/join/page.tsx` (around line 51), change `goal: existing.goal ?? "",` to:

```typescript
        goals: existing.goals ?? [],
```

- [ ] **Step 8: Run the form test and typecheck**

Run: `npm run test -- onboarding-form-redirect && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add "app/[locale]/join/onboarding-form.tsx" "app/[locale]/join/page.tsx" messages/en-US.json messages/he-IL.json __tests__/unit/onboarding-form-redirect.test.tsx
git commit -m "feat(onboarding): multi-select goals with info tooltip"
```

---

### Task 8: Update the e2e onboarding flow

**Files:**
- Modify: `e2e/onboarding.spec.ts:64-70`

- [ ] **Step 1: Replace the native goal select interaction**

In `e2e/onboarding.spec.ts`, replace the goal line (`await page.locator('select[name="goal"]').selectOption("build_muscle")`) and its comment with a popover-driven selection. The trigger shows "Select..." then opens the checkbox list; click the "Build muscle" / Hebrew label:

```typescript
  // Step 2: goal (multi-select popover), level + location (native selects).
  await page.getByRole("button", { name: /select|בחר/i }).first().click()
  await page.getByText(/^(build muscle|בניית שריר)$/i).click()
  // Close the popover by pressing Escape before touching the next control.
  await page.keyboard.press("Escape")
  await page
    .locator('select[name="fitnessLevel"]')
    .selectOption("intermediate")
  await page.locator('select[name="preferredLocation"]').selectOption("gym")
  await page.getByRole("button", { name: /next|הבא/i }).click()
```

> The exact accessible name of the popover trigger and the option label come from the catalog (`options.unselected` and `options.goal.build_muscle`). If the selectors are brittle, add a `data-testid` to the `PopoverTrigger` and option rows in Task 7 and target those instead. Verify the run before relying on text matching.

- [ ] **Step 2: Run the e2e onboarding spec**

Run: `npm run test:e2e -- onboarding`
Expected: PASS (the flow completes through to the success text). If the popover/option selectors fail, adjust per the note above and re-run.

- [ ] **Step 3: Commit**

```bash
git add e2e/onboarding.spec.ts
git commit -m "test(e2e): drive the goals multi-select popover in onboarding"
```

---

### Task 9: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the standard gate**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all PASS, no errors.

- [ ] **Step 2: Run the full unit + integration suite**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 3: Run the e2e suite for the affected flows**

Run: `npm run test:e2e -- onboarding signup-journey my-plan`
Expected: PASS. (`my-plan` exercises a generated plan whose prompt now reads `goals`; `signup-journey` runs the onboarding flow.)

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run `npm run dev`, visit `/en/join`, confirm: the "Main goal" label shows an `i` icon with the "choose more than one" tooltip; the control is a button that opens a checkbox list; selecting two goals shows both labels in the trigger; submitting generates a plan. Repeat at `/he/join` to confirm RTL and Hebrew copy.

- [ ] **Step 5: Final commit if any fixups were needed**

```bash
git add -A
git commit -m "chore: verification fixups for multi-select goals"
```
