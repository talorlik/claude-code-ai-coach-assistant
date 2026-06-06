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

- [ ] **Remove unused `_id` lint warnings** - 6 `@typescript-eslint/no-unused-vars`
  warnings for an unused `_id` binding in test files. Locations:
  `__tests__/integration/confirm-route.test.ts:15` and `:16`;
  `__tests__/integration/login-actions.test.ts:70`;
  `__tests__/unit/post-auth-redirect.test.ts:14`, `:15`, `:16`. Fix by removing
  or properly omitting the unused destructured `_id` parameter (match how other
  tests in the file ignore unused params). Acceptance: `npm run lint` reports
  `0 problems` (0 errors, 0 warnings). Added: 2026-06-07. Source: pre-existing,
  noted during the multi-select-goals feature.

- [ ] **Associate form labels with their controls** - In the onboarding wizard
  `app/[locale]/join/onboarding-form.tsx`, the `Field` component renders a
  `<Label>` with no `htmlFor`, and the controls (native selects, the goal
  Popover trigger, the day/equipment checkbox groups) have no matching `id`, so
  labels are not programmatically associated for assistive tech. Give each
  `Field` control a stable `id` and wire `Label htmlFor` (or `aria-labelledby`)
  to it; for the checkbox groups (`availableDays`, `equipment`) ensure the
  `<legend>` / group label is associated via `aria-labelledby` on the group, and
  the goal Popover trigger gets `aria-labelledby`/`aria-describedby` pointing at
  its label and any error text. Acceptance: every labelled control in the form
  has an accessible name derived from its visible label (verify in the a11y tree
  or with a Testing Library `getByLabelText` query per field); no visual change.
  Added: 2026-06-07. Source: multi-select-goals UI code review (flagged
  non-blocking follow-up).

## Done

(none yet)
