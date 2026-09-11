-- =====================================================================
-- Nexo AI — Command Center schema + seed.
-- Run after 0001_profiles.sql.
-- Models: organizations, bots, bot_health, bot_personas, activity_events,
-- favorites. Extends profiles with role + org_id.
-- Seeds 16 bots / 16 health snapshots / 4 personas verbatim from the
-- prototype BOTS array (.nexo-reference/reference-prototype-userdashboard.html).
-- =====================================================================

-- ---------- enums (idempotent via DO block) ----------
do $$ begin
  create type bot_category as enum ('TRADING','STREAMING','CONTENT','AGENTS','RESEARCH','INTERNAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bot_env as enum ('PRODUCTION','STAGING','LOCAL','GPU_NODE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bot_state as enum ('HEALTHY','TRAINING','RENDERING','DELAYED','ERROR','OFFLINE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('SUPER_ADMIN','ADMIN','OPERATOR','EDITOR','VIEWER','CLIENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_kind as enum ('healthy','training','rendering','delayed','error','offline');
exception when duplicate_object then null; end $$;

-- ---------- organizations ----------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------- extend profiles with role + org_id ----------
alter table public.profiles add column if not exists role user_role default 'VIEWER' not null;
alter table public.profiles add column if not exists org_id uuid references public.organizations(id) on delete set null;

-- ---------- bots ----------
create table if not exists public.bots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  icon text,
  category bot_category not null,
  type text not null,
  env bot_env not null,
  region text not null,
  node text,
  description text,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);
create index if not exists idx_bots_org_cat on public.bots(org_id, category);

-- ---------- bot_health (1:1 with bots) ----------
create table if not exists public.bot_health (
  bot_id uuid primary key references public.bots(id) on delete cascade,
  state bot_state not null default 'OFFLINE',
  health int not null default 0,
  latency_ms int not null default 0,
  revenue_cents bigint not null default 0,
  cpu_pct int not null default 0,
  queue_pct int not null default 0,
  tokens_today bigint not null default 0,
  cost_cents_today bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- bot_personas (optional 1:1) ----------
create table if not exists public.bot_personas (
  bot_id uuid primary key references public.bots(id) on delete cascade,
  persona text,
  tone text,
  goals text,
  focus text,
  learning_state text,
  engagement_score int not null default 0
);

-- ---------- activity_events ----------
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  bot_id uuid references public.bots(id) on delete set null,
  kind activity_kind not null default 'healthy',
  title text not null,
  meta text,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_org_time on public.activity_events(org_id, created_at desc);

-- ---------- favorites (per-user) ----------
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, bot_id)
);

-- ---------- RLS ----------
alter table public.organizations enable row level security;
alter table public.bots enable row level security;
alter table public.bot_health enable row level security;
alter table public.bot_personas enable row level security;
alter table public.activity_events enable row level security;
alter table public.favorites enable row level security;

-- For v1: any authenticated user can read everything in the shared demo org.
-- Multi-tenant policies tighten this in step 04-DATABASE.
drop policy if exists "orgs_read_authed" on public.organizations;
create policy "orgs_read_authed" on public.organizations for select using (auth.role() = 'authenticated');

drop policy if exists "bots_read_authed" on public.bots;
create policy "bots_read_authed" on public.bots for select using (auth.role() = 'authenticated');

drop policy if exists "bot_health_read_authed" on public.bot_health;
create policy "bot_health_read_authed" on public.bot_health for select using (auth.role() = 'authenticated');

drop policy if exists "bot_personas_read_authed" on public.bot_personas;
create policy "bot_personas_read_authed" on public.bot_personas for select using (auth.role() = 'authenticated');

drop policy if exists "activity_read_authed" on public.activity_events;
create policy "activity_read_authed" on public.activity_events for select using (auth.role() = 'authenticated');

drop policy if exists "favorites_own_rw" on public.favorites;
create policy "favorites_own_rw" on public.favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- SEED — fixed demo org + 16 bots from the prototype, verbatim.
-- Idempotent: re-runnable. Uses fixed UUIDs so re-seeds are no-ops.
-- =====================================================================

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001'::uuid, 'Nexo AI (demo)')
on conflict (id) do nothing;

