-- Minimal Supabase-shaped fixture so migrations 0032–0034 can be run and
-- exercised for real: the roles PostgREST switches into, the auth schema and
-- auth.uid(), and the subset of public.profiles / token_pack_purchases the
-- new migrations touch (as created by 0001/0002/0004/0013/0025/0031).

-- Roles are cluster-wide, so make this re-runnable against a fresh database.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text
);

-- Supabase's auth.uid() reads the JWT claims GUC. Tests set request.jwt.claims.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
$$;

-- ── public.profiles, as of migration 0031 ────────────────────────────────
do $$ begin
  create type user_role as enum ('SUPER_ADMIN','ADMIN','OPERATOR','EDITOR','VIEWER','CLIENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_tier as enum ('FREE','PRO','PARTNER','VIP');
exception when duplicate_object then null; end $$;

create table public.organizations (id uuid primary key);
insert into public.organizations values ('00000000-0000-0000-0000-000000000001');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  preferred_locale text default 'en' check (preferred_locale in ('en','es')),
  role user_role not null default 'VIEWER',
  org_id uuid references public.organizations(id) on delete set null,
  tier subscription_tier not null default 'FREE',
  selected_engine_id uuid,
  token_bonus_balance bigint not null default 0 check (token_bonus_balance >= 0),
  welcome_gift_claimed_at timestamptz,
  chalybclip_trial_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.token_pack_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  mp_payment_id text unique,
  tokens_granted bigint not null check (tokens_granted > 0),
  source text not null default 'mp_payment'
    check (source in ('mp_payment','admin_grant','promo')),
  created_at timestamptz not null default now()
);

-- Supabase grants these by default to the API roles; 0032 narrows profiles.
grant select, insert, update, delete on public.profiles to anon, authenticated, service_role;
grant select, insert, update, delete on public.token_pack_purchases to anon, authenticated, service_role;

-- ── RLS as of 0001 + 0003 ────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
-- Deliberately WITHOUT a `with check` — this is the pre-0032 state, so the
-- test proves 0032 is what closes it.
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('SUPER_ADMIN','ADMIN')
  );
$$;

create policy "profiles_select_admins" on public.profiles for select using (public.is_admin());
create policy "profiles_update_admins" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- ── Seed: one ordinary subscriber, one admin ─────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'subscriber@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'admin@example.com');

insert into public.profiles (id, email, role, tier, org_id) values
  ('11111111-1111-1111-1111-111111111111', 'subscriber@example.com', 'VIEWER', 'FREE',
   '00000000-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', 'admin@example.com', 'SUPER_ADMIN', 'VIP',
   '00000000-0000-0000-0000-000000000001');
