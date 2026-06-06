# Multi-Select Main Goal Design

## Problem

The onboarding form's "Main goal" control is a single-choice native
`<select>`. A client may legitimately pursue more than one goal (e.g. lose
weight and build muscle). The control must become a multi-select that:

- Lets the client pick more than one goal.
- Shows an `i` info icon next to the "Main goal" label explaining multiple
  selection is allowed.
- Presents each option with a checkbox, so selecting needs no `Ctrl`/`Cmd`.
- Is matched by a backend that accepts and persists multiple goals.

## Decisions

- Storage: new `goals text[]` column, backfilled from `goal`, old `goal`
  column dropped. Mirrors the existing `available_days` / `equipment`
  `text[] not null default '{}'` pattern.
- UI control: a Popover (`components/ui/popover.tsx`) whose trigger shows the
  selected goal labels (or a placeholder) and whose body is a checkbox list
  reusing the existing `CheckboxRow` and `toggle()` helpers.
- Selection rules: at least one goal, no maximum (preserves today's required
  behavior).

## Data Model

Migration `supabase/migrations/0003_client_goals_array.sql` (head is `0002`):

- `alter table public.clients add column goals text[] not null default '{}';`
- Backfill: `update public.clients set goals = array[goal] where goal is not
  null and goal <> '';`
- `alter table public.clients drop column goal;`

RLS on `clients` is row-scoped and column-agnostic; no policy change.

## Validation (`lib/validation/onboarding.ts`)

- `GOALS` vocabulary and `Goal` type unchanged.
- `OnboardingInput.goal?: string | null` becomes `goals?: string[]`.
- `ValidatedOnboarding.goal: Goal` becomes `goals: Goal[]`.
- New rule (mirrors `availableDays`): at least one goal; every entry a known
  `GOALS` member; no duplicates. Error codes `required` (empty) and `invalid`
  (unknown or duplicate), keyed under field `goals`.

## Persistence

- `lib/db/types.ts`: `ClientRow.goal` becomes `goals: string[] | null`.
- `lib/db/mappers.ts`: `ClientUpsertInput.goal?` becomes `goals?: string[]`
  mapping to `row.goals`; `Client.goal` becomes `goals: string[]`;
  `fromClientRow` reads `row.goals ?? []`.
- `lib/onboarding/onboarding-actions.ts`: passes `goals: data.goals`.

## Read Sites (display the list)

All four sites currently read `client.goal` as a scalar and must join the
array:

- `lib/ai/prompts.ts`: `Goal` line uses the existing `list(client.goals,
  "general_fitness")` helper.
- `lib/ai/chat-context.ts`: same join, falling back to `general_fitness`.
- `app/[locale]/trainer/trainer-clients.tsx`: `goalLabel` joins `goals` with
  `", "`, falling back to the existing `noGoal` text.
- `app/[locale]/trainer/clients/[clientId]/page.tsx`: `goal` profile field
  joins `client.goals` with `", "`, falling back to "not provided".

The trainer AI plan authoring form (`plans-manager.tsx`) uses a separate
free-text `goal` field on templates/plans, not the client profile column. It
stays untouched.

## UI (`app/[locale]/join/onboarding-form.tsx`)

- `OnboardingDefaults.goal: string` becomes `goals: string[]` (default `[]`);
  `EMPTY_DEFAULTS` and `app/[locale]/join/page.tsx` prefill
  (`existing.goals ?? []`) follow.
- `StepTraining` replaces the goal `NativeSelect` with a Popover-backed
  checkbox list: trigger button shows joined selected labels or a "Select..."
  placeholder; body renders one `CheckboxRow` per `GOALS` entry toggled via
  `toggle()`.
- The `Field` component gains an optional `labelAdornment` slot so an `i`
  icon (lucide `Info`) wrapped in `Tooltip` (`components/ui/tooltip.tsx`) sits
  beside the "Main goal" label. Tooltip text is `Onboarding.hints.goal`.
- `stepOfFirstError` map: `goal: 1` becomes `goals: 1`.

## Localization

- `messages/en-US.json` and `messages/he-IL.json`: rename `errors.goal` to
  `errors.goals` (same `required` / `invalid` codes); add `hints.goal`
  ("You can choose more than one goal." / Hebrew equivalent). `fields.goal`
  and `options.goal.*` unchanged.

## Testing

- `__tests__/unit/onboarding-validation.test.ts`: one goal, multiple goals,
  empty (required), unknown (invalid), duplicate (invalid).
- `__tests__/unit/db-mappers.test.ts`: `goals` round-trips through upsert row
  and `fromClientRow`.
- `__tests__/unit/ai-prompts.test.ts`, `__tests__/unit/chat-context.test.ts`:
  fixtures use `goals: [...]`; assert the joined list renders.
- `__tests__/unit/onboarding-form-redirect.test.tsx` and other fixtures:
  `goal` becomes `goals`.
- e2e `e2e/onboarding.spec.ts` / `e2e/signup-journey.spec.ts`: drive the
  popover checkbox instead of the select.

## Verification Gate

`npm run lint && npm run typecheck && npm run build`, then `npm run test`.
e2e (`npm run test:e2e`) for the onboarding flow behavior change.
