-- 0005_availability_duration_equipment_other.sql
-- Adds the compulsory scheduling and equipment-detail fields collected in
-- onboarding step 3:
--   * availability            - per-day time windows the client can train in
--   * session_duration_minutes - desired session length, a multiple of 15
--   * equipment_other          - free-text equipment typed under "Other"
-- Nullable / defaulted, no backfill (mirrors 0004_phone_country.sql): existing
-- onboarded rows predate these fields and keep working; compulsoriness is
-- enforced in the validation layer, so a legacy client fills them on first edit.
-- equipment_other is kept separate from the closed-set `equipment` array and is
-- merged with it only when building the AI prompt, so the closed-set validation
-- on `equipment` stays intact and the edit form can round-trip both faithfully.

alter table public.clients
  add column if not exists availability jsonb not null default '{}'::jsonb,
  add column if not exists session_duration_minutes integer,
  add column if not exists equipment_other text[] not null default '{}';

comment on column public.clients.availability is
  'Per-day training windows: { "monday": [{"start":"HH:MM","end":"HH:MM"}], ... }. Keys are a subset of available_days; each listed day has at least one non-overlapping 24h range.';
comment on column public.clients.session_duration_minutes is
  'Desired session length in minutes, a multiple of 15 (e.g. 45). Null only for legacy rows onboarded before this column existed.';
comment on column public.clients.equipment_other is
  'Free-text equipment the client typed under "Other"; merged with the closed-set equipment[] only when building the AI prompt.';
