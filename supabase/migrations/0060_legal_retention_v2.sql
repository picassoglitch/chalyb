-- 0060 · Retention purge, revised (7a review of #49, MEDIUM 10 + LOW).
--
-- Aviso de privacidad §9.1: non-compliance data goes "a más tardar 72 meses
-- después de la fecha del incumplimiento". For a chargeback the incident is
-- when the disputed charge was disputed, so the clock starts at opened_at,
-- not when the case closed or was decided (0055 used the later dates, which
-- kept marks longer than the Aviso allows). Trial-abuse card fingerprints
-- count from when they were recorded, as before.
--
-- p_dry_run: count what would go, delete nothing.
-- Lifting a restriction that was still active is audited per user
-- (legal.retention), since the account changes; contract evidence
-- (consent_events, cancellations, notices) is never touched.
--
-- Idempotent: create or replace.

drop function if exists public.legal_retention_purge(timestamptz);

create or replace function public.legal_retention_purge(
  p_now timestamptz default now(),
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := p_now - interval '72 months';
  n_restrictions integer;
  n_active integer;
  n_chargebacks integer;
  n_fingerprints integer;
begin
  select count(*), count(*) filter (where r.lifted_at is null)
    into n_restrictions, n_active
    from public.account_restrictions r
    join public.chargebacks c on c.id = r.chargeback_id
   where c.opened_at < cutoff;
  select count(*) into n_chargebacks from public.chargebacks where opened_at < cutoff;
  select count(*) into n_fingerprints from public.payment_method_fingerprints where created_at < cutoff;

  if not p_dry_run then
    insert into public.audit_events (action, target_user_id, before, after, metadata)
    select 'legal.retention', r.user_id,
           jsonb_build_object('restriction', r.kind, 'set_at', r.set_at),
           jsonb_build_object('restriction', null),
           jsonb_build_object('reason', 'purged 72 months after the chargeback (Aviso §9.1)',
                              'chargeback_opened_at', c.opened_at)
      from public.account_restrictions r
      join public.chargebacks c on c.id = r.chargeback_id
     where c.opened_at < cutoff and r.lifted_at is null;

    delete from public.account_restrictions r
     using public.chargebacks c
     where c.id = r.chargeback_id and c.opened_at < cutoff;
    delete from public.chargebacks where opened_at < cutoff;
    delete from public.payment_method_fingerprints where created_at < cutoff;
  end if;

  return jsonb_build_object(
    'cutoff', cutoff,
    'dry_run', p_dry_run,
    'account_restrictions', n_restrictions,
    'active_restrictions_lifted', case when p_dry_run then 0 else n_active end,
    'chargebacks', n_chargebacks,
    'payment_method_fingerprints', n_fingerprints
  );
end;
$$;

revoke all on function public.legal_retention_purge(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.legal_retention_purge(timestamptz, boolean) to service_role;
