-- =====================================================================
-- Chalyb — a payment row says WHAT was bought.
--
-- WHY
-- `payments` had one column for the product: `tier`. It works for a plan
-- purchase, where the tier IS the product. It is a lie for a token pack:
-- settleOneOffCharge writes the buyer's CURRENT tier there, because the
-- pack does not change the plan. So a $149 pack bought by a Free user was
-- stored as `tier = 'FREE'` and rendered on /app/billing as
--
--     Plan Free · Aprobado · $149.00
--
-- — a plan the user never bought, at a price no plan costs. The admin P&L
-- read the same rows and counted that buyer under "clientes que pagan · 0
-- Pro · 0 VIP" while still adding the $149 to gross revenue, so the two
-- halves of the same card disagreed.
--
-- WHAT
-- `kind` names the product. `pack_id` and `tokens_granted` carry what a
-- pack row needs to describe itself without the UI having to reverse
-- engineer `raw->>'external_reference'`.
--
--   plan          a Pro/VIP purchase through the legacy one-off checkout
--   subscription  a recurring charge of a Mercado Pago preapproval
--   pack          a token top-up; the plan is untouched
--
-- Backfill reads what is already on the row: a preapproval id means it was
-- recurring, a `pack|<user>|<pack>` external reference means it was a pack,
-- and everything else was a one-off plan purchase.
--
-- Idempotent: re-runnable.
-- =====================================================================

alter table public.payments
  add column if not exists kind text not null default 'plan';

alter table public.payments
  add column if not exists pack_id text;

alter table public.payments
  add column if not exists tokens_granted bigint;

-- Backfill BEFORE the check constraint so an existing row can never block it.
update public.payments
   set kind = 'subscription'
 where kind = 'plan'
   and mp_preapproval_id is not null;

update public.payments
   set kind    = 'pack',
       pack_id = nullif(split_part(raw ->> 'external_reference', '|', 3), '')
 where kind = 'plan'
   and raw ->> 'external_reference' like 'pack|%';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_kind_check'
  ) then
    alter table public.payments
      add constraint payments_kind_check
      check (kind in ('plan', 'subscription', 'pack'));
  end if;
end $$;

-- The "dinero hoy" / "dinero del mes" queries in src/lib/billing/money-data.ts
-- filter on status and slice by created_at. One index serves both.
create index if not exists payments_status_created_idx
  on public.payments (status, created_at desc);

comment on column public.payments.kind is
  'What was bought: plan (one-off tier purchase) | subscription (recurring preapproval charge) | pack (token top-up, plan unchanged). The `tier` column is the target tier for a plan/subscription and the buyer''s CURRENT tier for a pack — read `kind` before believing it.';
comment on column public.payments.pack_id is
  'TOKEN_PACKS id (pricing.ts) when kind = ''pack''. NULL otherwise.';
comment on column public.payments.tokens_granted is
  'Tokens credited by this payment when kind = ''pack''. NULL otherwise.';
