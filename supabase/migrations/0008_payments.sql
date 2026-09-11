-- =====================================================================
-- Nexo AI — Payments table (Step 05).
-- Records every successful tier upgrade via Mercado Pago. The webhook
-- handler inserts a row here after a payment is approved, AND updates
-- profiles.tier in the same transaction (idempotent on mp_payment_id).
--
-- We store the raw MP payload in `raw jsonb` so disputes/refunds can be
-- audited later without re-querying MP. Don't expose `raw` to the user UI
-- (it contains payer email, card brand, etc.) — only admins should see it.
--
-- RLS: subscriber can SELECT their own rows; admins can SELECT all (for
-- the future /dashboard/billing surface).
-- Idempotent: re-runnable.
-- =====================================================================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- Target tier for this payment (what the user paid to upgrade TO).
  tier subscription_tier not null,
  -- MP's unique payment identifier — UNIQUE so webhook retries don't double-write.
  mp_payment_id text unique not null,
  -- Amount in MINOR units (cents) to avoid float rounding bugs.
  amount_cents integer not null,
  currency text not null default 'USD',
  -- Last known MP status: 'approved' | 'pending' | 'rejected' | 'refunded' | 'cancelled' etc.
  status text not null,
  -- Full MP payment payload for audit. NEVER select this in user-facing UI.
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_user_id_created_idx
  on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

-- Subscribers see only their own payments.
drop policy if exists "payments_select_self" on public.payments;
create policy "payments_select_self"
  on public.payments for select
  using (auth.uid() = user_id);

-- Admins (env-locked too, via is_admin()) see everything for billing audit.
-- Note: the webhook itself uses the service-role key, which bypasses RLS,
-- so write policies aren't strictly needed — but defining a deny-by-default
-- model means stray writes from anon/auth contexts fail loudly.
drop policy if exists "payments_select_admins" on public.payments;
create policy "payments_select_admins"
  on public.payments for select
  using (public.is_admin());

-- Bump updated_at on every change (in case webhook gets a status update later).
create or replace function public.tg_payments_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_payments_set_updated_at on public.payments;
create trigger trg_payments_set_updated_at
  before update on public.payments
  for each row execute function public.tg_payments_set_updated_at();
