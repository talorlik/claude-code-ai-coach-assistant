# Trainer Client List: Explicit Row Actions

Design spec for making the trainer dashboard client list actionable: replace
the misleading whole-row affordance with explicit edit/delete icons and an
inline plan active/inactive toggle.

Date: 2026-06-10
Status: Approved (pending user review of this spec)

## Problem

On `/[locale]/trainer`, the client list (`app/[locale]/trainer/trainer-clients.tsx`)
renders each desktop row with `cursor-pointer`, but only the client name is an
actual link. Clicking the obvious target (anywhere else in the row) does
nothing, so the edit affordance is invisible in practice. There is also:

- No way to delete a client from the list (no delete server action exists
  anywhere in the codebase today).
- No way to toggle a client's plan between active and inactive from the list.

## Goals

1. Make "edit this client" obvious via an explicit pencil icon.
2. Add the ability to delete a client (destructive, confirmed).
3. Add an inline plan active/inactive toggle that reflects state in both color
   and word.
4. Keep the layout responsive: real `<table>` on `md+`, stacked cards below,
   no forced horizontal page scroll. RTL-correct under `/he`.

## Non-Goals

- No conversion to a CSS grid layout. The existing responsive table + mobile
  card structure already collapses gracefully and keeps semantic table headers;
  converting to a grid loses accessibility for no gain.
- No new dedicated edit form. The pencil links to the existing client dashboard
  at `/trainer/clients/[clientId]`, which already edits onboarding, plan, and
  notes.
- No soft-archive / status column for clients. Delete is a hard delete.

## Decisions (confirmed with user)

| Question | Decision |
| --- | --- |
| Edit target | Existing client dashboard `/trainer/clients/[clientId]`. |
| Delete depth | App data (clients row + FK cascade) AND the Supabase auth user. |
| Row click | Only icons act. Remove `cursor-pointer`; name is plain text. |
| Plan toggle on | Reactivate the most-recently-archived plan. Disable the toggle when the client has never had any plan. |
| Layout | Keep responsive table + mobile cards; no grid rewrite. |

## Data Model (existing, no migration)

`workout_plans` (`supabase/migrations/0002_app_schema.sql`):

- `client_id uuid` references `clients(user_id)` `on delete cascade`.
- `status text not null default 'active'` with values `'active'` / `'archived'`.
- `archived_at timestamptz`.
- Exactly one active plan per client is expected.

`hasActivePlan` is derived in `lib/db/trainer-clients.ts` from the existence of a
plan with `status = 'active'`. Deleting the `clients` row cascades to plans,
workouts, logs, and notes through existing foreign keys.

## Components and Changes

### 1. Page query: `lib/db/trainer-clients.ts`

`listClientsWithActivity` gains one derived flag per row:

- `hasAnyPlan: boolean` - whether the client has any plan at all (active or
  archived). Drives whether the plan toggle is enabled.

`TrainerClientRow` (in `trainer-clients.tsx`) and the page mapping in
`app/[locale]/trainer/page.tsx` are extended with `hasAnyPlan`.

### 2. Server actions: `lib/db/trainer-clients-actions.ts` (new)

Follows the established pattern in `lib/trainer/notes-actions.ts`:
`"use server"`, `requireTrainerAdmin()` guard at the top of every action, the
RLS-scoped or admin client as appropriate, dual-locale `revalidatePath`, and
`ActionResult<T>` returns via `ok` / `fail` (never throw to the caller).

Helper:

```
function revalidateTrainerList(): void {
  revalidatePath("/en/trainer")
  revalidatePath("/he/trainer")
}
```

#### `deleteClientAction(clientId: string): Promise<ActionResult<null>>`

1. `requireTrainerAdmin()`.
2. Admin client (`createAdminClient()`, bypasses RLS): delete the `clients`
   row by `user_id = clientId`. FK `on delete cascade` removes plans, workouts,
   logs, and notes.
3. Admin auth API: `auth.admin.deleteUser(clientId)` to free the email for
   re-registration.
4. `revalidateTrainerList()`. Return `ok(null)`.
5. On any failure return `fail(t-key)` with a user-safe localized message.

Ordering note: delete app data first, then the auth user. If the auth-user
delete fails after the data delete, the row is already gone (acceptable: the
client is effectively removed); surface a partial-failure message so the admin
knows to retry the auth cleanup. Document this in TSDoc.

#### `setPlanActiveAction(clientId: string, active: boolean): Promise<ActionResult<{ hasActivePlan: boolean }>>`

1. `requireTrainerAdmin()`.
2. `active === false`: set the client's current active plan to
   `status = 'archived'`, `archived_at = now()`.
