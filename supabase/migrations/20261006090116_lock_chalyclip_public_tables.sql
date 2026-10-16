-- RECOVERED, not written here. This migration was applied directly to nexo-ai
-- (ledger version 20261006090116, created_by picassoglitch@gmail.com) and was in
-- no repo. Recovered on 2026-10-16 from supabase_migrations.schema_migrations
-- .statements (one statement, which already ends with its own ";", so none is
-- added). Everything below this header is the stored statement, unchanged.

-- Lock ChalyClip's tables in `public` away from the API roles.
--
-- Found 2026-10-06: these 48 tables had row level security off, and Supabase's default
-- privileges gave `anon` and `authenticated` full rights on them. Anyone with the
-- publishable key (it ships in web code) could read and write them through
-- /rest/v1, including api_tokens, live_stream_keys, webhook_secret_versions and
-- connected_accounts.
--
-- Nothing legitimate uses that path: ChalyClip connects to Postgres directly as
-- `postgres`, which owns these tables, so RLS (not forced) and these grants don't
-- apply to it. None of them is in a realtime publication, and no web code reads
-- them through the API (Chalito's `users` is chalito.users). service_role keeps its
-- rights and bypasses RLS.
--
-- Enabling RLS with no policies = no rows for anon/authenticated even if a grant
-- comes back later; the revoke closes it at the privilege level too. Idempotent.

do $$
declare
  t text;
  s text;
  tables text[] := array[
    'api_tokens', 'autoprog_locks', 'autopublish_settings', 'brand_kits', 'candidates',
    'channel_watches', 'clip_growth_scores', 'clips', 'connected_accounts',
    'drive_export_settings', 'drive_watches', 'events', 'hub_publish_jobs',
    'live_stream_keys', 'llm_calls', 'personas', 'platform_cooldowns',
    'platform_pacing_rules', 'platform_settings', 'publish_jobs', 'publish_metrics',
    'schema_version', 'speakers', 'stream_destinations', 'streams', 'tenants',
    'transcripts', 'usage_jobs', 'usage_outbox', 'users', 'variants', 'visual_signals',
    'vod_speakers', 'webhook_secret_versions', 'webhook_subscriptions',
    'zernio_auto_retries', 'zernio_broadcast_log', 'zernio_calendar', 'zernio_comments',
    'zernio_community_notifications', 'zernio_community_settings', 'zernio_contacts',
    'zernio_conversations', 'zernio_events', 'zernio_messages',
    'zernio_publish_snapshots', 'zernio_publishes', 'zernio_whatsapp_numbers'
  ];
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    -- Sequences behind serial / identity columns of these tables.
    for s in
      select format('%I.%I', sn.nspname, sc.relname)
      from pg_depend d
      join pg_class sc on sc.oid = d.objid and sc.relkind = 'S'
      join pg_namespace sn on sn.oid = sc.relnamespace
      where d.refobjid = format('public.%I', t)::regclass and d.deptype in ('a', 'i')
    loop
      execute format('revoke all on sequence %s from anon, authenticated', s);
    end loop;
  end loop;
end $$;
