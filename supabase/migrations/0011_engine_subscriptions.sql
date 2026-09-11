-- =====================================================================
-- Nexo AI — Engine subscriptions (per-user-per-engine access records).
--
-- WHY: When a subscriber activates an engine (NexoClip, NexoStreamManager,
-- future products), they need a corresponding "account" within that engine's
-- namespace. Today the engines are still in development — their own user
-- systems don't exist yet. This table is the bridge:
--
--   - We track WHO has access to WHICH engine, with WHAT status.
--   - external_user_id stores the engine's own user id when we later
--     provision via the engine's API (NexoClip will likely have one).
--   - external_credentials (jsonb) holds anything else needed to identify
--     the user inside that engine — API tokens, session keys, etc.
--
-- AUTO-CREATION RULES (enforced in server actions, not via DB trigger so
-- the logic is debuggable + audit-able from one place):
--   1. PRO user picks engine via setSelectedLiveEngine() → row created
--      for THAT engine only.
--   2. User reaches ALL_ACCESS (admin grant or MP payment confirms) → rows
--      created for every CURRENTLY-ACTIVE engine.
--   3. Admin (effective ALL_ACCESS via role override) → rows lazily created
--      on first visit to /app/engines/[slug].
--
-- STATUS:
--   - active:   user can use the engine right now
--   - paused:   user temporarily disabled (kept the record for resume)
--   - cancelled: user explicitly cancelled (kept for audit / re-onboarding)
--
-- Idempotent: re-runnable.
-- =====================================================================

create table if not exists public.engine_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  engine_id uuid not null references public.engines on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'paused', 'cancelled')),
  -- The user's ID inside the engine's own product (filled when we
  -- provision via the engine's API — NULL until then).
  external_user_id text,
  -- Free-form credential blob for whatever the engine's SDK/API needs.
  -- Never exposed via subscriber-side reads — see RLS below.
  external_credentials jsonb,
  -- How this subscription was created — for analytics + audit.
  source text not null default 'manual'
    check (source in ('manual', 'pro_selection', 'all_access_seed', 'admin_grant', 'mp_payment')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per (user, engine). Re-activating an existing record updates
  -- the status column instead of inserting a duplicate.
  unique (user_id, engine_id)
);

create index if not exists engine_subs_user_idx
  on public.engine_subscriptions (user_id);
create index if not exists engine_subs_engine_idx
  on public.engine_subscriptions (engine_id);
create index if not exists engine_subs_active_idx
  on public.engine_subscriptions (user_id, status)
  where status = 'active';

-- updated_at bump on every change.
create or replace function public.tg_engine_subs_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_engine_subs_updated_at on public.engine_subscriptions;
create trigger trg_engine_subs_updated_at
  before update on public.engine_subscriptions
  for each row execute function public.tg_engine_subs_set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────
alter table public.engine_subscriptions enable row level security;

-- Subscribers see their own subscription rows.
-- NOTE: SELECT exposes external_credentials. We use a VIEW pattern below
-- to mask credentials from subscriber-side reads. Direct SELECT on the
-- base table is restricted to admins.
drop policy if exists "engine_subs_select_self" on public.engine_subscriptions;
create policy "engine_subs_select_self"
  on public.engine_subscriptions for select
  using (auth.uid() = user_id);

-- Admins see all subscriptions (for support, audit, billing reconciliation).
drop policy if exists "engine_subs_select_admins" on public.engine_subscriptions;
create policy "engine_subs_select_admins"
  on public.engine_subscriptions for select
  using (public.is_admin());

-- Writes go through server actions using the service-role admin client,
-- which bypasses RLS. No INSERT/UPDATE/DELETE policy on purpose = anon and
-- authed contexts cannot directly mutate this table.

-- ── Optional: backfill admin user with all active-engine subscriptions ──
-- Picassoglitch (env-locked SUPER_ADMIN) already has effective ALL_ACCESS,
-- so seed their access rows immediately. Other existing users get seeded
-- on their next interaction (lazy provisioning in app code).
insert into public.engine_subscriptions (user_id, engine_id, status, source)
select
  p.id as user_id,
  e.id as engine_id,
  'active' as status,
  'all_access_seed' as source
from public.profiles p
join public.engines e on e.org_id = p.org_id
where p.role in ('SUPER_ADMIN', 'ADMIN')
  and e.status = 'active'
on conflict (user_id, engine_id) do nothing;
