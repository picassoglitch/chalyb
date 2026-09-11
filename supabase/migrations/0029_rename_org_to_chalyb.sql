-- =====================================================================
-- Chalyb — rebrand: rename the org row seeded as "Nexo AI (demo)".
--
-- The company is now Chalyb. Migration 0002 seeded the single org row with
-- the old name; that row is live data, so it needs an UPDATE here rather
-- than an edit to 0002 (already applied in production).
--
-- SCOPE — deliberately narrow. This migration renames DATA ONLY. Not touched:
--   - engines.slug ('nexoclip', 'nexoobs', 'nexocrypto', …): wire values.
--     They key engine_subscriptions, usage_events and the SSO token payload,
--     and the engine backends match on them. Renaming slugs is a coordinated
--     change on both sides — see docs/infra/gcp-migration.md.
--   - external_url / admin_api_base: still on nexo-ai.world. They move when
--     the new domain is live, not before.
--   - Comments in already-applied migrations: historical record, left alone.
--
-- Idempotent: re-runnable.
-- =====================================================================

update public.organizations
set name = 'Chalyb'
where id = '00000000-0000-0000-0000-000000000001'::uuid
  and name = 'Nexo AI (demo)';
