-- =====================================================================
-- Chalyb — Mercado Pago subscriptions (recurring Pro / VIP billing).
--
-- WHY THIS EXISTS
-- Pro and VIP were sold through Checkout Pro as a ONE-OFF payment: the user
-- paid once, the webhook flipped profiles.tier, and nothing ever charged them
-- again. The subscription page still promised "se cobra solo". This table
-- backs the real thing: a Mercado Pago preapproval (their Subscriptions API)
-- that charges the card every month until someone cancels it.
--
-- One row per preapproval. The row is written when the checkout starts
-- (status 'pending'), then kept in sync with Mercado Pago by the webhook
-- (/api/mp/webhook, topics subscription_preapproval and
-- subscription_authorized_payment). Mercado Pago is the source of truth for
-- status and next_payment_date; this table is our copy of it so the app can
-- show a renewal date and cancel the right preapproval without a round-trip.
--
-- Lifecycle, as Mercado Pago reports it:
--   pending     created, the user has not authorised the card yet
--   authorized  active, charging every month  → profiles.tier = the row's tier
--   paused      a charge failed and retries ran out  → access ends at the
--               period already paid for
--   cancelled   the user (or we) cancelled it → same as paused
--
-- Idempotent: re-runnable.
-- =====================================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- The tier this subscription pays for. Only PRO and VIP are ever sold;
  -- PARTNER is admin-granted and FREE has no price.
  tier subscription_tier not null,
  -- Mercado Pago's preapproval id. UNIQUE so webhook retries and the
  -- create-then-sync race cannot produce two rows for one subscription.
  mp_preapproval_id text unique not null,
  -- What we put on the preapproval: "sub|<user_id>|<TIER>". Kept so a
  -- payment notification that only carries the reference can find its row.
  external_reference text not null,
  -- Mercado Pago's status, normalised to lowercase:
  -- pending | authorized | paused | cancelled
  status text not null,
  -- The monthly charge in MINOR units, and its currency. Copied from the
  -- preapproval's auto_recurring so the webhook can check it against the
  -- price list before granting anything.
  amount_cents integer not null,
  currency text not null default 'MXN',
  -- When Mercado Pago will next try to charge. This is the renewal date the
  -- user sees, and the end of the paid period when they cancel.
  next_payment_date timestamptz,
  -- Most recent approved recurring charge.
  last_charge_at timestamptz,
  -- When the subscription stopped (paused or cancelled), or null while active.
  ended_at timestamptz,
  -- Last preapproval payload from Mercado Pago, for audit. Contains payer
  -- email and ids — never select it in user-facing UI.
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_created_idx
  on public.subscriptions (user_id, created_at desc);

create index if not exists subscriptions_external_reference_idx
  on public.subscriptions (external_reference);

alter table public.subscriptions enable row level security;

-- Subscribers see their own subscriptions (the renewal date on
-- /app/subscription reads through this).
drop policy if exists "subscriptions_select_self" on public.subscriptions;
create policy "subscriptions_select_self"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Admins see everything, for /dashboard/billing.
drop policy if exists "subscriptions_select_admins" on public.subscriptions;
create policy "subscriptions_select_admins"
  on public.subscriptions for select
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies on purpose: only the service role (the
-- checkout action and the webhook) writes here.

drop trigger if exists trg_subscriptions_set_updated_at on public.subscriptions;
create trigger trg_subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.tg_payments_set_updated_at();

-- A recurring charge is still a payment: it lands in public.payments like the
-- one-off ones did, so /app/billing and the P&L keep working unchanged. This
-- column ties the charge back to its subscription.
alter table public.payments
  add column if not exists mp_preapproval_id text;

create index if not exists payments_mp_preapproval_id_idx
  on public.payments (mp_preapproval_id)
  where mp_preapproval_id is not null;

comment on table public.subscriptions is
  'One row per Mercado Pago preapproval (recurring Pro/VIP billing). Synced by /api/mp/webhook; Mercado Pago is the source of truth.';
comment on column public.payments.mp_preapproval_id is
  'Set when the payment is a recurring charge of a subscription (subscriptions.mp_preapproval_id). NULL for one-off payments and token packs.';
