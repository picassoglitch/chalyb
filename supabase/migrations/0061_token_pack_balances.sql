-- =====================================================================
-- Chalyb — credit packs spend down once, per pack (Términos de los Paquetes
-- de Créditos §4, §5, §7, §8).
--
-- WHAT WAS WRONG
--   remaining = monthly_allocation + profiles.token_bonus_balance − monthlyUsed
-- token_bonus_balance was never decremented and monthlyUsed resets on the
-- 1st, so a pack acted as a permanent monthly extra (§4.2 says the opposite).
-- A refund or chargeback took the WHOLE pack off the single balance, from
-- other packs too (0038), and a dispute changed nothing.
--
-- WHAT THIS DOES
--   * Each token_pack_purchases row is a pack with its own tokens_remaining
--     and a status: active · held (disputed, §8.2) · removed (refunded or
--     lost dispute) · merged (bought before this migration; its unused
--     credits live in the user's one 'legacy' row, see below).
--   * Usage draws the month's plan allocation first; the part of each usage
--     event above it comes off active packs, oldest first (§4.2–4.3), once,
--     recorded in token_pack_draws. Packs never expire (§5.1).
--   * usage_balance() reports bonus = unused credits in active packs and
--     held = unused credits in held packs. Remaining for admission is
--       max(0, allocation − used this month) + bonus − reserved.
--   * clawback_token_pack() removes only that pack's unused credits (§7.2).
--     hold_token_pack() / release_token_pack() set aside and give back a
--     disputed pack's unused credits (§8.2–8.3).
--   * profiles.token_bonus_balance stays as a mirror of active + held, kept
--     by these functions, for the screens and audit lines that read it.
--
-- THE MONTH'S ALLOCATION lives in TypeScript (TIER_CAPS). admit_usage gets it
-- in p_caps and records it in usage_allocations; recordUsageEvents records it
-- before inserting events (set_usage_allocation). When none is on file for a
-- user, an event draws nothing: it never takes credits the code can't justify.
--
-- BACKFILL (first run only): existing bonus balances become one 'legacy' pack
-- per user, the oldest. Pre-existing purchases are 'merged'. A refund or
-- dispute of a merged purchase first claims up to its size from the legacy
-- row, then acts on that.
--
-- Idempotent: re-runnable.
-- =====================================================================

-- ── packs ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'token_pack_purchases'
       and column_name = 'tokens_remaining'
  ) then
    alter table public.token_pack_purchases
      add column tokens_remaining bigint,
      add column status text,
      add column tokens_removed bigint not null default 0,
      add column held_at timestamptz,
      add column released_at timestamptz,
      add column removed_at timestamptz;

    alter table public.token_pack_purchases
      drop constraint if exists token_pack_purchases_source_check;
    alter table public.token_pack_purchases
      add constraint token_pack_purchases_source_check
      check (source in ('mp_payment', 'admin_grant', 'promo', 'legacy'));

    -- Everything bought so far: its credits are in the aggregate balance.
    execute $b$
      update public.token_pack_purchases
         set tokens_remaining = 0, status = 'merged'
       where tokens_remaining is null
    $b$;

    -- One legacy pack per user holding what the old balance said, ordered
    -- before every other pack so it is spent first.
    execute $b$
      insert into public.token_pack_purchases
        (user_id, tokens_granted, source, tokens_remaining, status, created_at)
      select p.id, p.token_bonus_balance, 'legacy', p.token_bonus_balance, 'active',
             coalesce((select min(t.created_at) from public.token_pack_purchases t
                        where t.user_id = p.id), now()) - interval '1 second'
        from public.profiles p
        join auth.users u on u.id = p.id
       where coalesce(p.token_bonus_balance, 0) > 0
    $b$;
  end if;
end $$;

alter table public.token_pack_purchases
  alter column tokens_remaining set default 0,
  alter column tokens_remaining set not null,
  alter column status set default 'active',
  alter column status set not null;

alter table public.token_pack_purchases
  drop constraint if exists token_pack_purchases_remaining_check;
