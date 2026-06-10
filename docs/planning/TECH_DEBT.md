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

_None. All tracked items were cleared in the 2026-06-10 tech-debt batch (see
Done below)._

## Done

- [x] **`combineE164` drops the trunk-0 for keep-the-zero countries** -
  `lib/phone/phone.ts` now special-cases keep-the-zero dial codes via the
  `KEEP_LEADING_ZERO_DIAL_CODES` set (currently `+39`/Italy): `combineE164`
  preserves the leading 0 for those and still strips it for the common case. No
  phone library added (the documented IL-primary trade-off is respected; the set
  is the minimal, dial-code-keyed fix). Verified by
  `__tests__/unit/phone.test.ts`: a stored `+390612345678` / `IT` round-trips
  through split -> display -> combine unchanged, plus a common-case strip test.
  Done: 2026-06-10. Source: phone country-code selector feature.

- [x] **Remove unused `_id` lint warnings** - Fixed at the root by honoring the
  underscore-prefix convention the tests already use: `eslint.config.mjs` adds a
  `@typescript-eslint/no-unused-vars` override with `argsIgnorePattern` /
  `varsIgnorePattern` / `caughtErrorsIgnorePattern` of `^_`. This cleared the 6
  `_id` warnings and a 7th `_input` warning in
  `onboarding-contact-dedup.test.tsx`. `npm run lint` reports `0 problems`. Done:
  2026-06-10. Source: pre-existing, multi-select-goals feature.

- [x] **Goal Popover trigger lacks a direct label association** - The `Field`
  component in `app/[locale]/join/onboarding-form.tsx` gained an optional
  `controlId` prop: when set, the `<Label htmlFor>` targets that id and no id is
  cloned onto the wrapper. The goal field passes a `React.useId()` value as both
  `controlId` and the trigger `Button`'s `id`, so the "Main goal" label resolves
  directly to the trigger. Verified by `onboarding-form-labels.test.tsx`
  (`getByLabelText(/Main goal/)` resolves to the `goal-trigger` button). Done:
  2026-06-10. Source: forms progressive-enhancement pass.

- [x] **Authenticated site header overflows on mobile** - The header already
  collapses its nav into a hamburger `Sheet` below the `md` breakpoint (landed in
  `fix(nav): collapse mobile menu after tapping a nav link`), so the code fix was
  in place; the residual work was the missing regression guard. Added an
  authenticated 390px no-horizontal-overflow check to `e2e/responsive.spec.ts`
  using the `injectSession` helper (skips when customer credentials are unset).
  Done: 2026-06-10. Source: onboarding UX branch.

- [x] **`my-plan` view-switch e2e is state-dependent / flaky** - `e2e/my-plan.spec.ts`
  now signs the customer in via `injectSession` (the captcha-bypassing helper)
  instead of the Turnstile-blocked login form - the root cause of not reaching
  `/my-plan` - and asserts the stable `getByRole("main")` landmark and the
  `/en/my-plan` URL rather than branching on the `list` tab. The list/calendar
  switch is now opportunistic, so the test is deterministic regardless of plan
  state. Done: 2026-06-10. Source: onboarding UX branch verification.

- [x] **`setPlanActiveAction` activate path is non-atomic; one-active-plan
  invariant is not DB-enforced** - Migration `0007_one_active_plan_invariant.sql`
  replaces the non-unique `workout_plans_active_idx` with a partial UNIQUE index
  `workout_plans_one_active_idx` (`unique (client_id) where status = 'active'`),
  so the DB rejects a second active plan, and adds a `security definer` RPC
  `set_plan_active(uuid, boolean)` that does archive-then-activate in one
  transaction (re-checking `is_trainer_admin()` first). `setPlanActiveAction` now
  calls the RPC and maps its `no_data_found` (P0002) raise to
  `plan.noPlanToActivate`. Applied to the remote DB; no pre-existing
  duplicate-active rows blocked the unique index. Verified by
  `__tests__/integration/trainer-clients-actions.test.ts` (RPC mocked over
  in-memory plans). Done: 2026-06-10. Source: trainer client-row-actions feature,
  Task 3 code review.

- [x] **`notes-actions.ts` returns raw English strings instead of i18n keys** -
  The three operation `fail(...)` calls in `lib/trainer/notes-actions.ts` now
  return `errors.saveError` / `errors.updateError` / `errors.deleteError`, added
  under `TrainerDashboard.notes.errors` in both `en-US.json` and `he-IL.json`.
  The notes panel's `messageFor` resolves a returned `errors.*` key through its
  `TrainerDashboard.notes` translator (falling back to `errors.generic`), so the
  failure copy localizes under `/he`. The validator's generic summary string was
  also switched to `errors.generic` for consistency. Verified by
  `__tests__/integration/trainer-notes-actions.test.ts`. Done: 2026-06-10.
  Source: trainer client-row-actions feature, Task 3 code review.

- [x] **Root-scanning lint + service-worker test don't exclude `.worktrees/`** -
  `__tests__/unit/single-service-worker.test.ts` adds `.worktrees` to
  `IGNORED_DIRS`, and `eslint.config.mjs` adds `.worktrees/**` to its
  `globalIgnores`. A verify in the primary checkout is now robust to a live
  worktree under `.worktrees/`. (This project uses the `../itai-*` sibling
  worktree convention, so the failure window did not recur here, but the guard is
  in place for any `.worktrees/`-based worktree.) Done: 2026-06-10. Source:
  collapsible-trainer-sections feature, post-merge gate.

## Previously Done

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
