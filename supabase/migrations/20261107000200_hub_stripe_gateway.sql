-- Chalyb — Stripe as a second payment gateway (PAYMENTS_PROVIDER=stripe).
--
-- Stripe rows reuse the existing ledgers so billing state, Mi plan, the cron
-- and Dinero read one place:
--   subscriptions.mp_preapproval_id  holds the Stripe subscription id (sub_…)
--   payments.mp_payment_id           holds the Stripe PaymentIntent id (pi_…)
-- Stripe ids carry a type prefix and Mercado Pago's never do, so the app tells
-- them apart without a lookup; `provider` makes it explicit for reports.
-- stripe_customers keeps the one Stripe Customer per user.
--
-- Additive only: the Mercado Pago code never writes `provider` (the default
-- covers it), so this can be applied before or after the deploy.
-- Idempotent: re-runnable.

alter table public.subscriptions
  add column if not exists provider text not null default 'mercadopago';
alter table public.payments
  add column if not exists provider text not null default 'mercadopago';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_provider_check') then
    alter table public.subscriptions
      add constraint subscriptions_provider_check check (provider in ('mercadopago', 'stripe'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_provider_check') then
    alter table public.payments
      add constraint payments_provider_check check (provider in ('mercadopago', 'stripe'));
  end if;
end $$;

-- A Stripe start that waited on 3DS is finished once: the finalize claims this
-- (… where start_finalized_at is null) before its side effects (proration refund).
alter table public.subscriptions
  add column if not exists start_finalized_at timestamptz;

comment on column public.subscriptions.provider is
  'Gateway that owns this subscription: mercadopago (mp_preapproval_id is a preapproval) or stripe (it is a sub_… id).';
comment on column public.payments.provider is
  'Gateway that took this charge: mercadopago, or stripe (mp_payment_id is a pi_… PaymentIntent id).';

create table if not exists public.stripe_customers (
  user_id uuid primary key references auth.users on delete cascade,
  customer_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.stripe_customers enable row level security;
-- No policies: only the service role (checkout, webhook) reads or writes it.
revoke all on table public.stripe_customers from anon, authenticated;

comment on table public.stripe_customers is
  'One Stripe Customer (cus_…) per user, created at their first Stripe checkout.';
