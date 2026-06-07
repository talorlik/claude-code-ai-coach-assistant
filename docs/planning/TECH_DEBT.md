# Tech Debt Backlog

Running list of small, deferred cleanups to be cleared in one pass via the
`run-batch tech-debt` command (see `.claude/commands/run-batch-tech-debt.md`).
This file IS the work-list for that batch: the command reads the Open Items
below, fixes each, checks it off, and squash-merges the result into local
`main` exactly like a numbered build batch.

## How To Use

- During normal work, when you notice a small, out-of-scope cleanup, append it
  to Open Items with a checkbox, a clear scope, and enough detail to act on
  cold (file paths, line numbers, acceptance check).
- When ready, run `run-batch tech-debt`. It clears every unchecked Open Item,
  ticks each as it lands, moves the finished set into Done, and reports.
- Keep entries small and low-risk. Anything that needs design or changes
  behavior belongs in a normal feature/fix batch, not here.

## Entry Format

```
- [ ] **<short title>** - <what to do, with file:line and an acceptance check>.
  Added: YYYY-MM-DD. Source: <branch/feature that surfaced it>.
```

## Open Items

- [ ] **`combineE164` drops the trunk-0 for keep-the-zero countries** - In
  `lib/phone/phone.ts`, `combineE164` strips a single leading national trunk-0
  before prepending the dial code (correct for Israel and most countries). A few
  countries retain the leading 0 in their E.164 form (e.g. Italian fixed-line:
  `+39 06 ...` stays `+390612345678`). For those, editing a saved number is
  non-idempotent: `splitE164` returns a national part starting with `0`, and
  re-saving recombines to a corrupted `+3961...`. This is a deliberate trade-off
  of not adding a phone library (see `docs/DECISIONS.md`, the phone selector
  entry). Fix only if the user base broadens beyond IL-primary: either special-
  case keep-the-zero dial codes, or adopt `libphonenumber-js` for per-country
  national-number rules. Acceptance: a stored `+390612345678` / `IT` round-trips
  through split -> display -> combine unchanged. Added: 2026-06-07. Source:
  phone country-code selector feature, final holistic review.

- [ ] **Remove unused `_id` lint warnings** - 6 `@typescript-eslint/no-unused-vars`
  warnings for an unused `_id` binding in test files. Locations:
  `__tests__/integration/confirm-route.test.ts:15` and `:16`;
  `__tests__/integration/login-actions.test.ts:70`;
  `__tests__/unit/post-auth-redirect.test.ts:14`, `:15`, `:16`. Fix by removing
  or properly omitting the unused destructured `_id` parameter (match how other
  tests in the file ignore unused params). Acceptance: `npm run lint` reports
  `0 problems` (0 errors, 0 warnings). Added: 2026-06-07. Source: pre-existing,
  noted during the multi-select-goals feature.

- [ ] **Goal Popover trigger lacks a direct label association** - In the
  onboarding wizard `app/[locale]/join/onboarding-form.tsx`, the goal field's
  child is a `<div className="relative">` wrapper (it nests a Popover trigger and
  a clear-all button), so the `Field`-generated `htmlFor`/`id` association lands
  on the wrapper `<div>`, not on the trigger `<Button>` itself. The trigger is
  therefore not directly labelled for assistive tech (the surrounding label is
  present but points at the wrapper). Fix by giving the Popover trigger an
  explicit `id` and pointing the field `Label` at it via `aria-labelledby`, or
  refactor the goal `Field` so its single labelable child is the trigger.
  Acceptance: `getByLabelText(/Main goal/)` (or the goal field label) resolves to
  the trigger button. Added: 2026-06-07. Source: forms progressive-enhancement
  pass (native `Field` controls were fixed in the same pass; this wrapper case is
  the residue).

- [ ] **Authenticated site header overflows on mobile** -
  `components/site-header.tsx` lays the nav links and the controls cluster
  (install/language/theme/sign-out) in two non-wrapping flex rows with no mobile
  collapse. When signed in (My Plan/Chat/Account, plus Clients/Admin for the
  trainer) the header is ~547px wide and overflows horizontally at the 390px
  reference viewport, so every authenticated page scrolls sideways on a phone.
  Fix by collapsing the nav into a hamburger/menu below the `sm` breakpoint (or
  wrapping + condensing the controls). Acceptance: at 390px width, an
  authenticated page (e.g. `/en/join`) has `documentElement.scrollWidth -
  clientWidth <= 1` (extend `e2e/responsive.spec.ts` with an authenticated
  viewport check). Added: 2026-06-07. Source: onboarding UX branch (the
  onboarding form itself does not overflow; the shared header does).

- [ ] **`my-plan` view-switch e2e is state-dependent / flaky** -
  `e2e/my-plan.spec.ts:57` ("a client views the plan and can switch views")
  fails against the seeded customer account depending on that account's current
  plan state (observed failing on clean `main`, independent of any branch): it
  either does not reach `/en/my-plan` or lands in an in-between state where
  neither the "list" tab nor the "no active plan/onboarding" empty-state text is
  present. Make the test deterministic by seeding/resetting the account's plan
  state in a fixture or `beforeEach`, or by asserting on a stable post-load
  landmark rather than branching on tab visibility. Acceptance: the test passes
  reliably in isolation and in-suite regardless of prior plan state. Added:
  2026-06-07. Source: onboarding UX branch verification (pre-existing failure).

## Done

- [x] **Associate form labels with their controls (onboarding native fields)** -
  The `Field` component in `app/[locale]/join/onboarding-form.tsx` now generates a
  stable id (`React.useId`), sets it on `<Label htmlFor>`, and injects it into the
  single child control via `React.cloneElement`, so the native controls (fullName,
  phone, age, ageRange, fitnessLevel, preferredLocation) are programmatically
  associated with their visible labels. The wizard body is also wrapped in a real
  `<form>` and the advancing button is `type="submit"`. Verified by
  `__tests__/unit/onboarding-form-labels.test.tsx` (`getByLabelText` resolves each
  native control). The checkbox-group portion was already resolved earlier. The
  goal Popover trigger residue is tracked as its own Open Item above. Done:
  2026-06-07. Source: forms progressive-enhancement pass.