alter table public.token_pack_purchases
  add constraint token_pack_purchases_remaining_check
  check (tokens_remaining >= 0 and tokens_remaining <= tokens_granted and tokens_removed >= 0);

alter table public.token_pack_purchases
  drop constraint if exists token_pack_purchases_status_check;
alter table public.token_pack_purchases
  add constraint token_pack_purchases_status_check
  check (status in ('active', 'held', 'removed', 'merged'));

create index if not exists token_pack_purchases_spend_idx
  on public.token_pack_purchases (user_id, created_at, id)
  where status = 'active' and tokens_remaining > 0;

comment on column public.token_pack_purchases.tokens_remaining is
  'Unused credits of this pack. Usage draws it oldest first (token_pack_draws); a refund or lost dispute zeroes it (tokens_removed).';
comment on column public.token_pack_purchases.status is
  'active: spendable · held: disputed, set aside (§8.2) · removed: refunded or dispute lost · merged: bought before 0061, credits in the legacy row.';

-- ── draws ledger ──────────────────────────────────────────────────────
create table if not exists public.token_pack_draws (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  pack_id uuid not null references public.token_pack_purchases on delete cascade,
  usage_event_id uuid references public.usage_events on delete set null,
  tokens bigint not null check (tokens > 0),
  created_at timestamptz not null default now()
);
create index if not exists token_pack_draws_pack_idx on public.token_pack_draws (pack_id);
create index if not exists token_pack_draws_user_idx on public.token_pack_draws (user_id, created_at desc);

alter table public.token_pack_draws enable row level security;
drop policy if exists token_pack_draws_select_self on public.token_pack_draws;
create policy token_pack_draws_select_self on public.token_pack_draws
  for select using (auth.uid() = user_id);
drop policy if exists token_pack_draws_select_admins on public.token_pack_draws;
create policy token_pack_draws_select_admins on public.token_pack_draws
  for select using (public.is_admin());

comment on table public.token_pack_draws is
  'Credits each usage event took from each pack, once (Paquetes §4.2). Written by draw_pack_credits_on_usage.';

-- ── the month''s allocation, as the server last computed it ───────────
create table if not exists public.usage_allocations (
  user_id uuid not null references auth.users on delete cascade,
  period_start timestamptz not null,
  allocation bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);
alter table public.usage_allocations enable row level security;

create or replace function public.set_usage_allocation(p_user_id uuid, p_allocation bigint)
returns void language sql security definer set search_path = public as $$
  insert into public.usage_allocations (user_id, period_start, allocation)
  values (p_user_id, public.usage_period_start(), p_allocation)
  on conflict (user_id, period_start)
  do update set allocation = excluded.allocation, updated_at = now()
$$;

-- ── usage events: which ones already drew from packs ─────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'usage_events'
       and column_name = 'packs_settled_at'
  ) then
    alter table public.usage_events add column packs_settled_at timestamptz;
    -- Usage before this migration is already reflected in the legacy rows.
    execute 'update public.usage_events set packs_settled_at = occurred_at';
  end if;
end $$;

comment on column public.usage_events.packs_settled_at is
  'When this event''s share above the month''s allocation was drawn from packs (or found to need none).';

