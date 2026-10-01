-- =====================================================================
-- Chalyb — Pro trial, billing state, consent evidence (rebuild P2-2).
--
-- WHAT
--   1. profiles: when the account used its Pro trial (account level, so
--      cancelling or deleting a subscription can't reset it).
--   2. subscriptions (0037): the trial/billing fields the app shows and the
--      cron job acts on. Extended, not duplicated.
--   3. payment_method_fingerprints: one trial per card, by HASH only.
--   4. consent_events: the evidence log of aceptacion-ux §10. Append-only:
--      a trigger rejects UPDATE and DELETE for every role, and the app role
--      has no UPDATE/DELETE grant either.
--   5. cancellation_events: one row per cancellation, with its folio.
--   6. email_dispatches: every notice sent, its provider message id and its
--      delivery status. The unique (user_id, kind, period_key) index is what
--      makes the hourly cron send each notice once.
--   7. payments: the IVA portion and refunds, so Mi plan and Dinero read one
--      ledger (docs/payments/money-truth.md stays the single source).
--
-- RETENTION (aceptacion-ux §10.4.5): consent_events, cancellation_events and
-- email_dispatches are kept at least 10 years (Código de Comercio arts. 38,
-- 49). Non-compliance flags (chargebacks, trial abuse, debts) go after 72
-- months (LFPDPPP art. 10). Purging is an OPS job, never the app.
--
-- Idempotent: every statement is guarded; re-running is a no-op.
-- Test locally: `supabase db reset` (applies every migration), then run this
-- file again with `psql -f` — the second run must change nothing.
-- =====================================================================

-- 1. Account-level trial ------------------------------------------------
alter table public.profiles
  add column if not exists pro_trial_started_at timestamptz,
  add column if not exists pro_trial_ends_at timestamptz;

comment on column public.profiles.pro_trial_started_at is
  'When this account started its one free Pro month. Never cleared: one trial per account.';

-- 2. Subscriptions: trial and billing state -----------------------------
alter table public.subscriptions
  add column if not exists plan_key text,
  add column if not exists started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists next_charge_at timestamptz,
  add column if not exists grace_ends_at timestamptz,
  add column if not exists access_until timestamptz,
  add column if not exists card_brand text,
  add column if not exists card_last4 text,
  add column if not exists card_exp text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists pending_plan_key text,
  add column if not exists pending_effective_at timestamptz,
  add column if not exists reminder_due_at timestamptz,
  add column if not exists reminder_delivered_at timestamptz,
  add column if not exists charge_hold_until timestamptz,
  add column if not exists consent_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_plan_key_check') then
    alter table public.subscriptions
      add constraint subscriptions_plan_key_check
      check (plan_key is null or plan_key in ('pro_month', 'pro_year', 'vip_month'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_pending_plan_key_check') then
    alter table public.subscriptions
      add constraint subscriptions_pending_plan_key_check
      check (pending_plan_key is null or pending_plan_key in ('pro_month', 'pro_year', 'vip_month'));
  end if;
end $$;

create index if not exists subscriptions_next_charge_idx
  on public.subscriptions (next_charge_at)
  where status in ('authorized', 'paused');

-- 3. One trial per card --------------------------------------------------
create table if not exists public.payment_method_fingerprints (
  hash text primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.payment_method_fingerprints enable row level security;
-- No policies: only the service role reads or writes fingerprints.

comment on table public.payment_method_fingerprints is
  'sha256 of Mercado Pago payer+card ids — never card data. One free trial per card.';

-- 4. Consent evidence ---------------------------------------------------
create table if not exists public.consent_events (
  consent_id uuid primary key,
  event_type text not null,
  -- No foreign key on purpose: the evidence must outlive the account (an ARCO
  -- deletion removes the user, not the proof of what they agreed to).
  user_id uuid not null,
  account_email_hash text,
  documents jsonb not null default '[]'::jsonb,
  timestamp_utc timestamptz not null,
  client_timezone text,
  -- Personal data: encrypted by the app (AES-256-GCM, CONSENT_ENCRYPTION_KEY)
  -- before insert; readable only by the service role.
  ip_address_enc text,
  user_agent_enc text,
  locale text not null,
  surface text not null,
  ui_version text not null,
  disclosure_text text,
  disclosure_sha256 text,
  checkbox_text text,
  checkbox_checked boolean,
  button_label text,
  plan_id text,
  amount_mxn numeric(12, 2),
  currency text,
  tax_included boolean,
  billing_interval text,
  trial_end_utc timestamptz,
  charge_date_utc timestamptz,
  reminder_date_utc timestamptz,
  payment_method jsonb,
  marketing_opt_in boolean not null default false,
  screenshot_ref text,
  details jsonb,
  prev_event_hash text,
  event_hash text not null unique,
  inserted_at timestamptz not null default now()
);

create index if not exists consent_events_user_idx on public.consent_events (user_id, timestamp_utc desc);
create index if not exists consent_events_inserted_idx on public.consent_events (inserted_at);

alter table public.consent_events enable row level security;
-- No policies: customers see their folio through the app, which reads with the
-- service role; nobody reads IP/UA except support/legal.

create or replace function public.tg_consent_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'consent_events is append-only: % is not allowed', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists trg_consent_events_append_only on public.consent_events;
create trigger trg_consent_events_append_only
  before update or delete on public.consent_events
  for each row execute function public.tg_consent_events_append_only();

drop trigger if exists trg_consent_events_no_truncate on public.consent_events;
create trigger trg_consent_events_no_truncate
  before truncate on public.consent_events
  for each statement execute function public.tg_consent_events_append_only();

revoke update, delete, truncate on public.consent_events from anon, authenticated, service_role;

comment on table public.consent_events is
  'Append-only evidence log (aceptacion-ux §10). Hash-chained (prev_event_hash → event_hash). Retain ≥ 10 years; non-compliance flags 72 months. Never UPDATE/DELETE: corrections are new events.';

-- 5. Cancellations -------------------------------------------------------
create table if not exists public.cancellation_events (
  folio_cancelacion text primary key,
  user_id uuid not null references auth.users on delete cascade,
  subscription_id uuid references public.subscriptions on delete set null,
  requested_at timestamptz not null default now(),
  access_until timestamptz,
  consent_id uuid,
  email_message_id text
);
create index if not exists cancellation_events_user_idx on public.cancellation_events (user_id, requested_at desc);
alter table public.cancellation_events enable row level security;
drop policy if exists "cancellation_events_select_self" on public.cancellation_events;
create policy "cancellation_events_select_self"
  on public.cancellation_events for select
  using (auth.uid() = user_id);

-- 6. Notices sent --------------------------------------------------------
create table if not exists public.email_dispatches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  period_key text not null,
  template_id text not null,
  template_version text not null,
  provider_message_id text,
  sent_at timestamptz not null default now(),
  delivery_status text not null default 'sent',
  delivered_at timestamptz,
  bounced_at timestamptz,
  unique (user_id, kind, period_key)
);
create index if not exists email_dispatches_message_idx
  on public.email_dispatches (provider_message_id)
  where provider_message_id is not null;
alter table public.email_dispatches enable row level security;
-- No policies: written by the cron job and the Resend webhook (service role).

-- 7. The money ledger ----------------------------------------------------
alter table public.payments
  add column if not exists iva_cents integer,
  add column if not exists refunded_cents integer not null default 0,
  add column if not exists plan_key text;

comment on column public.payments.iva_cents is
  'IVA contained in amount_cents (16%, prices are shown IVA included). NULL for rows written before 0042.';
