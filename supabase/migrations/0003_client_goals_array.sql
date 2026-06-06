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
