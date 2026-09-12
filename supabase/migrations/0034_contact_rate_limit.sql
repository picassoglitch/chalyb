-- =====================================================================
-- Chalyb — durable rate limit for the public contact form.
--
-- The limiter lived in a module-level Map in the server action: 5 posts per
-- IP per 10 minutes, per serverless instance, reset on every cold start. On
-- Vercel that is close to no limit at all — each concurrent lambda has its own
-- Map, and instances are recycled constantly. A spammer gets 5 × (however many
-- instances happen to be warm), repeatedly.
--
-- This moves the counter into Postgres, where every instance sees the same
-- numbers. One round-trip does the whole decision: prune expired rows, count
-- what is left for this caller, record the attempt if it is under the limit.
--
-- The stored value is a SHA-256 of the IP, not the IP: the counter only needs
-- to tell callers apart, and a hashed column can't be read back as a list of
-- who wrote to us. Rows older than the window are deleted on every call, so
-- the table stays tiny and holds nothing for longer than the limit needs.
--
-- Idempotent: re-runnable.
-- =====================================================================

create table if not exists public.contact_attempts (
  id         bigint generated always as identity primary key,
  -- sha256 hex of the caller's IP. Not reversible, not an identifier we keep.
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index if not exists contact_attempts_ip_time_idx
  on public.contact_attempts (ip_hash, created_at desc);

-- Nobody reaches this table from the API. The server action calls the function
-- below with the service-role key; RLS with no policies denies everyone else.
alter table public.contact_attempts enable row level security;

revoke all on public.contact_attempts from anon;
revoke all on public.contact_attempts from authenticated;

-- pgcrypto gives us digest() for the hash. Supabase ships it in `extensions`.
create extension if not exists pgcrypto with schema extensions;

/**
 * Returns {allowed: bool, attempts: int, retry_after_seconds: int}.
 * Records the attempt only when it is allowed, so a caller who is already over
 * the limit cannot push their own window forward by hammering the endpoint.
 */
create or replace function public.check_contact_rate_limit(
  p_ip             text,
  p_window_seconds integer default 600,
  p_max_attempts   integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash    text;
  v_since   timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count   integer;
  v_oldest  timestamptz;
begin
  v_hash := encode(extensions.digest(coalesce(p_ip, 'unknown'), 'sha256'), 'hex');

  -- Housekeeping: the table never needs to hold more than one window.
  delete from public.contact_attempts where created_at < v_since;

  select count(*), min(created_at)
    into v_count, v_oldest
    from public.contact_attempts
   where ip_hash = v_hash
     and created_at >= v_since;

  if v_count >= p_max_attempts then
    return jsonb_build_object(
      'allowed', false,
      'attempts', v_count,
      'retry_after_seconds',
        greatest(0, p_window_seconds - extract(epoch from (now() - v_oldest))::integer)
    );
  end if;

  insert into public.contact_attempts (ip_hash) values (v_hash);

  return jsonb_build_object('allowed', true, 'attempts', v_count + 1, 'retry_after_seconds', 0);
end;
$$;

comment on function public.check_contact_rate_limit(text, integer, integer) is
  'Durable per-IP rate limit for the public contact form. Server-side (service_role) only.';

revoke all on function public.check_contact_rate_limit(text, integer, integer) from public;
revoke all on function public.check_contact_rate_limit(text, integer, integer) from anon;
revoke all on function public.check_contact_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.check_contact_rate_limit(text, integer, integer) to service_role;
