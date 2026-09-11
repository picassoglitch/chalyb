-- =====================================================================
-- Nexo AI — Cross-engine usage tracking (tokens shared as a pool).
--
-- THE MODEL:
--   monthly_allocation:   from TIER_CAPS[tier].tokensPerMonth (resets 1st)
--   token_bonus_balance:  top-up packs purchased via MP (never reset)
--   monthly_usage:        sum(amount) from usage_events this calendar month
--
--   balance = monthly_allocation + token_bonus_balance − monthly_usage
--
-- Engines push events to /api/engines/{slug}/usage; the endpoint inserts
-- here using the admin client (RLS bypassed). Idempotency comes from
-- (engine_id, source_id) UNIQUE — if NexoClip retries the same llm_calls.id
-- twice, the second insert is a no-op rather than double-charging.
--
-- WHY APPEND-ONLY: gives us audit-perfect history of every billable spend,
-- across every engine, queryable for analytics and dispute resolution.
-- Aggregation cost is fine at our scale (a few thousand events / user / month
-- maxes out — pg handles this trivially with the user+date index).
--
-- Idempotent: re-runnable.
-- =====================================================================

-- Top-up tokens that don't reset monthly. Sits on profiles so we don't need
-- a separate balance table for the rare-but-real "user bought a pack" case.
alter table public.profiles
  add column if not exists token_bonus_balance bigint not null default 0
  check (token_bonus_balance >= 0);

-- The event log. One row per billable resource consumption.
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  engine_id uuid not null references public.engines on delete cascade,
  -- Discriminator. Right now we only meter LLM tokens (combined input+output
  -- to match TIER_CAPS naming), but storage / minutes / publishes can plug in
  -- here later without a schema change.
  kind text not null check (kind in ('llm.tokens', 'storage.mb', 'publish.count')),
  amount bigint not null check (amount >= 0),
  -- Engine's own id for this event (NexoClip's llm_calls.id, etc). Lets us
  -- de-dupe across retries.
  source_id text,
  -- When the engine claims it happened (their clock). The Nexo AI insert
  -- time lives in created_at. We bill on occurred_at so timezone drift
  -- between engines + Nexo AI doesn't change the month bucket.
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- One row per (engine, source_id) — engine retries are no-ops.
  unique (engine_id, source_id)
);

create index if not exists usage_events_user_month_idx
  on public.usage_events (user_id, kind, occurred_at desc);
create index if not exists usage_events_engine_idx
  on public.usage_events (engine_id, occurred_at desc);

-- Top-up purchases. Reference the existing payments table — top-up packs
-- are MP charges just like tier upgrades, but they grant tokens instead of
-- changing tier.
create table if not exists public.token_pack_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- The MP payment id that funded this pack. NULL when granted manually by
  -- admin (e.g. compensation, comp accounts).
  mp_payment_id text unique,
  tokens_granted bigint not null check (tokens_granted > 0),
  source text not null default 'mp_payment'
    check (source in ('mp_payment', 'admin_grant', 'promo')),
  created_at timestamptz not null default now()
);
create index if not exists token_packs_user_idx
  on public.token_pack_purchases (user_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table public.usage_events enable row level security;
alter table public.token_pack_purchases enable row level security;

-- Users can SELECT their own usage (for the /app/usage page).
drop policy if exists "usage_events_select_self" on public.usage_events;
create policy "usage_events_select_self"
  on public.usage_events for select
  using (auth.uid() = user_id);

-- Admins see everything.
drop policy if exists "usage_events_select_admins" on public.usage_events;
create policy "usage_events_select_admins"
  on public.usage_events for select
  using (public.is_admin());

drop policy if exists "token_packs_select_self" on public.token_pack_purchases;
create policy "token_packs_select_self"
  on public.token_pack_purchases for select
  using (auth.uid() = user_id);

drop policy if exists "token_packs_select_admins" on public.token_pack_purchases;
create policy "token_packs_select_admins"
  on public.token_pack_purchases for select
  using (public.is_admin());

-- Writes only via service-role admin client (engines push usage, MP webhook
-- inserts pack purchases). No INSERT/UPDATE/DELETE policy on purpose.