-- ── mirror ────────────────────────────────────────────────────────────
create or replace function public.refresh_token_bonus_balance(p_user_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v bigint;
begin
  select coalesce(sum(tokens_remaining), 0) into v
    from public.token_pack_purchases
   where user_id = p_user_id and status in ('active', 'held');
  update public.profiles set token_bonus_balance = v where id = p_user_id;
  return v;
end;
$$;

-- ── draw on usage ─────────────────────────────────────────────────────
create or replace function public.draw_pack_credits_on_usage()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_period timestamptz := public.usage_period_start(new.occurred_at);
  v_alloc bigint;
  v_used bigint;
  v_need bigint;
  v_take bigint;
  v_drew boolean := false;
  p record;
begin
  -- Nothing to draw (most users own no pack): skip the month's sum and the
  -- lock. A pack bought later never pays for usage from before it existed.
  if coalesce(new.billable_tokens, 0) <= 0
     or not exists (
       select 1 from public.token_pack_purchases
        where user_id = new.user_id and status = 'active' and tokens_remaining > 0)
  then
    update public.usage_events set packs_settled_at = now() where id = new.id;
    return null;
  end if;

  -- One drawer per user at a time; grants, holds and clawbacks take the same lock.
  perform pg_advisory_xact_lock(hashtextextended('packs:' || new.user_id::text, 0));

  select allocation into v_alloc from public.usage_allocations
   where user_id = new.user_id and period_start = v_period;
  if v_alloc is null then
    select allocation into v_alloc from public.usage_allocations
     where user_id = new.user_id order by period_start desc limit 1;
  end if;

  if v_alloc is not null and v_alloc >= 0 then
    -- Usage of the month already accounted for (rows whose draw ran).
    select coalesce(sum(billable_tokens), 0) into v_used
      from public.usage_events
     where user_id = new.user_id
       and occurred_at >= v_period
       and occurred_at < v_period + interval '1 month'
       and packs_settled_at is not null
       and id <> new.id;
    v_need := least(new.billable_tokens,
                    greatest(0, v_used + new.billable_tokens - greatest(v_alloc, v_used)));

    for p in
      select id, tokens_remaining from public.token_pack_purchases
       where user_id = new.user_id and status = 'active' and tokens_remaining > 0
       order by created_at, id
       for update
    loop
      exit when v_need <= 0;
      v_take := least(p.tokens_remaining, v_need);
      update public.token_pack_purchases
         set tokens_remaining = tokens_remaining - v_take
       where id = p.id;
      insert into public.token_pack_draws (user_id, pack_id, usage_event_id, tokens)
      values (new.user_id, p.id, new.id, v_take);
      v_need := v_need - v_take;
      v_drew := true;
    end loop;
  end if;

  update public.usage_events set packs_settled_at = now() where id = new.id;
  if v_drew then
    perform public.refresh_token_bonus_balance(new.user_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_usage_events_draw_packs on public.usage_events;
create trigger trg_usage_events_draw_packs
  after insert on public.usage_events
  for each row execute function public.draw_pack_credits_on_usage();

-- ── balance ───────────────────────────────────────────────────────────
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
  v_held bigint;
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
  select coalesce(sum(tokens_remaining) filter (where status = 'active'), 0),
         coalesce(sum(tokens_remaining) filter (where status = 'held'), 0)
    into v_bonus, v_held
    from public.token_pack_purchases
   where user_id = p_user_id;
  return jsonb_build_object(
    'used', v_used,
    'reserved', v_reserved,
    'bonus', v_bonus,
    'held', v_held,
    'period_start', v_period
  );
end;
$$;

-- ── admit (0046, with the pack-aware remaining) ──────────────────────
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
  v_allocation bigint := coalesce((p_caps->>'allocation')::bigint, 0);
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

  -- What this month's usage is measured against when it draws from packs.
  perform public.set_usage_allocation(
    p_user_id, case when v_unlimited then 9007199254740991 else v_allocation end);

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

  -- Plan credits left this month, then unused active pack credits (usage
  -- above the allocation has already been drawn from them), minus holds.
  v_balance := public.usage_balance(p_user_id);
  v_remaining := greatest(0, v_allocation - (v_balance->>'used')::bigint)
               + (v_balance->>'bonus')::bigint
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

-- ── grant (0033): a new active pack ──────────────────────────────────
create or replace function public.grant_token_pack(
  p_user_id       uuid,
  p_tokens        bigint,
  p_source        text,
  p_mp_payment_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance bigint;
begin
  if p_tokens is null or p_tokens <= 0 then
    raise exception 'grant_token_pack: tokens must be positive (got %)', p_tokens
      using errcode = '22023';
  end if;
  if p_source not in ('mp_payment', 'admin_grant', 'promo') then
    raise exception 'grant_token_pack: unknown source %', p_source
      using errcode = '22023';
  end if;

  if p_mp_payment_id is not null
     and exists (select 1 from public.token_pack_purchases where mp_payment_id = p_mp_payment_id)
  then
    return jsonb_build_object('ok', true, 'already_granted', true);
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'grant_token_pack: no profile for user %', p_user_id
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('packs:' || p_user_id::text, 0));

  insert into public.token_pack_purchases
    (user_id, tokens_granted, source, mp_payment_id, tokens_remaining, status)
  values (p_user_id, p_tokens, p_source, p_mp_payment_id, p_tokens, 'active');

  v_new_balance := public.refresh_token_bonus_balance(p_user_id);
  return jsonb_build_object('ok', true, 'already_granted', false, 'balance', v_new_balance);

exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'already_granted', true);
end;
$$;

-- ── admin adjustment (0033): a grant is a pack, a revoke spends oldest first
create or replace function public.adjust_token_bonus_balance(
  p_user_id uuid,
  p_delta   bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev bigint;
  v_next bigint;
  v_need bigint;
  v_take bigint;
  p record;
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('packs:' || p_user_id::text, 0));
  v_prev := public.refresh_token_bonus_balance(p_user_id);

  if p_delta > 0 then
    insert into public.token_pack_purchases
      (user_id, tokens_granted, source, tokens_remaining, status)
    values (p_user_id, p_delta, 'admin_grant', p_delta, 'active');
  elsif p_delta < 0 then
    v_need := -p_delta;
    for p in
      select id, tokens_remaining from public.token_pack_purchases
       where user_id = p_user_id and status = 'active' and tokens_remaining > 0
       order by created_at, id
       for update
    loop
      exit when v_need <= 0;
      v_take := least(p.tokens_remaining, v_need);
      update public.token_pack_purchases
         set tokens_remaining = tokens_remaining - v_take,
             tokens_removed = tokens_removed + v_take
       where id = p.id;
      v_need := v_need - v_take;
    end loop;
  end if;

  v_next := public.refresh_token_bonus_balance(p_user_id);
  return jsonb_build_object(
    'ok', true,
    'previous_balance', v_prev,
    'balance', v_next,
    'effective_delta', v_next - v_prev
  );
end;
$$;

-- ── a merged (pre-0061) purchase claims its share of the legacy row ──
create or replace function public.claim_legacy_credits(p_pack_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pack public.token_pack_purchases;
  v_legacy public.token_pack_purchases;
  v_take bigint;
begin
  select * into v_pack from public.token_pack_purchases where id = p_pack_id for update;
  if v_pack.status is distinct from 'merged' then
    return;
  end if;
  select * into v_legacy from public.token_pack_purchases
   where user_id = v_pack.user_id and source = 'legacy' and status = 'active'
   order by created_at limit 1
   for update;
  v_take := least(v_pack.tokens_granted, coalesce(v_legacy.tokens_remaining, 0));
  if v_take > 0 then
    update public.token_pack_purchases
       set tokens_remaining = tokens_remaining - v_take
     where id = v_legacy.id;
  end if;
  update public.token_pack_purchases
     set tokens_remaining = greatest(v_take, 0), status = 'active'
   where id = v_pack.id;
end;
$$;

-- ── refund / lost dispute: only this pack's unused credits (§7.2, §8.3) ─
create or replace function public.clawback_token_pack(
  p_mp_payment_id text,
  p_reason        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack public.token_pack_purchases;
  v_prev bigint;
  v_next bigint;
  v_removed bigint;
begin
  if p_reason not in ('refunded', 'charged_back') then
    raise exception 'clawback_token_pack: unknown reason %', p_reason
      using errcode = '22023';
  end if;

  select * into v_pack from public.token_pack_purchases where mp_payment_id = p_mp_payment_id;
  if v_pack.id is null then
    return jsonb_build_object('ok', false, 'error', 'no_purchase');
  end if;

  if exists (select 1 from public.token_pack_clawbacks where mp_payment_id = p_mp_payment_id) then
    return jsonb_build_object('ok', true, 'already_clawed_back', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('packs:' || v_pack.user_id::text, 0));
  v_prev := public.refresh_token_bonus_balance(v_pack.user_id);
  perform public.claim_legacy_credits(v_pack.id);

  select * into v_pack from public.token_pack_purchases where id = v_pack.id for update;
  v_removed := case when v_pack.status = 'removed' then 0 else v_pack.tokens_remaining end;
  update public.token_pack_purchases
     set tokens_remaining = 0,
         tokens_removed = tokens_removed + v_removed,
         status = 'removed',
         removed_at = coalesce(removed_at, now())
   where id = v_pack.id;

  insert into public.token_pack_clawbacks (user_id, mp_payment_id, tokens_granted, tokens_removed, reason)
  values (v_pack.user_id, p_mp_payment_id, v_pack.tokens_granted, v_removed, p_reason);

  v_next := public.refresh_token_bonus_balance(v_pack.user_id);
  return jsonb_build_object(
    'ok', true,
    'already_clawed_back', false,
    'user_id', v_pack.user_id,
    'tokens_granted', v_pack.tokens_granted,
    'tokens_removed', v_removed,
    'previous_balance', v_prev,
    'balance', v_next
  );

exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'already_clawed_back', true);
end;
$$;

comment on function public.clawback_token_pack(text, text) is
  'Removes the UNUSED credits of the pack a reversed Mercado Pago payment bought (Paquetes §7.2, §8.3). Other packs and used credits are untouched. Idempotent per mp_payment_id. Server-side only.';

-- ── dispute open: set this pack's unused credits aside (§8.2) ────────
create or replace function public.hold_token_pack(p_mp_payment_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pack public.token_pack_purchases;
begin
  select * into v_pack from public.token_pack_purchases where mp_payment_id = p_mp_payment_id;
  if v_pack.id is null then
    return jsonb_build_object('ok', false, 'error', 'no_purchase');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('packs:' || v_pack.user_id::text, 0));
  perform public.claim_legacy_credits(v_pack.id);
  select * into v_pack from public.token_pack_purchases where id = v_pack.id for update;
  if v_pack.status <> 'active' then
    return jsonb_build_object('ok', true, 'status', v_pack.status, 'already', true);
  end if;
  update public.token_pack_purchases
     set status = 'held', held_at = now()
   where id = v_pack.id;
  return jsonb_build_object('ok', true, 'status', 'held', 'user_id', v_pack.user_id,
                            'tokens_held', v_pack.tokens_remaining);
end;
$$;

-- ── dispute won by Chalyb: give the credits back (§8.3) ─────────────
create or replace function public.release_token_pack(p_mp_payment_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pack public.token_pack_purchases;
begin
  select * into v_pack from public.token_pack_purchases where mp_payment_id = p_mp_payment_id;
  if v_pack.id is null then
    return jsonb_build_object('ok', false, 'error', 'no_purchase');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('packs:' || v_pack.user_id::text, 0));
  update public.token_pack_purchases
     set status = 'active', released_at = now()
   where id = v_pack.id and status = 'held';
  if not found then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  return jsonb_build_object('ok', true, 'status', 'active', 'user_id', v_pack.user_id,
                            'tokens_released', v_pack.tokens_remaining);
end;
$$;

-- ── server only ───────────────────────────────────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.set_usage_allocation(uuid, bigint)',
    'public.refresh_token_bonus_balance(uuid)',
    'public.claim_legacy_credits(uuid)',
    'public.hold_token_pack(text)',
    'public.release_token_pack(text)',
    'public.usage_balance(uuid)',
    'public.admit_usage(uuid, uuid, text, text, text, text, bigint, bigint, numeric, numeric, integer, jsonb)',
    'public.grant_token_pack(uuid, bigint, text, text)',
    'public.adjust_token_bonus_balance(uuid, bigint)',
    'public.clawback_token_pack(text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
revoke all on function public.draw_pack_credits_on_usage() from public, anon, authenticated;