3. `active === true`: find the most-recently-archived plan
   (`order by archived_at desc nulls last, updated_at desc`, `limit 1`) and set
   it `status = 'active'`, `archived_at = null`. If none exists, return
   `fail("plan.noPlanToActivate")` - this is the backstop; the UI normally
   disables the toggle in this state so it should not be reachable.
4. To preserve the one-active-plan invariant, archiving/activating is scoped to
   the client's plans; activating one archives any other active plan first.
5. `revalidateTrainerList()`. Return `ok({ hasActivePlan: active })`.

### 3. `trainer-clients.tsx` (desktop table)

- Remove `cursor-pointer` from `TableRow`.
- Name cell: plain `font-medium` text (`row.fullName ?? t("unnamed")`); no
  `<Link>`.
- Plan cell: replace the static `Badge` with the `<PlanToggle>` (below).
- New trailing actions column:
  - `<TableHead>` with a visually-hidden label `t("columns.actions")`.
  - `<TableCell>` containing two ghost icon buttons:
    - Pencil (`Pencil`): `<Link href={`/trainer/clients/${row.userId}`}>`,
      `aria-label={t("actions.editLabel", { name })}`, `title` tooltip.
    - Trash (`Trash2`): opens the delete `AlertDialog`,
      `aria-label={t("actions.deleteLabel", { name })}`.
  - The cell is inline-end; RTL handled by the already direction-aware table.

### 4. `trainer-clients.tsx` (mobile cards)

- Remove the wrapping `<Link>` on each card.
- Card footer gains the same three controls (pencil link, trash button, plan
  toggle) so feature parity holds and there is no horizontal scroll.

### 5. `<PlanToggle>` (in `trainer-clients.tsx` or a sibling file)

- Client component built on `components/ui/switch.tsx` (or `toggle.tsx`).
- Reflects state in BOTH color and word:
  - Active: emerald indicator + `t("plan.active")`.
  - Inactive: muted/rose indicator + `t("plan.none")`.
- `aria-pressed` / switch `checked` bound to `hasActivePlan`.
- `disabled` when `!hasActivePlan && !hasAnyPlan` (nothing to activate); the
  disabled control shows `t("plan.none")`.
- On change: optimistic flip, call `setPlanActiveAction`, revert + Sonner toast
  on `fail`.

### 6. Delete confirm dialog

- `components/ui/alert-dialog.tsx`.
- Title `t("delete.confirmTitle")`, description
  `t("delete.confirmDescription", { name })` stating it permanently removes the
  client and all their data and cannot be undone.
- Cancel + destructive Confirm. On confirm: call `deleteClientAction`, Sonner
  success/error toast, dialog closes; revalidation refreshes the list.

## Internationalization

New keys under `TrainerClients` in BOTH `messages/en-US.json` and
`messages/he-IL.json`:

- `columns.actions`
- `actions.edit`, `actions.delete`, `actions.editLabel` (`{name}`),
  `actions.deleteLabel` (`{name}`)
- `plan.toggleLabel` (`{name}`), `plan.activate`, `plan.deactivate`,
  `plan.noPlanToActivate`
- `delete.confirmTitle`, `delete.confirmDescription` (`{name}`),
  `delete.confirmCta`, `delete.cancel`, `delete.success`, `delete.error`

Hebrew translations provided; RTL verified.

## Testing (Vitest, AI/data mocked)

Server actions (`__tests__/unit` or `integration`):

- `deleteClientAction`: success (data + auth user deleted, list revalidated);
  unauthorized (non-admin rejected by guard); auth-user delete failure surfaces
  partial-failure message.
- `setPlanActiveAction`: deactivate archives active plan; activate restores
  most-recently-archived plan; activate with no plan returns
  `plan.noPlanToActivate`; unauthorized rejected.

Component (`trainer-clients.tsx`):

- Edit pencil renders as a link to the dashboard with the localized aria-label.
- Name is plain text, not a link.
- Trash opens the confirm dialog.
- Plan toggle disabled when `!hasActivePlan && !hasAnyPlan`.

## Verification Gate

`npm run lint && npm run typecheck && npm run build`, plus `npm run test` for
the new behavior. Manual check on a phone-width viewport for no horizontal
scroll and correct RTL placement of the actions column.

## Files Touched

- `app/[locale]/trainer/trainer-clients.tsx` (edit)
- `app/[locale]/trainer/page.tsx` (edit: map `hasAnyPlan`)
- `lib/db/trainer-clients.ts` (edit: derive `hasAnyPlan`)
- `lib/db/trainer-clients-actions.ts` (new)
- `messages/en-US.json`, `messages/he-IL.json` (edit)
- `__tests__/...` (new tests)
