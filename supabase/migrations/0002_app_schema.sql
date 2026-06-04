-- App schema: client onboarding, AI workout plans, logging, chat, templates,
-- trainer notes, push subscriptions, and plan-generation audit events.
--
-- Builds on 0001_auth_schema.sql, which defined user_roles, profiles, the
-- shared set_updated_at() trigger function, and is_admin(uuid). This migration
-- adds the nine feature tables, their foreign keys, indexes, updated_at
-- triggers, RLS, and the trainer-admin RLS policies.
--
-- RLS model:
--   * Each client owns the rows that reference their auth user id. Ownership is
--     auth.uid() = <owner column>, sometimes resolved through the owning
--     client/plan row.
--   * The trainer admin (role 'admin') has full access to every app table via
--     is_trainer_admin(). is_admin(uuid) from 0001 has EXECUTE revoked from
--     authenticated to keep it off the PostgREST RPC surface, so it cannot be
--     called from a policy expression evaluated as the authenticated role. The
--     dedicated is_trainer_admin() wrapper below is the policy-callable form: it
--     hard-codes auth.uid() (no argument to abuse over REST) and is granted to
--     authenticated so policies can invoke it. It is security definer, so its
--     own read of user_roles bypasses RLS and never recurses.

-- ---------------------------------------------------------------------------
-- Trainer-admin RLS helper (policy-callable, no argument)
-- ---------------------------------------------------------------------------
create or replace function public.is_trainer_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
  );
$$;

