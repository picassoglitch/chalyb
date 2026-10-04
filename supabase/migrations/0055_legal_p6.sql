-- 0055 · Legal leftovers of the old P6 (rebuild P6-5, P6-7, P6-8;
-- aceptacion-ux §8, §10.4.5; Aviso de privacidad §5, §9.1; Uso aceptable §5).
--
--   arco_requests          "Mis datos (derechos ARCO)": one row per request,
--                          with the legal deadlines (Aviso §5.3)
--   takedown_notices       copyright notice-and-takedown (art. 114 Octies
--                          LFDA, Uso aceptable §5): the notice, the removal,
--                          the counter-notice and the restore
--   blocked_content        fingerprints of removed content; a new job whose
--                          source matches one is refused (Uso aceptable §5.2.3)
--   legal_retention_purge  deletes non-compliance marks 72 months after the
--                          incident (Aviso §9.1, LFPDPPP art. 10): chargebacks
--                          and their measures, trial-abuse card fingerprints.
--                          Contract evidence (consent_events, cancellation
--                          events, notices) is never touched here: ≥ 10 years.
--
-- RLS: a person reads their own ARCO requests; takedowns and fingerprints are
-- service-role only (a notice carries a third party's contact data).
-- Idempotent.

create table if not exists public.arco_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- Aviso §5.1; 'automated' = opposition to automated decisions (anti-fraud).
  right_kind text not null check (right_kind in ('access', 'rectification', 'cancellation', 'opposition', 'automated')),
  description text not null check (char_length(description) between 1 and 4000),
  data_location text check (char_length(data_location) <= 2000),
  correct_value text check (char_length(correct_value) <= 2000),
  contact_email text not null check (char_length(contact_email) <= 320),
  received_at timestamptz not null default now(),
  -- 20 days to answer (extendable once), then 15 to carry it out.
  respond_by timestamptz not null,
  extended_at timestamptz,
  responded_at timestamptz,
  outcome text check (outcome in ('granted', 'partially_granted', 'denied', 'incomplete')),
  effective_by timestamptz,
  done_at timestamptz,
  consent_id uuid
);
create index if not exists arco_requests_open_idx on public.arco_requests (respond_by) where responded_at is null;
create index if not exists arco_requests_user_idx on public.arco_requests (user_id, received_at desc);
alter table public.arco_requests enable row level security;
drop policy if exists "arco_requests_select_self" on public.arco_requests;
create policy "arco_requests_select_self"
  on public.arco_requests for select
  using (auth.uid() = user_id);
revoke insert, update, delete on public.arco_requests from anon, authenticated;

create table if not exists public.takedown_notices (
  id uuid primary key default gen_random_uuid(),
  -- The four minimum fields (Uso aceptable §5.1).
  claimant_name text not null check (char_length(claimant_name) between 1 and 300),
  claimant_contact text not null check (char_length(claimant_contact) between 1 and 500),
  content_identification text not null check (char_length(content_identification) between 1 and 4000),
  right_statement text not null check (char_length(right_statement) between 1 and 4000),
  content_location text not null check (char_length(content_location) between 1 and 2000),
  -- Optional (never a condition for removal).
  work_description text check (char_length(work_description) <= 4000),
  ownership_evidence text check (char_length(ownership_evidence) <= 4000),
  declared_truthful boolean not null default false,
  received_at timestamptz not null default now(),
  status text not null default 'received'
    check (status in ('received', 'removed', 'rejected', 'counter_noticed', 'restored', 'upheld')),
  target_user_id uuid references auth.users on delete set null,
  removed_at timestamptz,
  removed_by text,
  user_notified_at timestamptz,
  counter_notice text check (char_length(counter_notice) <= 8000),
  counter_noticed_at timestamptz,
  -- 15 business days for the claimant to show a proceeding (§5.3).
  claimant_deadline timestamptz,
  claimant_proceeding_at timestamptz,
  restored_at timestamptz,
  rejected_reason text check (char_length(rejected_reason) <= 2000)
);
create index if not exists takedown_notices_open_idx on public.takedown_notices (received_at) where status in ('received', 'counter_noticed');
create index if not exists takedown_notices_target_idx on public.takedown_notices (target_user_id, removed_at desc);
alter table public.takedown_notices enable row level security;
-- No policies: only the service role reads or writes notices.
revoke insert, update, delete on public.takedown_notices from anon, authenticated;

create table if not exists public.blocked_content (
  fingerprint text primary key,
  kind text not null check (kind in ('url', 'file_sha256')),
  source text check (char_length(source) <= 2000),
  takedown_id uuid references public.takedown_notices on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz
);
alter table public.blocked_content enable row level security;
-- No policies: the hub checks it with the service role at submit time.
revoke insert, update, delete on public.blocked_content from anon, authenticated;

comment on table public.takedown_notices is
  'Copyright notice-and-takedown (art. 114 Octies LFDA, Uso aceptable §5). Kept as evidence; the repeat-infringer count reads removed notices.';
comment on table public.blocked_content is
  'Fingerprints of content removed after a notice. A source matching an active row is refused (Uso aceptable §5.2.3).';

-- Retention (Aviso §9.1, aceptacion-ux §10.4.5). Non-compliance marks go 72
-- months after the incident: a chargeback (and the measures tied to it) once
-- it closed, and a trial-abuse card fingerprint from when it was recorded.
-- Returns what it deleted. The daily /api/cron/legal calls it.
create or replace function public.legal_retention_purge(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := p_now - interval '72 months';
  n_restrictions integer;
  n_chargebacks integer;
  n_fingerprints integer;
begin
  with old as (
    select id from public.chargebacks
    where coalesce(closed_at, decided_at, resolved_at, opened_at) < cutoff
  ), gone as (
    delete from public.account_restrictions r using old where r.chargeback_id = old.id returning 1
  )
  select count(*) into n_restrictions from gone;

  with gone as (
    delete from public.chargebacks
    where coalesce(closed_at, decided_at, resolved_at, opened_at) < cutoff
    returning 1
  )
  select count(*) into n_chargebacks from gone;

  with gone as (
    delete from public.payment_method_fingerprints where created_at < cutoff returning 1
  )
  select count(*) into n_fingerprints from gone;

  return jsonb_build_object(
    'cutoff', cutoff,
    'account_restrictions', n_restrictions,
    'chargebacks', n_chargebacks,
    'payment_method_fingerprints', n_fingerprints
  );
end;
$$;

revoke all on function public.legal_retention_purge(timestamptz) from public, anon, authenticated;
grant execute on function public.legal_retention_purge(timestamptz) to service_role;
