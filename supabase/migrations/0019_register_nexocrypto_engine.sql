-- =====================================================================
-- Nexo AI — Register NexoCrypto as a 7th engine.
--
-- NexoCrypto is a futures-only crypto trading engine (Bitunix + LBank,
-- deterministic Strategy + Risk Engines, Telegram ingest, paper -> semi-auto
-- gates). Distinct from `nexotrade` which targets prediction markets
-- (Polymarket/Kalshi).
--
-- Mirrors how `nexoclip` is wired:
--   - external_url           = https://nexocrypto.nexo-ai.world
--   - admin_api_base         = https://nexocrypto.nexo-ai.world/api/admin
--   - integration_mode       = external_sso_redirect
--   - requires_provisioning  = true
--
-- Set tier_required to PRO (matches the other production trading/clip
-- engines). Status `active` so it shows as enabled; flip to `coming_soon`
-- before public launch if you want the soft-launch label.
--
-- Idempotent: re-runnable.
-- =====================================================================

-- 1. Insert the engine row (no-op on conflict — UUID-stable).
insert into public.engines
  (id, org_id, slug, name, icon, category, type, env, region, node, description, featured, status, tier_required)
values
  ('22222222-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000001',
   'nexocrypto', 'NexoCrypto', '📊', 'TRADING', 'Futures engine',
   'PRODUCTION', 'us-east-1', 'CPU-01',
   'Motor de trading de futuros cripto (Bitunix + LBank). Estrategias deterministas, Risk Engine con autoridad final, ingest de Telegram, backtest -> paper -> semi-auto. Sin custodia: el operador trae sus propias API keys.',
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
  external_url           = 'https://nexocrypto.nexo-ai.world',
  admin_api_base         = 'https://nexocrypto.nexo-ai.world/api/admin',
  requires_provisioning  = true
where slug = 'nexocrypto';

-- 3. Initial health snapshot so the dashboard doesn't render OFFLINE on day 1.
-- engine_health may be append-only (snapshot table); guard with NOT EXISTS so the
-- migration stays idempotent without assuming a unique constraint.
insert into public.engine_health (engine_id, state, health, latency_ms, revenue_cents)
select '22222222-0000-0000-0000-000000000007', 'HEALTHY', 95, 220, 0
where not exists (
  select 1 from public.engine_health
  where engine_id = '22222222-0000-0000-0000-000000000007'
);