revoke execute on function public.is_trainer_admin() from public, anon;
grant execute on function public.is_trainer_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- clients: one onboarding profile per auth user
-- ---------------------------------------------------------------------------
create table public.clients (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  age integer,
  age_range text,
  goal text,
  fitness_level text,
  limitations text,
  available_days text[] not null default '{}',
  preferred_location text,
  equipment text[] not null default '{}',
  notes text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workout_plans: a generated or assigned plan owned by a client. Exactly one
-- active plan per client is expected; older plans are archived, not deleted.
-- ---------------------------------------------------------------------------
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (user_id) on delete cascade,
  title text,
  status text not null default 'active',
  locale text,
  source text not null default 'ai',
  source_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index workout_plans_client_id_idx on public.workout_plans (client_id);
-- Fast lookup of a client's single active plan.
create index workout_plans_active_idx
  on public.workout_plans (client_id)
  where status = 'active';

create trigger workout_plans_set_updated_at
before update on public.workout_plans
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workouts: an individual session within a plan (e.g. one day's workout).
-- ---------------------------------------------------------------------------
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  day_of_week text,
  title text,
  focus text,
  position integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workouts_plan_id_idx on public.workouts (plan_id);

create trigger workouts_set_updated_at
before update on public.workouts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- exercises: ordered movements within a workout.
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  name text not null,
  sets integer,
  reps text,
  duration text,
  rest text,
  instructions text,
  safety_notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercises_workout_id_idx on public.exercises (workout_id);

create trigger exercises_set_updated_at
before update on public.exercises
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workout_logs: a client's completion record for one workout on a given date.
-- Unique per (client, workout, planned date) prevents duplicate completions.
-- ---------------------------------------------------------------------------
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (user_id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  planned_date date,
  completed_at timestamptz not null default now(),
  difficulty text,
  energy_level text,
  notes text,
  created_at timestamptz not null default now(),
  unique (client_id, workout_id, planned_date)
);

create index workout_logs_client_id_idx on public.workout_logs (client_id);
create index workout_logs_workout_id_idx on public.workout_logs (workout_id);

-- ---------------------------------------------------------------------------
-- chat_messages: AI virtual-trainer conversation history per client.
-- ---------------------------------------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (user_id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_client_id_created_idx
  on public.chat_messages (client_id, created_at);

-- ---------------------------------------------------------------------------
-- plan_templates: trainer-owned reusable plan blueprints. Trainer-only data;
-- clients never read or write these.
-- ---------------------------------------------------------------------------
create table public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  locale text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plan_templates_created_by_idx on public.plan_templates (created_by);

create trigger plan_templates_set_updated_at
before update on public.plan_templates
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- trainer_notes: private notes the trainer admin keeps about a client. Clients
-- must never read these (enforced by RLS: trainer-admin only).
-- ---------------------------------------------------------------------------
create table public.trainer_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (user_id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trainer_notes_client_id_idx on public.trainer_notes (client_id);

create trigger trainer_notes_set_updated_at
before update on public.trainer_notes
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- push_subscriptions: browser Web Push endpoints owned by a client. A client
-- may have multiple devices; endpoint is unique.
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (user_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_client_id_idx
  on public.push_subscriptions (client_id);

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- plan_generation_events: audit trail of plan generation/regeneration. Records
-- who triggered it, the reason, and the outcome, preserving history.
-- ---------------------------------------------------------------------------
create table public.plan_generation_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (user_id) on delete cascade,
  plan_id uuid references public.workout_plans (id) on delete set null,
  triggered_by uuid references auth.users (id) on delete set null,
  source text not null default 'onboarding',
  reason text,
  status text not null default 'succeeded',
  created_at timestamptz not null default now()
);

create index plan_generation_events_client_id_idx
  on public.plan_generation_events (client_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.chat_messages enable row level security;
alter table public.plan_templates enable row level security;
alter table public.trainer_notes enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.plan_generation_events enable row level security;

-- clients: a client manages their own row; the trainer admin has full access.
create policy "Clients manage own client row"
on public.clients
for all
to authenticated
using (auth.uid() = user_id or public.is_trainer_admin())
with check (auth.uid() = user_id or public.is_trainer_admin());

-- workout_plans: owned by client_id; trainer admin has full access.
create policy "Clients manage own plans"
on public.workout_plans
for all
to authenticated
using (auth.uid() = client_id or public.is_trainer_admin())
with check (auth.uid() = client_id or public.is_trainer_admin());

-- workouts: ownership resolved through the parent plan.
create policy "Clients manage own workouts"
on public.workouts
for all
to authenticated
using (
  public.is_trainer_admin()
  or exists (
    select 1 from public.workout_plans p
    where p.id = workouts.plan_id and p.client_id = auth.uid()
  )
)
with check (
  public.is_trainer_admin()
  or exists (
    select 1 from public.workout_plans p
    where p.id = workouts.plan_id and p.client_id = auth.uid()
  )
);

-- exercises: ownership resolved through workout -> plan.
create policy "Clients manage own exercises"
on public.exercises
for all
to authenticated
using (
  public.is_trainer_admin()
  or exists (
    select 1
    from public.workouts w
    join public.workout_plans p on p.id = w.plan_id
    where w.id = exercises.workout_id and p.client_id = auth.uid()
  )
)
with check (
  public.is_trainer_admin()
  or exists (
    select 1
    from public.workouts w
    join public.workout_plans p on p.id = w.plan_id
    where w.id = exercises.workout_id and p.client_id = auth.uid()
  )
);

-- workout_logs: owned by client_id; trainer admin has full access.
create policy "Clients manage own logs"
on public.workout_logs
for all
to authenticated
using (auth.uid() = client_id or public.is_trainer_admin())
with check (auth.uid() = client_id or public.is_trainer_admin());

-- chat_messages: owned by client_id; trainer admin may read (review) and write.
create policy "Clients manage own chat messages"
on public.chat_messages
for all
to authenticated
using (auth.uid() = client_id or public.is_trainer_admin())
with check (auth.uid() = client_id or public.is_trainer_admin());

-- plan_templates: trainer-admin only. Clients have no access at all.
create policy "Trainer admin manages templates"
on public.plan_templates
for all
to authenticated
using (public.is_trainer_admin())
with check (public.is_trainer_admin());

-- trainer_notes: trainer-admin only. Clients must never read these.
create policy "Trainer admin manages notes"
on public.trainer_notes
for all
to authenticated
using (public.is_trainer_admin())
with check (public.is_trainer_admin());

-- push_subscriptions: owned by client_id; trainer admin has full access
-- (e.g. to fire reminders).
create policy "Clients manage own push subscriptions"
on public.push_subscriptions
for all
to authenticated
using (auth.uid() = client_id or public.is_trainer_admin())
with check (auth.uid() = client_id or public.is_trainer_admin());

-- plan_generation_events: a client may read their own events; the trainer admin
-- has full access. Inserts come from server actions; clients may insert their
-- own (self-triggered regeneration), trainer admin may insert any.
create policy "Clients read own generation events"
on public.plan_generation_events
for select
to authenticated
using (auth.uid() = client_id or public.is_trainer_admin());

create policy "Clients insert own generation events"
on public.plan_generation_events
for insert
to authenticated
with check (auth.uid() = client_id or public.is_trainer_admin());
