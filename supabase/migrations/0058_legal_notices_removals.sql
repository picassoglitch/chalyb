-- 0058 · Legal follow-ups (7a review of #49).
--
--   legal_change_notices        one row per (document, version) whose change
--                               must be emailed ≥ 30 days ahead (aceptacion-ux
--                               §8): when sending started and when every
--                               eligible user had a successful dispatch. The
--                               version takes effect no earlier than
--                               complete_at + 30 days.
--   legal_change_notice_recipients(doc, version, period_key, after, limit)
--                               users still owed the notice: an email, no
--                               successful or in-flight dispatch, and no
--                               acceptance of that version. Keyset-paginated.
--   content_removals            the clip jobs a copyright removal hid
--                               (Uso aceptable §5.2), so a restore can undo it.
--   takedown_notices            + the exact source picked at removal and its
--                               normalized fingerprint.
--
-- Idempotent.

create table if not exists public.legal_change_notices (
  doc text not null,
  version text not null,
  first_send_at timestamptz,
  complete_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (doc, version)
);
alter table public.legal_change_notices enable row level security;
-- No policies: the cron and the owner panel (service role) only.
revoke insert, update, delete on public.legal_change_notices from anon, authenticated;

-- A dispatch is successful once the provider accepted it: 'sent' (with a
-- provider id) or a later 'delivered'. 'pending' younger than 10 minutes is
-- in flight; older, or 'failed', is owed again.
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
          d.delivery_status in ('sent', 'delivered', 'bounced')
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
revoke all on function public.legal_change_notice_recipients(text, text, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.legal_change_notice_recipients(text, text, text, uuid, integer) to service_role;

create table if not exists public.content_removals (
  takedown_id uuid not null references public.takedown_notices on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  job_id text not null,
  removed_at timestamptz not null default now(),
  restored_at timestamptz,
  primary key (takedown_id, job_id)
);
create index if not exists content_removals_user_idx on public.content_removals (user_id) where restored_at is null;
alter table public.content_removals enable row level security;
-- No policies: the hub filters with the service role.
revoke insert, update, delete on public.content_removals from anon, authenticated;

alter table public.takedown_notices
  add column if not exists source_url text check (char_length(source_url) <= 2000),
  add column if not exists source_fingerprint text,
  add column if not exists removed_job_count integer;
