-- =====================================================================
-- Chalyb — recorded provider cost per model, for reconciliation.
--
-- The Dinero page compares what engines recorded (usage_events
-- .cost_usd_micros) with what the provider actually billed (Anthropic's
-- cost report). This sums the recorded side per provider and model for a
-- [start, end) window in one query.
--
-- Idempotent.
-- =====================================================================

create or replace function public.usage_cost_by_model(
  p_start timestamptz,
  p_end timestamptz
)
returns table (provider text, model text, events bigint, cost_usd_micros bigint, billable_tokens bigint)
language sql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
  select coalesce(u.provider, '—'),
         coalesce(u.metadata->>'model', '—'),
         count(*)::bigint,
         coalesce(sum(u.cost_usd_micros), 0)::bigint,
         coalesce(sum(u.billable_tokens), 0)::bigint
    from public.usage_events u
   where u.occurred_at >= p_start and u.occurred_at < p_end
   group by 1, 2
$$;

revoke all on function public.usage_cost_by_model(timestamptz, timestamptz) from public;
grant execute on function public.usage_cost_by_model(timestamptz, timestamptz) to service_role;
