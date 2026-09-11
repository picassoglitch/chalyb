-- =====================================================================
-- Nexo AI — Rename subscription tier ALL_ACCESS → VIP.
--
-- The top paid tier is rebranded "VIP" (was "All-Access") so Nexo AI and
-- NexoClip share one coherent plan ladder: FREE · PRO · VIP. Postgres lets
-- us rename an enum value in place — every existing profiles.tier = 'ALL_ACCESS'
-- row becomes 'VIP' automatically, no data backfill needed.
--
-- ⚠️  CROSS-SYSTEM CONTRACT: the SSO launch token now signs tier='vip'
--     (lowercase) to NexoClip. NexoClip's tenants.tier enum must add 'vip'
--     (and ideally rename its own 'all_access' → 'vip') BEFORE this ships,
--     or VIP users' SSO logins will be rejected by NexoClip. See
--     src/lib/engines/integrations/nexoclip.ts for the wire value.
--
-- Idempotent: re-runnable. Only renames if the old value still exists.
-- =====================================================================

do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'subscription_tier'
      and e.enumlabel = 'ALL_ACCESS'
  ) then
    alter type subscription_tier rename value 'ALL_ACCESS' to 'VIP';
  end if;
end $$;
