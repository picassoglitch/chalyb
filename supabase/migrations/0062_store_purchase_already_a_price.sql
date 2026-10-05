-- =====================================================================
-- Chalyb — store.purchase is already a price (Chalito's cosmetics store).
--
-- An engine that sells an in-app item paid from the user's token balance
-- reports it as one `store.purchase` event whose cost_usd_micros IS the
-- price (price in billable tokens × 4). Like `boost.fee`, it must be billed
-- as ceil(cost_usd_micros / 4), with no margin on top: the engine already
-- set the price, and adding the margin would charge the user more than the
-- price they were shown.
--
-- Same function as 0046, one more kind in the first branch. Applies to rows
-- written from now on (billable_tokens is computed on insert and frozen).
-- Idempotent.
-- =====================================================================

create or replace function public.usage_billable_tokens(
  p_kind text, p_amount bigint, p_cost_usd_micros bigint, p_margin_percent numeric
) returns bigint language sql immutable as $$
  select greatest(1, case
    when p_kind in ('boost.fee', 'store.purchase') and p_cost_usd_micros is not null
      then ceil(p_cost_usd_micros / 4.0)
    when p_cost_usd_micros is not null
      then ceil(p_cost_usd_micros * (100 + p_margin_percent) / 400.0)
    when p_kind = 'llm.tokens'
      then ceil(p_amount * (100 + p_margin_percent) / 100.0)
    else 1
  end)::bigint
$$;
