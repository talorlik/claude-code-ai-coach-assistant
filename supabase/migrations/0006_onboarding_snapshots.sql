-- 0006_onboarding_snapshots.sql
-- Immutable history of the onboarding details used to generate each plan. One
-- row is written per plan-producing generation (first onboarding generation and
-- every regeneration), FK'd to the produced plan, so "the details + the plan
-- they produced" is a single queryable row. This complements the existing plan
-- archival (workout_plans.status -> 'archived'): the archived plan and its
-- snapshot both persist and the history view joins them.
--
-- RLS mirrors plan_generation_events: a client reads/inserts their own rows; the
-- trainer admin has full access. Snapshots are immutable - there is no update or
-- delete policy, so rows only disappear via the client cascade.

create table public.onboarding_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (user_id) on delete cascade,
  plan_id uuid references public.workout_plans (id) on delete set null,
  -- Immutable copy of the onboarding details used to generate plan_id.
  full_name text,
  phone text,
  country_iso2 text,
  age integer,
  age_range text,
  goals text[] not null default '{}',
  fitness_level text,
  limitations text,
  available_days text[] not null default '{}',
  availability jsonb not null default '{}'::jsonb,
  session_duration_minutes integer,
  preferred_location text,
  equipment text[] not null default '{}',
  equipment_other text[] not null default '{}',
  notes text,
  locale text,
  created_at timestamptz not null default now()
);

create index onboarding_snapshots_client_id_idx
  on public.onboarding_snapshots (client_id, created_at desc);
create index onboarding_snapshots_plan_id_idx
  on public.onboarding_snapshots (plan_id);

alter table public.onboarding_snapshots enable row level security;

-- A client may read their own snapshots; the trainer admin reads any.
create policy "Clients read own onboarding snapshots"
on public.onboarding_snapshots
for select
to authenticated
using (auth.uid() = client_id or public.is_trainer_admin());

-- Inserts come from server actions: a client inserts their own (self-triggered
-- regeneration / first onboarding), the trainer admin may insert for any client.
create policy "Clients insert own onboarding snapshots"
on public.onboarding_snapshots
for insert
to authenticated
with check (auth.uid() = client_id or public.is_trainer_admin());
