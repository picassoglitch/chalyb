-- =====================================================================
-- Chalyb — rebrand the schema identifiers the code already uses.
--
-- The rebrand renamed identifiers in the application code but never in the
-- schema, because the migration ledger was assumed to be a fresh project. It
-- is not: uqcbziwdgbnzehipzjxp is the original production database, with
-- 0001-0027 applied. The code now reads:
--
--   profiles.chalybclip_trial_started_at   (18 references)
--   chalybobs_sessions / chalybobs_destinations   (src/lib/data/ops.ts)
--
-- while the schema still has the nexo* names from 0023 and 0025. This closes
-- that gap in the direction of the rebrand.
--
-- Verified before writing: no function, view or RLS policy references any of
-- these names, so the renames cannot leave a dependent object broken.
--
-- CONSEQUENCE FOR THE CHALYBOBS ENGINE: its backend writes to these two
-- tables directly with the service-role key (see 0023). It is being rebuilt
-- from empty and has not been rebranded; its rebuild must use the new table
-- names.
--
-- Idempotent: every rename is guarded, so re-running is a no-op.
-- =====================================================================

-- 1. profiles.nexoclip_trial_started_at → chalybclip_trial_started_at
--    The column comment set in 0025 follows the column.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'nexoclip_trial_started_at'
  ) then
    alter table public.profiles
      rename column nexoclip_trial_started_at to chalybclip_trial_started_at;
  end if;
end $$;

-- 2. nexoobs_* tables → chalybobs_*
do $$ begin
  if to_regclass('public.nexoobs_sessions') is not null
     and to_regclass('public.chalybobs_sessions') is null then
    alter table public.nexoobs_sessions rename to chalybobs_sessions;
  end if;

  if to_regclass('public.nexoobs_destinations') is not null
     and to_regclass('public.chalybobs_destinations') is null then
    alter table public.nexoobs_destinations rename to chalybobs_destinations;
  end if;

  if to_regclass('public.nexoobs_destinations_tenant_idx') is not null then
    alter index public.nexoobs_destinations_tenant_idx
      rename to chalybobs_destinations_tenant_idx;
  end if;
end $$;
