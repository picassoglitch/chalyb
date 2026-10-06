-- 0052 · Pro Lealtad (all-pending WS-7; PRICING-CARDS-SPEC §15.5/§15.12;
-- Términos §4 bis). The plan key itself was added to the CHECKs by 0051.
--
--   subscriptions.loyalty_step            the schedule step of the NEXT charge
--                                         (0 = month 1 … 6 = month 7+)
--   subscriptions.loyalty_mp_amount_cents what Mercado Pago is set to charge
--                                         next (reconciled daily)
--   subscriptions.loyalty_reset_at        when the schedule was reset (the
--                                         subscription ended)
--   payments.loyalty_step                 the step a charge paid for
-- Idempotent.

alter table public.subscriptions
  add column if not exists loyalty_step smallint not null default 0,
  add column if not exists loyalty_mp_amount_cents integer,
  add column if not exists loyalty_reset_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_loyalty_step_check') then
    alter table public.subscriptions
      add constraint subscriptions_loyalty_step_check check (loyalty_step between 0 and 6);
  end if;
end $$;

alter table public.payments
  add column if not exists loyalty_step smallint;

comment on column public.subscriptions.loyalty_step is
  'Pro Lealtad: schedule step of the next charge (0 = month 1, 6 = month 7+). Never raised on a running preapproval.';
