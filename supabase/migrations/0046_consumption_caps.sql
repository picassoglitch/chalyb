-- =====================================================================
-- Chalyb — consumption caps, admission and one billing unit.
-- Contract: docs/engines/consumption-contract.md
--
--   usage_events.billable_tokens   what an event draws from the balance:
--                                  real cost plus the platform margin
--                                  (4 micros/token, margin from app_settings).
--                                  The ONE number balances, royalties and
--                                  platform stats all sum, so what a user
--                                  is charged and what a partner is paid
--                                  can't disagree again. Before this,
--                                  balances charged non-LLM spend at cost
--                                  while royalties counted llm.tokens only.
--   usage_reservations             a job/stream an engine was admitted to
--                                  run: holds its estimated tokens until
--                                  settled or expired, and is what the
--                                  concurrency and monthly caps count.
--   admit_usage()                  checks every aggregate cap and reserves,
--                                  under a per-user lock, so two jobs
--                                  submitted at once can't both squeeze
--                                  through the last tokens.
--   settle_usage_reservation()     closes one, charging the boost fee on
--                                  success.
--   usage_balance()                used + reserved this period in one
--                                  query (the JS sum it replaces stopped
--                                  at PostgREST's 1000-row page, so a busy
--                                  user's balance was under-counted).
--
-- Period: calendar month in UTC, as everywhere else in the hub.
-- Idempotent.
-- =====================================================================

-- ── billable_tokens ────────────────────────────────────────────────────
-- Charged at real cost plus the platform margin:
--   cost sent          → ceil(cost_usd_micros × (1 + margin) / 4)
--   llm.tokens, no cost → ceil(amount × (1 + margin))
--   boost.fee          → ceil(cost_usd_micros / 4)  (already a price)
--   anything else      → 1
-- never below 1. 4 micros = 1 token is the $4 / 1M-token unit; the margin
-- (app_settings.usage_margin_percent, default 50) is read when the event is
-- written and frozen into the row, so changing it never re-prices the past.
-- cost_usd_micros keeps the exact provider cost: that is what we paid.
create or replace function public.usage_billable_tokens(
  p_kind text, p_amount bigint, p_cost_usd_micros bigint, p_margin_percent numeric
) returns bigint language sql immutable as $$
  select greatest(1, case
    when p_kind = 'boost.fee' and p_cost_usd_micros is not null
      then ceil(p_cost_usd_micros / 4.0)
    when p_cost_usd_micros is not null
      then ceil(p_cost_usd_micros * (100 + p_margin_percent) / 400.0)
    when p_kind = 'llm.tokens'
      then ceil(p_amount * (100 + p_margin_percent) / 100.0)
    else 1
  end)::bigint
$$;

create or replace function public.usage_margin_percent()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select least(500, greatest(0, (value #>> '{}')::numeric))
       from public.app_settings
      where key = 'usage_margin_percent' and jsonb_typeof(value) = 'number'),
    50)
$$;

alter table public.usage_events
  add column if not exists billable_tokens bigint;
alter table public.usage_events
  add column if not exists margin_percent numeric;

create or replace function public.usage_events_price()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.margin_percent := coalesce(new.margin_percent, public.usage_margin_percent());
  new.billable_tokens := public.usage_billable_tokens(
    new.kind, new.amount, new.cost_usd_micros, new.margin_percent);
  return new;
end;
$$;

drop trigger if exists trg_usage_events_price on public.usage_events;
create trigger trg_usage_events_price
  before insert or update of kind, amount, cost_usd_micros, margin_percent
  on public.usage_events
  for each row execute function public.usage_events_price();

-- Events written before this migration were charged without a margin; keep
-- them that way.
update public.usage_events set margin_percent = 0 where margin_percent is null;

alter table public.usage_events
  add column if not exists reservation_id uuid;

create index if not exists usage_events_user_time_idx
  on public.usage_events (user_id, occurred_at desc);
create index if not exists usage_events_engine_time_billable_idx
  on public.usage_events (engine_id, occurred_at) include (billable_tokens);

comment on column public.usage_events.billable_tokens is
  'Balance units this event draws: real cost plus margin_percent, at 4 micros per token (see usage_billable_tokens). Set by trg_usage_events_price.';
comment on column public.usage_events.margin_percent is
  'Platform margin applied when the event was written (app_settings.usage_margin_percent).';

-- ── reservations ───────────────────────────────────────────────────────
create table if not exists public.usage_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  engine_id uuid not null references public.engines on delete cascade,
  external_job_id text not null,
  class text not null default 'job' check (class in ('job', 'stream')),
  operation text,
  lane text not null default 'standard' check (lane in ('standard', 'boost')),
  est_tokens bigint not null default 0 check (est_tokens >= 0),
  fee_tokens bigint not null default 0 check (fee_tokens >= 0),
  source_minutes numeric not null default 0 check (source_minutes >= 0),
  upload_mb numeric not null default 0 check (upload_mb >= 0),
  status text not null default 'open'
    check (status in ('open', 'succeeded', 'failed', 'cancelled', 'expired')),
  ttl_seconds integer not null default 10800 check (ttl_seconds between 60 and 86400),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  settled_at timestamptz,
  unique (engine_id, external_job_id)
);

create index if not exists usage_reservations_user_open_idx
  on public.usage_reservations (user_id, class) where status = 'open';
create index if not exists usage_reservations_user_time_idx
  on public.usage_reservations (user_id, created_at desc);

alter table public.usage_reservations enable row level security;
drop policy if exists usage_reservations_self_select on public.usage_reservations;
create policy usage_reservations_self_select on public.usage_reservations
  for select using (auth.uid() = user_id);
-- Writes: service role only, through the functions below.

comment on table public.usage_reservations is
  'Jobs/streams an engine was admitted to run. Open ones hold est_tokens + fee_tokens and count toward concurrency.';

-- ── helpers ────────────────────────────────────────────────────────────
create or replace function public.usage_period_start(p_at timestamptz default now())
returns timestamptz language sql immutable as $$
  select date_trunc('month', p_at at time zone 'UTC') at time zone 'UTC'
$$;

-- Closes reservations nobody settled in time, so a crashed engine can't
-- hold a user's tokens or concurrency slots forever.
create or replace function public.expire_usage_reservations(p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.usage_reservations
     set status = 'expired', settled_at = now()
   where user_id = p_user_id and status = 'open' and expires_at <= now()
$$;

create or replace function public.usage_balance(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_period timestamptz := public.usage_period_start();
  v_used bigint;
  v_reserved bigint;
  v_bonus bigint;
begin
  perform public.expire_usage_reservations(p_user_id);
  select coalesce(sum(billable_tokens), 0) into v_used
    from public.usage_events
   where user_id = p_user_id and occurred_at >= v_period;
  -- An open reservation holds its estimate minus what its job has already
  -- reported, so a running job isn't counted twice.
  select coalesce(sum(greatest(0, r.est_tokens - coalesce(s.spent, 0)) + r.fee_tokens), 0)
    into v_reserved
    from public.usage_reservations r
    left join lateral (
      select sum(e.billable_tokens) as spent
        from public.usage_events e
       where e.reservation_id = r.id
    ) s on true
   where r.user_id = p_user_id and r.status = 'open';
  select coalesce(token_bonus_balance, 0) into v_bonus
    from public.profiles where id = p_user_id;
  return jsonb_build_object(
    'used', v_used,
    'reserved', v_reserved,
    'bonus', coalesce(v_bonus, 0),
    'period_start', v_period
  );
end;
$$;

-- ── admit ──────────────────────────────────────────────────────────────
-- p_caps carries the tier's numbers from src/lib/billing/tiers.ts (the
-- source of truth for amounts); this function only does the counting that
-- has to be atomic. Per-item caps (upload size, video length, storage) are
-- checked in TypeScript before this is called.
--   { allocation, unlimited, jobs_per_month, minutes_per_month,
--     max_concurrent_jobs, active_streams, streams_per_month }
-- A cap of -1 means "no cap".
create or replace function public.admit_usage(
  p_user_id uuid,
  p_engine_id uuid,
  p_external_job_id text,
  p_class text,
  p_operation text,
  p_lane text,
  p_est_tokens bigint,
  p_fee_tokens bigint,
  p_source_minutes numeric,
  p_upload_mb numeric,
  p_ttl_seconds integer,
  p_caps jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_period timestamptz := public.usage_period_start();
  v_unlimited boolean := coalesce((p_caps->>'unlimited')::boolean, false);
  v_existing public.usage_reservations;
  v_running int;
  v_count int;
  v_minutes numeric;
  v_balance jsonb;
  v_remaining bigint;
  v_cap bigint;
  v_id uuid;
begin
  -- One admission at a time per user: the counts below and the insert
  -- that follows must see each other.
  perform pg_advisory_xact_lock(hashtextextended('admit:' || p_user_id::text, 0));
  perform public.expire_usage_reservations(p_user_id);

  select * into v_existing from public.usage_reservations
   where engine_id = p_engine_id and external_job_id = p_external_job_id;

  if found and v_existing.status <> 'open' then
    return jsonb_build_object('allowed', false, 'reason', 'already_settled',
                              'reservation_id', v_existing.id);
  end if;

  if not v_unlimited then
    v_cap := coalesce((p_caps->>(case when p_class = 'stream' then 'active_streams' else 'max_concurrent_jobs' end))::bigint, -1);
    select count(*) into v_running from public.usage_reservations
     where user_id = p_user_id and class = p_class and status = 'open'
       and id is distinct from v_existing.id;
    if v_cap = 0 and p_class = 'stream' then
      return jsonb_build_object('allowed', false, 'reason', 'streams_cap');
    end if;
    if v_cap >= 0 and v_running >= v_cap then
      return jsonb_build_object('allowed', false, 'reason', 'concurrency', 'running', v_running, 'cap', v_cap);
    end if;

    -- Monthly counts: everything admitted this period that wasn't
    -- abandoned before it ran (failed jobs still consumed resources).
    select count(*), coalesce(sum(source_minutes), 0) into v_count, v_minutes
      from public.usage_reservations
     where user_id = p_user_id and class = p_class and created_at >= v_period
       and status <> 'cancelled' and id is distinct from v_existing.id;

    v_cap := coalesce((p_caps->>(case when p_class = 'stream' then 'streams_per_month' else 'jobs_per_month' end))::bigint, -1);
    if v_cap >= 0 and v_count >= v_cap then
      return jsonb_build_object('allowed', false,
        'reason', case when p_class = 'stream' then 'streams_cap' else 'jobs_cap' end,
        'used', v_count, 'cap', v_cap);
    end if;

    v_cap := coalesce((p_caps->>'minutes_per_month')::bigint, -1);
    if v_cap >= 0 and p_class = 'job' and v_minutes + p_source_minutes > v_cap then
      return jsonb_build_object('allowed', false, 'reason', 'minutes_cap',
                                'used', v_minutes, 'cap', v_cap);
    end if;
  end if;

  -- Re-admitting the same job replaces its numbers, so release its old hold
  -- before measuring the balance.
  if v_existing.id is not null then
    update public.usage_reservations set est_tokens = 0, fee_tokens = 0 where id = v_existing.id;
  end if;

  v_balance := public.usage_balance(p_user_id);
  v_remaining := coalesce((p_caps->>'allocation')::bigint, 0)
               + (v_balance->>'bonus')::bigint
               - (v_balance->>'used')::bigint
               - (v_balance->>'reserved')::bigint;

  if not v_unlimited and v_remaining < p_est_tokens + p_fee_tokens then
    if v_existing.id is not null then
      -- Put the old hold back; the job is not re-admitted.
      update public.usage_reservations
         set est_tokens = v_existing.est_tokens, fee_tokens = v_existing.fee_tokens
       where id = v_existing.id;
    end if;
    return jsonb_build_object('allowed', false, 'reason', 'no_tokens',
                              'remaining', greatest(0, v_remaining),
                              'needed', p_est_tokens + p_fee_tokens);
  end if;

  if v_existing.id is not null then
    update public.usage_reservations
       set est_tokens = p_est_tokens, fee_tokens = p_fee_tokens,
           source_minutes = p_source_minutes, upload_mb = p_upload_mb,
           lane = p_lane, operation = coalesce(p_operation, operation),
           ttl_seconds = p_ttl_seconds,
           expires_at = now() + make_interval(secs => p_ttl_seconds)
     where id = v_existing.id
     returning id into v_id;
  else
    insert into public.usage_reservations
      (user_id, engine_id, external_job_id, class, operation, lane,
       est_tokens, fee_tokens, source_minutes, upload_mb, ttl_seconds, expires_at)
    values
      (p_user_id, p_engine_id, p_external_job_id, p_class, p_operation, p_lane,
       p_est_tokens, p_fee_tokens, p_source_minutes, p_upload_mb, p_ttl_seconds,
       now() + make_interval(secs => p_ttl_seconds))
    returning id into v_id;
  end if;

  return jsonb_build_object('allowed', true, 'reservation_id', v_id, 'lane', p_lane,
                            'fee_tokens', p_fee_tokens);
end;
$$;

-- ── settle ─────────────────────────────────────────────────────────────
create or replace function public.settle_usage_reservation(
  p_reservation_id uuid,
  p_engine_id uuid,
  p_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.usage_reservations;
begin
  if p_outcome not in ('succeeded', 'failed', 'cancelled', 'heartbeat') then
    return jsonb_build_object('ok', false, 'error', 'invalid outcome');
  end if;

  select * into r from public.usage_reservations
   where id = p_reservation_id and engine_id = p_engine_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not found');
  end if;

  if r.status <> 'open' then
    -- Settling twice is a no-op; a heartbeat on a closed one tells the
    -- engine to stop.
    return jsonb_build_object('ok', p_outcome <> 'heartbeat', 'status', r.status, 'already', true);
  end if;

  if p_outcome = 'heartbeat' then
    update public.usage_reservations
       set expires_at = now() + make_interval(secs => r.ttl_seconds)
     where id = r.id;
    return jsonb_build_object('ok', true, 'status', 'open');
  end if;

  update public.usage_reservations
     set status = p_outcome, settled_at = now()
   where id = r.id;

  -- The boost fee is only for a job that ran to the end. It is already a
  -- price, so usage_billable_tokens bills it at cost / 4 = exactly fee_tokens,
  -- with no margin on top.
  if p_outcome = 'succeeded' and r.fee_tokens > 0 then
    insert into public.usage_events
      (user_id, engine_id, kind, amount, source_id, occurred_at, operation,
       provider, cost_usd_micros, reservation_id, metadata)
    values
      (r.user_id, r.engine_id, 'boost.fee', 1, 'boostfee_' || r.id::text, now(),
       r.operation, 'chalyb', r.fee_tokens * 4, r.id,
       jsonb_build_object('lane', r.lane))
    on conflict (engine_id, source_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'status', p_outcome);
end;
$$;

revoke all on function public.expire_usage_reservations(uuid) from public;
revoke all on function public.usage_balance(uuid) from public;
revoke all on function public.admit_usage(uuid, uuid, text, text, text, text, bigint, bigint, numeric, numeric, integer, jsonb) from public;
revoke all on function public.settle_usage_reservation(uuid, uuid, text) from public;
grant execute on function public.usage_balance(uuid) to service_role;
grant execute on function public.admit_usage(uuid, uuid, text, text, text, text, bigint, bigint, numeric, numeric, integer, jsonb) to service_role;
grant execute on function public.settle_usage_reservation(uuid, uuid, text) to service_role;

-- ── royalties and platform stats on the same unit ──────────────────────
-- Partners are paid on billable_tokens of every meter their engine charged
-- (transcription included), except the boost fee, which is the platform's.
create or replace function public.compute_engine_royalties(
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns table (
  engine_id uuid,
  partner_user_id uuid,
  tokens_attributed bigint,
  amount_cents bigint,
  rate_per_million_cents integer
)
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
begin
  return query
  select
    e.id,
    e.owner_user_id,
    coalesce(sum(u.billable_tokens), 0)::bigint,
    floor(coalesce(sum(u.billable_tokens), 0) * e.partner_royalty_per_million_tokens_cents / 1000000.0)::bigint,
    e.partner_royalty_per_million_tokens_cents
  from public.engines e
  left join public.usage_events u
    on u.engine_id = e.id
   and u.kind <> 'boost.fee'
   and u.occurred_at >= p_period_start
   and u.occurred_at <  p_period_end
  where e.partner_royalty_per_million_tokens_cents > 0
    and e.owner_user_id is not null
  group by e.id, e.owner_user_id, e.partner_royalty_per_million_tokens_cents;
end;
$$;

create or replace function public.compute_platform_token_stats(
  p_period_start timestamptz,
  p_week_start timestamptz
)
returns table (
  scope text,
  engine_id uuid,
  engine_slug text,
  engine_name text,
  tokens bigint,
  active_users bigint
)
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
begin
  return query
  select 'all_time'::text, null::uuid, null::text, null::text,
         coalesce(sum(billable_tokens), 0)::bigint, count(distinct user_id)::bigint
    from public.usage_events
  union all
  select 'month'::text, null::uuid, null::text, null::text,
         coalesce(sum(billable_tokens), 0)::bigint, count(distinct user_id)::bigint
    from public.usage_events where occurred_at >= p_period_start
  union all
  select 'week'::text, null::uuid, null::text, null::text,
         coalesce(sum(billable_tokens), 0)::bigint, count(distinct user_id)::bigint
    from public.usage_events where occurred_at >= p_week_start
  union all
  select 'per_engine'::text, u.engine_id, e.slug, e.name,
         coalesce(sum(u.billable_tokens), 0)::bigint, count(distinct u.user_id)::bigint
    from public.usage_events u
    join public.engines e on e.id = u.engine_id
   where u.occurred_at >= p_period_start
   group by u.engine_id, e.slug, e.name;
end;
$$;
