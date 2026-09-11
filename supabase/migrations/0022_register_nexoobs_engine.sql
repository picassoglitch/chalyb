-- =====================================================================
-- Nexo AI — Register NexoOBS as an 8th engine.
--
-- NexoOBS is the Restream-style multistream + clips control panel. Web
-- frontend (Next.js, deployed on Railway) pairs with a mobile encoder
-- (Expo, Phase 2 supports DJI Osmo Pocket 3 over UVC) that pushes RTMP
-- to a relay; the web app handles destinations, chat, clips.
--
-- NOTE on overlap with `nexostream` (NexoStreamManager, UUID ...002):
--   nexostream was seeded in 0010 with "Control central de streams en
--   vivo a través de TikTok, Twitch, Kick y YouTube. Routing, layouts y
--   chat unificado" — that description matches NexoOBS's scope. They
--   coexist for now; deprecate nexostream later if NexoOBS absorbs it.
--
-- Mirrors how `nexoclip` and `nexocrypto` are wired:
--   - external_url           = https://nexoobs.nexo-ai.world
--   - admin_api_base         = https://nexoobs.nexo-ai.world/api/admin
--   - integration_mode       = external_sso_redirect
--   - requires_provisioning  = true
--
-- Status `active` so it shows enabled from day one; flip to `coming_soon`
-- if you want the soft-launch label.
--
-- Idempotent: re-runnable.
-- =====================================================================

-- 1. Insert the engine row (no-op on conflict — UUID-stable).
insert into public.engines
  (id, org_id, slug, name, icon, category, type, env, region, node, description, featured, status, tier_required)
values
  ('22222222-0000-0000-0000-000000000008',
   '00000000-0000-0000-0000-000000000001',
   'nexoobs', 'NexoOBS', '🎥', 'STREAMING', 'Multistream encoder',
   'PRODUCTION', 'us-east-1', 'rtmp-2',
   'Panel multistream estilo Restream + clips. Conectá tu cámara (móvil, OBS, Osmo Pocket 3 por RTMP nativo) a un solo ingest y emití a Kick, Twitch, YouTube, TikTok, Facebook con chat unificado. Get Clips manda la sesión a NexoClip para generación automática.',
   true, 'active', 'PRO')
on conflict (id) do update set
  name          = excluded.name,
  description   = excluded.description,
  icon          = excluded.icon,
  status        = excluded.status,
  tier_required = excluded.tier_required,
  featured      = excluded.featured;

-- 2. Wire the integration columns added in migration 0012.
update public.engines
set
  integration_mode       = 'external_sso_redirect',
  external_url           = 'https://nexoobs.nexo-ai.world',
  admin_api_base         = 'https://nexoobs.nexo-ai.world/api/admin',
  requires_provisioning  = true
where slug = 'nexoobs';

-- 3. Initial health snapshot so the dashboard doesn't render OFFLINE on day 1.
-- engine_health may be append-only (snapshot table); guard with NOT EXISTS so the
-- migration stays idempotent without assuming a unique constraint.
insert into public.engine_health (engine_id, state, health, latency_ms, revenue_cents)
select '22222222-0000-0000-0000-000000000008', 'HEALTHY', 92, 180, 0
where not exists (
  select 1 from public.engine_health
  where engine_id = '22222222-0000-0000-0000-000000000008'
);
