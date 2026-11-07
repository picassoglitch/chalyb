-- Chalyb — a failed job without output doesn't use up the month (owner,
-- 2026-11-07). A job reservation the engine settled 'failed' AND reported
-- outputs = 0 (no clips) stops counting toward jobs and minutes, for the
-- month's first 3 such runs; the 4th and later count again, so failing on
-- purpose can't buy unlimited runs. A failure settled without `outputs`
-- (older engines) or with outputs > 0 still counts: the hub can't tell it
-- made nothing. Mirrors ChalyClip #109's Free rule. Tokens a failed run
-- used stay charged. Streams are unchanged. admit_usage is the same as
-- 20261107000100 otherwise; grants are kept by create or replace.

-- What the run delivered (clips, files…), as the engine reported at settle.
-- null = not reported.
alter table public.usage_reservations
  add column if not exists outputs integer check (outputs >= 0);

-- settle with the output count. A separate 4-argument function (no default)
-- so the 3-argument one old clients call stays unambiguous through PostgREST.
create or replace function public.settle_usage_reservation(
  p_reservation_id uuid,
  p_engine_id uuid,
  p_outcome text,
  p_outputs integer
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
  if p_outputs < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid outputs');
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
     set status = p_outcome, settled_at = now(), outputs = p_outputs
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

-- The old call: no output count reported, so a failure keeps counting.
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
begin
  return public.settle_usage_reservation(p_reservation_id, p_engine_id, p_outcome, null::integer);
end;
$$;

-- Server-only, like the 3-argument one (0046, 0064).
revoke all on function public.settle_usage_reservation(uuid, uuid, text, integer) from public;
revoke execute on function public.settle_usage_reservation(uuid, uuid, text, integer) from anon, authenticated;
grant execute on function public.settle_usage_reservation(uuid, uuid, text, integer) to service_role;

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

    -- Monthly counts: everything admitted this period that wasn't abandoned
    -- before it ran (cancelled, or expired without reporting any usage),
    -- minus the month's first 3 jobs that failed with no output: nothing
    -- was delivered, so the person can retry. The 4th on counts (anti-abuse).
    -- outputs null (not reported) counts.
    select count(*), coalesce(sum(c.source_minutes), 0) into v_count, v_minutes
      from (
        select r.source_minutes,
               r.class = 'job' and r.status = 'failed' and coalesce(r.outputs = 0, false) as free_retry,
               row_number() over (
                 partition by r.class = 'job' and r.status = 'failed' and coalesce(r.outputs = 0, false)
                 order by r.created_at, r.id) as nth
          from public.usage_reservations r
         where r.user_id = p_user_id and r.class = p_class and r.created_at >= v_period
           and r.status <> 'cancelled' and r.id is distinct from v_existing.id
           and not (r.status = 'expired' and not exists (
                 select 1 from public.usage_events e where e.reservation_id = r.id))
      ) c
     where not (c.free_retry and c.nth <= 3);

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