-- Bots
insert into public.bots (id, org_id, slug, name, icon, category, type, env, region, node, description, featured) values
  ('11111111-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','qpoly','Quantorpolybot','📈','TRADING','Trading bot','PRODUCTION','us-west-2','GPU-02','Estructura de mercado, EMA 35/50, confluencia Fibonacci 61.8.',true),
  ('11111111-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','scout','Pattern Scout','🔭','TRADING','Signal scanner','GPU_NODE','us-west-2','GPU-02','Detección de patrones de precio en vivo, planeación dual.',false),
  ('11111111-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','arbx','ArbiX Spread','⇄','TRADING','Arbitrage bot','PRODUCTION','us-east-1','w-11','Spread cross-exchange, ejecución con límite de slippage.',false),
  ('11111111-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','nclip','NexoClip','🎬','CONTENT','Clip engine','GPU_NODE','us-west-2','GPU-04','VOD → clips multiplataforma con disparadores de voz/chat/audio.',true),
  ('11111111-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','subs','SubtitleForge','💬','CONTENT','Caption AI','PRODUCTION','us-east-1','w-07','Subtítulos karaoke, word-level timing, multi-idioma.',false),
  ('11111111-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','thumb','ThumbSmith','🖼','CONTENT','Thumbnail AI','PRODUCTION','us-east-1','w-07','Extracción de frame + overlay de marca on-brand.',false),
  ('11111111-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','persona1','AVA Streamer','🎙','STREAMING','AI streamer','PRODUCTION','us-east-1','rtmp-1','Co-host en vivo: voz, reacción a chat, persona Nexo.',true),
  ('11111111-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','mod','ChatWarden','🛡','STREAMING','Moderation','PRODUCTION','us-east-1','rtmp-1','Moderación de chat en tiempo real, filtros de toxicidad.',false),
  ('11111111-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001','vod','VOD Compressor','📼','STREAMING','Pipeline','GPU_NODE','us-west-2','GPU-01','Compresión y archivado de VOD post-stream.',false),
  ('11111111-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','agent1','Nexo Persona','🧠','AGENTS','AI agent','GPU_NODE','us-west-2','GPU-03','Persona AI para contenido y respuestas de comunidad.',false),
  ('11111111-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','agent2','Outreach Agent','📨','AGENTS','AI agent','PRODUCTION','us-east-1','w-03','Prospección y seguimiento automatizado de leads.',false),
  ('11111111-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','agent3','DocOps Agent','🗂','AGENTS','AI agent','LOCAL','local','—','Generación y mantenimiento de documentación interna.',false),
  ('11111111-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000001','scrap','Realestate Scraper','🏠','RESEARCH','Scraper','PRODUCTION','mx-central-1','w-09','Portales MX → leads curados a Discord, captura de comisión.',false),
  ('11111111-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000001','news','SignalWatch','📰','RESEARCH','Research','STAGING','us-east-1','w-12','Monitoreo de noticias y eventos para señales de mercado.',false),
  ('11111111-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000001','sf','ScriptForge','⚒','INTERNAL','Internal tool','PRODUCTION','us-east-1','w-02','Generador de guiones multi-nicho × tema, multi-proveedor AI.',false),
  ('11111111-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000001','bk','BackupRunner','💾','INTERNAL','Internal tool','PRODUCTION','us-east-1','w-01','Respaldos programados — fallo: límite de almacenamiento.',false)
on conflict (org_id, slug) do nothing;

-- Bot health (initial snapshots — telemetry layer drifts these at runtime)
insert into public.bot_health (bot_id, state, health, latency_ms, revenue_cents) values
  ('11111111-0000-0000-0000-000000000001','HEALTHY',88,122,184000),
  ('11111111-0000-0000-0000-000000000002','TRAINING',74,88,0),
  ('11111111-0000-0000-0000-000000000003','DELAYED',52,340,23000),
  ('11111111-0000-0000-0000-000000000004','RENDERING',81,210,92000),
  ('11111111-0000-0000-0000-000000000005','DELAYED',60,155,0),
  ('11111111-0000-0000-0000-000000000006','HEALTHY',91,98,14000),
  ('11111111-0000-0000-0000-000000000007','HEALTHY',95,64,61000),
  ('11111111-0000-0000-0000-000000000008','HEALTHY',89,42,0),
  ('11111111-0000-0000-0000-000000000009','RENDERING',70,280,0),
  ('11111111-0000-0000-0000-000000000010','TRAINING',78,190,0),
  ('11111111-0000-0000-0000-000000000011','HEALTHY',84,110,38000),
  ('11111111-0000-0000-0000-000000000012','OFFLINE',0,0,0),
  ('11111111-0000-0000-0000-000000000013','HEALTHY',86,130,54000),
  ('11111111-0000-0000-0000-000000000014','DELAYED',48,420,0),
  ('11111111-0000-0000-0000-000000000015','HEALTHY',93,75,0),
  ('11111111-0000-0000-0000-000000000016','ERROR',18,0,0)
on conflict (bot_id) do nothing;

-- Bot personas (only 4 bots have them in the prototype)
insert into public.bot_personas (bot_id, persona, tone, goals, focus, learning_state, engagement_score) values
  ('11111111-0000-0000-0000-000000000001','Disciplined market operator','Frío, basado en estructura','P&L positivo en 50+ trades sombra','Polymarket CLOB v2','Shadow mode',71),
  ('11111111-0000-0000-0000-000000000004','Editor de cortos multiplataforma','Energético, viral','12 clips/VOD, 3 variantes c/u','TikTok · Reels · Shorts','Rendering',84),
  ('11111111-0000-0000-0000-000000000007','Co-host de stream AI','Carismático, cercano','Retención +15%, engagement chat','Kick · IRL + coding','Live',92),
  ('11111111-0000-0000-0000-000000000010','Alter ego Nexo Academy','Directo, confrontacional','Posts diarios, engagement comunidad','Skool · Español','Training',68)
on conflict (bot_id) do nothing;

-- Attach existing profiles (if any) to the demo org so they see bots immediately.
update public.profiles set org_id = '00000000-0000-0000-0000-000000000001'::uuid where org_id is null;
