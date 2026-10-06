-- =====================================================================
-- Chalyb — per-engine usage metrics in one aggregate.
--
-- The engine detail page read this month's usage_events (capped at 2000
-- rows) and the lifetime/7-day ones (silently capped at PostgREST's 1000)
-- and summed in Node, counting llm.tokens only. Past a couple of thousand
-- events a month every total, top user and cost on that page was low, and
-- transcription/compute spend never showed at all.
--
-- engine_usage_metrics() sums every meter in the billing unit
-- (billable_tokens, migration 0046) and the real provider cost the engine
-- reported (cost_usd_micros), so the cost figure is what we actually paid
-- rather than tokens × a configured rate.
--
-- Idempotent.
-- =====================================================================

create or replace function public.engine_usage_metrics(
  p_engine_id uuid,
  p_month_start timestamptz,
  p_week_start timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
  with month as (
    select user_id, kind, operation, billable_tokens, cost_usd_micros
      from public.usage_events
     where engine_id = p_engine_id and occurred_at >= p_month_start
  )
  select jsonb_build_object(
    'month', (select jsonb_build_object(
        'billable', coalesce(sum(billable_tokens), 0),
        'cost_usd_micros', coalesce(sum(cost_usd_micros), 0),
        -- Events with no reported cost: priced by the engine's configured
        -- rate instead, so legacy engines still show a cost.
        'billable_without_cost', coalesce(sum(billable_tokens) filter (where cost_usd_micros is null), 0),
        'users', count(distinct user_id)
      ) from month),
    'lifetime', (select coalesce(sum(billable_tokens), 0) from public.usage_events where engine_id = p_engine_id),
    'week', (select coalesce(sum(billable_tokens), 0) from public.usage_events
              where engine_id = p_engine_id and occurred_at >= p_week_start),
    'by_operation', coalesce((select jsonb_agg(o order by o.tokens desc) from (
        select coalesce(operation, kind) as operation, sum(billable_tokens) as tokens, count(*) as calls
          from month group by 1
      ) o), '[]'::jsonb),
    'top_users', coalesce((select jsonb_agg(u order by u.tokens desc) from (
        select user_id, sum(billable_tokens) as tokens,
               coalesce(sum(cost_usd_micros), 0) as cost_usd_micros,
               coalesce(sum(billable_tokens) filter (where cost_usd_micros is null), 0) as billable_without_cost
          from month group by user_id order by 2 desc limit 10
      ) u), '[]'::jsonb)
  )
$$;

revoke all on function public.engine_usage_metrics(uuid, timestamptz, timestamptz) from public;
grant execute on function public.engine_usage_metrics(uuid, timestamptz, timestamptz) to service_role;
