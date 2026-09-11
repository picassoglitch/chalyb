-- =====================================================================
-- Nexo AI — Rename `bots` to `engines` + onboard real products.
--
-- WHY: "Bots" was always too narrow. The catalog will include bots, sites,
-- streaming tools, AI agents, scrapers — all of which we now call ENGINES
-- (revenue-producing products, paired conceptually with Nexo Academy on the
-- "learn" side).
--
-- WHAT THIS DOES:
--   1. Renames bots → engines, bot_health → engine_health, bot_personas →
--      engine_personas. Renames all bot_id FK columns to engine_id.
--   2. Renames profiles.selected_bot_id → selected_engine_id.
--   3. Adds two new columns to engines: status (active|coming_soon|deprecated)
--      and tier_required (which subscription tier unlocks live execution).
--   4. Wipes the existing 16 mock seeds and inserts 6 real engines:
--        - NexoClip + NexoStreamManager (active, PRO)
--        - NexoPicks + NexoBot (coming_soon, PRO)
--        - NexoRealtor + NexoTrade (coming_soon, ALL_ACCESS)
--   5. Recreates all RLS policies on the renamed tables.
--
-- IDEMPOTENCY: This migration is one-shot. Once renamed, re-running fails on
-- the rename itself (since `bots` no longer exists). The DO blocks make the
-- column adds + reseed safe to re-run. Don't re-run the table renames.
-- =====================================================================

-- ---------- 1. Rename tables + columns ----------
-- Wrap renames in DO blocks so this whole file is rerunnable: if engines
-- already exists, skip the rename instead of erroring.
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='bots') then
    alter table public.bots rename to engines;
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='bot_health') then
    alter table public.bot_health rename to engine_health;
    alter table public.engine_health rename column bot_id to engine_id;
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='bot_personas') then
    alter table public.bot_personas rename to engine_personas;
    alter table public.engine_personas rename column bot_id to engine_id;
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='activity_events' and column_name='bot_id'
  ) then
    alter table public.activity_events rename column bot_id to engine_id;
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='favorites' and column_name='bot_id'
  ) then
    alter table public.favorites rename column bot_id to engine_id;
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='selected_bot_id'
  ) then
    alter table public.profiles rename column selected_bot_id to selected_engine_id;
  end if;
end $$;

-- ---------- 2. Add new columns to engines ----------
alter table public.engines
  add column if not exists status text not null default 'active'
  check (status in ('active', 'coming_soon', 'deprecated'));

alter table public.engines
  add column if not exists tier_required subscription_tier not null default 'FREE';

create index if not exists idx_engines_status on public.engines(status);

-- ---------- 3. Refresh RLS policies on renamed tables ----------
-- Old policies still exist with their old names but reference the new table
-- transparently (policies follow renames). However the policy names look
-- weird ("bots_read_authed" on a table called engines) so we replace them.

drop policy if exists "bots_read_authed" on public.engines;
drop policy if exists "engines_read_authed" on public.engines;
create policy "engines_read_authed"
  on public.engines for select
  using (auth.role() = 'authenticated');

drop policy if exists "bot_health_read_authed" on public.engine_health;
drop policy if exists "engine_health_read_authed" on public.engine_health;
create policy "engine_health_read_authed"
  on public.engine_health for select
  using (auth.role() = 'authenticated');

drop policy if exists "bot_personas_read_authed" on public.engine_personas;
drop policy if exists "engine_personas_read_authed" on public.engine_personas;
create policy "engine_personas_read_authed"
  on public.engine_personas for select
  using (auth.role() = 'authenticated');

-- favorites policy still references auth.uid() which doesn't care about the
-- column rename — but recreate with the right column name for clarity.
drop policy if exists "favorites_own_rw" on public.favorites;
create policy "favorites_own_rw"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- 4. Wipe mocks + insert real engines ----------
-- CASCADE clears engine_health, engine_personas, activity_events, favorites,
-- AND nullifies any profiles.selected_engine_id pointing here. Run once.
delete from public.engines;

-- The 6 real engines. Fixed UUIDs so re-seeds are no-ops via on conflict.
insert into public.engines
  (id, org_id, slug, name, icon, category, type, env, region, node, description, featured, status, tier_required)
