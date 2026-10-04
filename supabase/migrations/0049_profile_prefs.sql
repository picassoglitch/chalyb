-- 0049 · Mi perfil (all-pending WS-9 C; FIX-3 §C.5). What the old page kept
-- only in the browser now lives on the account.
--
--   profiles.timezone          IANA zone for the user's dates and notices
--   profiles.notify_critical   "Si algo deja de funcionar" (default on)
--   profiles.notify_daily      "Resumen del día" (default on)
--   profiles.notify_viral      "Cuando a un clip tuyo le va muy bien" (default off)
--   preferred_locale default   'es' (was 'en' since 0001). Existing rows are
--                              not touched (D-F3-10).
--
-- The user may update these columns, and only these, through the same
-- column grant 0032 set up. Marketing consent is NOT a column: it is an
-- event in consent_events (append-only). Idempotent.

alter table public.profiles
  add column if not exists timezone text,
  add column if not exists notify_critical boolean not null default true,
  add column if not exists notify_daily boolean not null default true,
  add column if not exists notify_viral boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_timezone_len') then
    alter table public.profiles
      add constraint profiles_timezone_len check (timezone is null or length(timezone) between 3 and 64);
  end if;
end $$;

alter table public.profiles alter column preferred_locale set default 'es';

grant update (timezone, notify_critical, notify_daily, notify_viral)
  on public.profiles to authenticated;
