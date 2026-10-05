-- =====================================================================
-- Chalyb — credit-pack prices as an owner setting (owner, 2026-10-04/05).
--
--   app_settings.pack_prices   {"ivaMode": "included" | "add",
--                                "ivaRatePercent": 0–50 (whole),
--                                "prices": {"tokens_100k": centavos,
--                                           "tokens_500k": centavos,
--                                           "tokens_2m":   centavos}}
--
-- Edited in Dueño → Ajustes (audit-logged by the app). "included": each
-- price is the total the customer pays; "add": the rate is added on top.
-- The store, the checkout, the amount sent to Mercado Pago, the webhook's
-- price gate and /legal/packs all read this one row. A missing or invalid
-- row closes pack checkout (the app never falls back to a default charge).
--
-- Seeds the defaults: $149 / $599 / $1,999 MXN, IVA included — the same
-- values as DEFAULT_PACK_PRICING in src/config/pack-pricing.ts. An existing
-- row is never overwritten.
--
-- Idempotent.
-- =====================================================================

create or replace function public.pack_prices_valid(v jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  k text;
  n numeric;
begin
  if v is null or jsonb_typeof(v) <> 'object' then
    return false;
  end if;
  if coalesce(v ->> 'ivaMode', '') not in ('included', 'add') then
    return false;
  end if;
  if jsonb_typeof(v -> 'ivaRatePercent') is distinct from 'number' then
    return false;
  end if;
  n := (v ->> 'ivaRatePercent')::numeric;
  if n < 0 or n > 50 or n <> trunc(n) then
    return false;
  end if;
  if jsonb_typeof(v -> 'prices') is distinct from 'object' then
    return false;
  end if;
  foreach k in array array['tokens_100k', 'tokens_500k', 'tokens_2m'] loop
    if jsonb_typeof(v -> 'prices' -> k) is distinct from 'number' then
      return false;
    end if;
    n := (v -> 'prices' ->> k)::numeric;
    -- $1 to $100,000 MXN, whole centavos (MIN/MAX_PACK_CENTS).
    if n < 100 or n > 10000000 or n <> trunc(n) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- Server-only (0064's rule): Supabase grants new public functions to anon
-- and authenticated directly, so revoke from them by name, not just PUBLIC.
revoke all on function public.pack_prices_valid(jsonb) from public;
revoke execute on function public.pack_prices_valid(jsonb) from anon, authenticated;
grant execute on function public.pack_prices_valid(jsonb) to service_role;

insert into public.app_settings (key, value)
values (
  'pack_prices',
  '{"ivaMode": "included", "ivaRatePercent": 16, "prices": {"tokens_100k": 14900, "tokens_500k": 59900, "tokens_2m": 199900}}'::jsonb
)
on conflict (key) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'app_settings_pack_prices_valid'
       and conrelid = 'public.app_settings'::regclass
  ) then
    alter table public.app_settings
      add constraint app_settings_pack_prices_valid
      check (key <> 'pack_prices' or public.pack_prices_valid(value));
  end if;
end;
$$;

comment on function public.pack_prices_valid(jsonb) is
  'Shape of app_settings.pack_prices (credit-pack prices, migration 0066). Mirrors parsePackPricing in src/config/pack-pricing.ts.';