values
  ('22222222-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'nexoclip', 'NexoClip', '✂', 'CONTENT', 'Clip engine',
   'PRODUCTION', 'us-east-1', 'GPU-04',
   'Generador de clips cortos a partir de streams en vivo y VODs largos. Multi-plataforma: TikTok, Reels, Shorts.',
   true, 'active', 'PRO'),

  ('22222222-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'nexostream', 'NexoStreamManager', '▶', 'STREAMING', 'Stream control',
   'PRODUCTION', 'us-east-1', 'rtmp-1',
   'Control central de streams en vivo a través de TikTok, Twitch, Kick y YouTube. Routing, layouts y chat unificado.',
   true, 'active', 'PRO'),

  ('22222222-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000001',
   'nexopicks', 'NexoPicks', '🎯', 'RESEARCH', 'Sports AI',
   'PRODUCTION', 'mx-central-1', '—',
   'Picks deportivos con razonamiento AI, distribución por Telegram y tracking de performance.',
   false, 'coming_soon', 'PRO'),

  ('22222222-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000001',
   'nexobot', 'NexoBot', '🤖', 'AGENTS', 'Telegram AI',
   'PRODUCTION', 'us-east-1', '—',
   'Bots de Telegram con persona AI custom — atención, ventas, comunidad. Multi-tenant.',
   false, 'coming_soon', 'PRO'),

  ('22222222-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000001',
   'nexorealtor', 'NexoRealtor', '🏠', 'RESEARCH', 'Lead scraper',
   'PRODUCTION', 'mx-central-1', '—',
   'Scraper inmobiliario multi-portal MX. Captura leads, los enruta a Discord, registra comisión.',
   false, 'coming_soon', 'ALL_ACCESS'),

  ('22222222-0000-0000-0000-000000000006',
   '00000000-0000-0000-0000-000000000001',
   'nexotrade', 'NexoTrade', '📈', 'TRADING', 'Prediction trader',
   'PRODUCTION', 'us-west-2', 'GPU-02',
   'Bot de trading asíncrono para mercados de predicción (Polymarket, Kalshi). Señales con LLM, ejecución sombra/live.',
   false, 'coming_soon', 'ALL_ACCESS')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  status = excluded.status,
  tier_required = excluded.tier_required,
  featured = excluded.featured;

-- Initial health snapshots so the dashboard has something to render.
-- Only active engines get HEALTHY; coming_soon stay OFFLINE.
insert into public.engine_health (engine_id, state, health, latency_ms, revenue_cents) values
  ('22222222-0000-0000-0000-000000000001', 'HEALTHY', 92, 180, 0),
  ('22222222-0000-0000-0000-000000000002', 'HEALTHY', 95, 64, 0),
  ('22222222-0000-0000-0000-000000000003', 'OFFLINE', 0, 0, 0),
  ('22222222-0000-0000-0000-000000000004', 'OFFLINE', 0, 0, 0),
  ('22222222-0000-0000-0000-000000000005', 'OFFLINE', 0, 0, 0),
  ('22222222-0000-0000-0000-000000000006', 'OFFLINE', 0, 0, 0)
on conflict (engine_id) do update set
  state = excluded.state,
  health = excluded.health,
  latency_ms = excluded.latency_ms;

-- Personas for the 2 active engines (gives the detail drawer something to show).
insert into public.engine_personas
  (engine_id, persona, tone, goals, focus, learning_state, engagement_score)
values
  ('22222222-0000-0000-0000-000000000001',
   'Editor de cortos multiplataforma',
   'Energético, viral',
   '12 clips por VOD, 3 variantes c/u',
   'TikTok · Reels · Shorts',
   'Production',
   88),
  ('22222222-0000-0000-0000-000000000002',
   'Director de transmisión',
   'Profesional, multi-tasking',
   'Cero downtime, transiciones limpias entre escenas',
   'OBS · Restream · multiplatform',
   'Production',
   91)
on conflict (engine_id) do update set
  persona = excluded.persona,
  tone = excluded.tone,
  goals = excluded.goals,
  focus = excluded.focus,
  learning_state = excluded.learning_state,
  engagement_score = excluded.engagement_score;
