-- 0060 · Retention purge revised + change-notice retry cap (7a reviews of #49, #52, #53).
-- Not applied anywhere yet; edited in place. OPS: apply 0055 → 0060 in order.
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

-- ── Change notices: retry cap (7a review of #52, H1 gaps) ────────────────
-- A notice is claimed, retried and given up in one statement:
--   new            insert 'pending', attempts 1
--   failed, or pending > 10 min (an interrupted run)
--                  after 5 attempts or 72 h since the first one →
--                  'undeliverable' (done: it no longer holds the version
--                  back; the person is never asked to accept, and the
--                  owner panel lists them); otherwise retaken: 'pending',
--                  attempts + 1
-- Returns the row id to send with, or null when someone else holds it or
-- it was just given up.

alter table public.email_dispatches
  add column if not exists attempts integer not null default 1,
  add column if not exists first_attempt_at timestamptz;

create or replace function public.claim_notice_dispatch(
  p_user uuid,
  p_kind text,
  p_period text,
  p_template text,
  p_version text,
  p_max_attempts integer default 5,
  p_give_up interval default interval '72 hours'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.email_dispatches
    (user_id, kind, period_key, template_id, template_version, delivery_status, sent_at, attempts, first_attempt_at)
  values (p_user, p_kind, p_period, p_template, p_version, 'pending', now(), 1, now())
  on conflict (user_id, kind, period_key) do nothing
  returning id into v_id;
  if v_id is not null then
    return v_id;
  end if;

  update public.email_dispatches
     set delivery_status = 'undeliverable'
   where user_id = p_user and kind = p_kind and period_key = p_period
     and (delivery_status = 'failed'
          or (delivery_status = 'pending' and sent_at < now() - interval '10 minutes'))
     -- Only a counted attempt starts the 72 h clock (release_notice_attempt
     -- clears it after a provider failure).
     and (attempts >= p_max_attempts or (first_attempt_at is not null and first_attempt_at < now() - p_give_up));

  update public.email_dispatches
     set delivery_status = 'pending', sent_at = now(), provider_message_id = null,
         attempts = attempts + 1, first_attempt_at = coalesce(first_attempt_at, now())
   where user_id = p_user and kind = p_kind and period_key = p_period
     and (delivery_status = 'failed'
          or (delivery_status = 'pending' and sent_at < now() - interval '10 minutes'))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.claim_notice_dispatch(uuid, text, text, text, text, integer, interval) from public, anon, authenticated;
grant execute on function public.claim_notice_dispatch(uuid, text, text, text, text, integer, interval) to service_role;

-- Recipients: 'undeliverable' counts as done, like sent/delivered/bounced.
create or replace function public.legal_change_notice_recipients(
  p_doc text,
  p_version text,
  p_period_key text,
  p_after uuid default null,
  p_limit integer default 200
)
returns table (id uuid, email text, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name
  from public.profiles p
  where p.email is not null
    and (p_after is null or p.id > p_after)
    and not exists (
      select 1 from public.email_dispatches d
      where d.user_id = p.id
        and d.kind = 'terms_change'
        and d.period_key = p_period_key
        and (
          d.delivery_status in ('sent', 'delivered', 'bounced', 'undeliverable')
          or (d.delivery_status = 'pending' and d.sent_at > now() - interval '10 minutes')
        )
    )
    and not exists (
      select 1 from public.consent_events c
      where c.user_id = p.id
        and c.event_type in ('signup_terms_accepted', 'terms_reaccepted', 'trial_started',
                             'subscription_started', 'plan_changed', 'lealtad_started')
        and c.documents @> jsonb_build_array(jsonb_build_object('doc', p_doc, 'version', p_version))
    )
  order by p.id
  limit greatest(1, least(p_limit, 1000));
$$;

-- A failed send that was the provider's fault (not configured, network,
-- 5xx, 429) doesn't count against the person: give the attempt back, and
-- if it was the first one, the 72-hour clock never started. An outage can
-- therefore never make everyone 'undeliverable'.
create or replace function public.release_notice_attempt(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.email_dispatches
     set delivery_status = 'failed',
         provider_message_id = null,
         attempts = greatest(attempts - 1, 0),
         first_attempt_at = case when attempts <= 1 then null else first_attempt_at end
   where id = p_id and delivery_status = 'pending';
$$;
revoke all on function public.release_notice_attempt(uuid) from public, anon, authenticated;
grant execute on function public.release_notice_attempt(uuid) to service_role;

-- One owner alert per version when undeliverable notices pass 5%.
alter table public.legal_change_notices
  add column if not exists undeliverable_alert_at timestamptz;
