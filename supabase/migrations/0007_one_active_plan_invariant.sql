-- 0007_one_active_plan_invariant.sql
-- Make the "at most one active plan per client" invariant DB-enforced and the
-- trainer activate path atomic.
--
-- Background: setPlanActiveAction (lib/db/trainer-clients-actions.ts) activated a
-- plan with three independently-committed statements (find candidate, archive the
-- current active plan, activate the candidate). With no transaction a failure
-- between the archive and activate writes stranded the client with zero active
-- plans, and concurrent activate calls could leave two 'active' rows because
-- workout_plans_active_idx (0002) was a NON-unique partial index.
--
-- This migration closes both holes:
--   1. Replaces the non-unique partial index with a partial UNIQUE index, so the
--      database itself rejects a second active plan for the same client.
--   2. Adds a security-definer RPC, set_plan_active(uuid, boolean), that performs
--      archive-then-activate inside a single function body (one transaction), so a
--      mid-sequence failure rolls back atomically and never strands the client.
--
-- The RPC re-checks is_trainer_admin() because security definer bypasses RLS; the
-- archive/activate writes therefore run with the function owner's privileges only
-- after the caller is confirmed to be the trainer admin.

-- ---------------------------------------------------------------------------
-- 1. DB-enforced single-active-plan invariant.
-- ---------------------------------------------------------------------------
-- Replace the non-unique lookup index with a UNIQUE partial index. The predicate
-- keeps it scoped to active rows, so archived plans are unconstrained (a client
-- accumulates archived history) while at most one active plan can exist per
-- client. It still serves the fast active-plan lookup the old index provided.
drop index if exists public.workout_plans_active_idx;

create unique index workout_plans_one_active_idx
  on public.workout_plans (client_id)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- 2. Atomic activate/deactivate RPC.
-- ---------------------------------------------------------------------------
-- make_active = false: archive the client's current active plan (no-op if none).
-- make_active = true:  archive any active plan, then activate the most-recently
--                      archived plan. Both branches run as one transaction (the
--                      function body), so partial application cannot occur.
-- Returns the resulting active state. Raises:
--   * insufficient_privilege (42501) when the caller is not the trainer admin;
--   * no_data_found          (P0002) when activating but the client has no plan.
-- The caller maps these to the localizable plan.updateError / plan.noPlanToActivate
-- codes.
create or replace function public.set_plan_active(
  target_client uuid,
  make_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_id uuid;
begin
  -- security definer bypasses RLS, so authorize explicitly: only the trainer
  -- admin may move another client's plans between active and archived.
  if not public.is_trainer_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  if not make_active then
    update public.workout_plans
      set status = 'archived', archived_at = now()
      where client_id = target_client and status = 'active';
    return false;
  end if;

  -- Pick the plan to restore before touching the active row, so the choice is
  -- not affected by the archive write below.
  select id into candidate_id
    from public.workout_plans
    where client_id = target_client and status = 'archived'
    order by archived_at desc nulls last
    limit 1;

  if candidate_id is null then
    raise exception 'no plan to activate' using errcode = 'no_data_found';
  end if;

  -- Archive the current active plan first so the unique partial index does not
  -- reject the activation below; both writes commit together or not at all.
  update public.workout_plans
    set status = 'archived', archived_at = now()
    where client_id = target_client and status = 'active';

  update public.workout_plans
    set status = 'active', archived_at = null
    where id = candidate_id;

  return true;
end;
$$;

-- Keep the function off the anonymous surface; only authenticated callers (gated
-- again inside by is_trainer_admin()) and the service role may invoke it.
revoke execute on function public.set_plan_active(uuid, boolean) from public, anon;
grant execute on function public.set_plan_active(uuid, boolean) to authenticated, service_role;
