-- =====================================================================
-- Chalyb — default usage margin 160% (owner, 2026-10-03).
--
-- Every unit a user consumes is charged at real provider cost × 2.6, so
-- what we pay is always a win. The owner panel (Ajustes) can still set
-- app_settings.usage_margin_percent; this only changes the default when
-- no value is saved. Must match DEFAULT_USAGE_MARGIN_PERCENT in
-- src/lib/config/settings.ts. Events already recorded keep the margin
-- they were priced at.
--
-- Idempotent.
-- =====================================================================

create or replace function public.usage_margin_percent()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select least(500, greatest(0, (value #>> '{}')::numeric))
       from public.app_settings
      where key = 'usage_margin_percent' and jsonb_typeof(value) = 'number'),
    160)
$$;
