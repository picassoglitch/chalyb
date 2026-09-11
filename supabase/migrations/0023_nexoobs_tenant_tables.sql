-- =====================================================================
-- NexoOBS per-tenant tables.
--
-- NexoOBS (the multistream engine) stores each tenant's stream session +
-- connected destinations here. tenant_id = the Nexo-AI user id carried in
-- the SSO token (external_user_id). NexoOBS talks to this DB with the
-- service-role key and scopes EVERY query by tenant_id in application code
-- (see web/src/lib/data.ts) — RLS is enabled below as defense-in-depth so
-- the anon/auth keys can never read cross-tenant.
--
-- Idempotent: re-runnable.
-- =====================================================================

-- 1. Session: one row per tenant. Holds the editable title, live/record
--    flags, and the per-tenant ingest stream key.
create table if not exists public.nexoobs_sessions (
  tenant_id      text primary key,
  title          text not null default 'Mi transmisión en vivo',
  is_live        boolean not null default false,
  record_enabled boolean not null default true,
  stream_key     text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 2. Destinations: N rows per tenant, one per connected platform.
create table if not exists public.nexoobs_destinations (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            text not null,
  platform_id          text not null,
  channel_handle       text not null default '',
  stream_title         text not null default '',
  ingest_url           text not null default '',
  stream_key           text not null default '',
  oauth_token          text not null default '',
  enabled              boolean not null default false,
  status_kind          text,            -- ok | offline | expired | pending_approval
  status_platform_name text,            -- only for pending_approval
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tenant_id, platform_id)
);

create index if not exists nexoobs_destinations_tenant_idx
  on public.nexoobs_destinations (tenant_id);

-- 3. RLS: lock both tables. NexoOBS uses the service-role key (bypasses
--    RLS); enabling it with NO permissive anon/auth policy means a leaked
--    anon key can't read another tenant's stream keys / OAuth tokens.
alter table public.nexoobs_sessions      enable row level security;
alter table public.nexoobs_destinations  enable row level security;
