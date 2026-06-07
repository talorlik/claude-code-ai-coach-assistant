-- 0004_phone_country.sql
-- Adds the selected ISO 3166-1 alpha-2 country code alongside the existing
-- E.164 `phone` column on both client and profile tables. Nullable, no backfill:
-- existing rows keep their `phone` value and resolve a default flag on first
-- edit, then persist their real country on the next save. The `phone` column
-- remains the single source of truth for the dialable number.

alter table public.clients
  add column if not exists country_iso2 text;

alter table public.profiles
  add column if not exists country_iso2 text;

comment on column public.clients.country_iso2 is
  'ISO 3166-1 alpha-2 code of the country selected for the phone number (e.g. IL). Restores the exact country/flag on edit, including for shared dial codes.';
comment on column public.profiles.country_iso2 is
  'ISO 3166-1 alpha-2 code of the country selected for the phone number (e.g. IL).';
