-- 0053 · Refunds and chargebacks (all-pending WS-8; REVISION §S; Términos de
-- Suscripción §7 and §10; aceptacion-ux §10.5).
--
--   chargebacks           one row per disputed Mercado Pago payment: triage,
--                         resolution, the 10-business-day notice, the decision
--   account_restrictions  the only measures that exist (restricted |
--                         prepayment_required | closed), each tied to a
--                         chargeback; active while lifted_at is null. Written
--                         only when CHARGEBACK_MEASURES_ENABLED is on.
--   payments.refund_reason  the Términos §7.2 case of a refund we issued
--
-- RLS: the owner reads their own rows; only the service role writes.
-- Idempotent.

create table if not exists public.chargebacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  mp_payment_id text not null unique,
  mp_chargeback_id text,
  mp_preapproval_id text,
  amount_cents integer not null check (amount_cents >= 0),
  charged_at timestamptz,
  opened_at timestamptz not null default now(),
  mp_status text not null,
  triage text check (triage in ('legal_refund', 'contest')),
  triage_reason text,
  resolution text check (resolution in ('won', 'lost')),
  resolved_at timestamptz,
  evidence_sha256 text,
  notice_sent_at timestamptz,
  deadline_utc timestamptz,
  response_received_at timestamptz,
  response_accepted boolean,
  paid_at timestamptz,
  decision text check (decision in ('bad_faith', 'none')),
  decided_at timestamptz,
  closed_at timestamptz
);

create index if not exists chargebacks_user_idx on public.chargebacks (user_id, opened_at desc);
create index if not exists chargebacks_open_idx on public.chargebacks (deadline_utc)
  where decision is null;

alter table public.chargebacks enable row level security;
drop policy if exists "chargebacks_select_self" on public.chargebacks;
create policy "chargebacks_select_self"
  on public.chargebacks for select
  using (auth.uid() = user_id);

create table if not exists public.account_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('restricted', 'prepayment_required', 'closed')),
  set_at timestamptz not null default now(),
  lifted_at timestamptz,
  chargeback_id uuid not null references public.chargebacks on delete restrict
);

create index if not exists account_restrictions_user_idx
  on public.account_restrictions (user_id) where lifted_at is null;
create unique index if not exists account_restrictions_one_active
  on public.account_restrictions (user_id, kind, chargeback_id) where lifted_at is null;

alter table public.account_restrictions enable row level security;
drop policy if exists "account_restrictions_select_self" on public.account_restrictions;
create policy "account_restrictions_select_self"
  on public.account_restrictions for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.chargebacks from anon, authenticated;
revoke insert, update, delete on public.account_restrictions from anon, authenticated;

alter table public.payments
  add column if not exists refund_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_refund_reason_check') then
    alter table public.payments
      add constraint payments_refund_reason_check check (
        refund_reason is null or refund_reason in (
          'legal_7_2_a', 'legal_7_2_b', 'legal_7_2_c', 'legal_7_2_d', 'legal_7_2_e',
          'legal_7_2_f', 'legal_7_2_g', 'legal_7_2_h', 'legal_7_2_i'
        )
      );
  end if;
end $$;

comment on table public.chargebacks is
  'Disputed payments (Términos de Suscripción §10). Opening one changes nothing on the account.';
comment on table public.account_restrictions is
  'Measures after a bad-faith chargeback only (§10.6, §10.8). Content download always stays.';
