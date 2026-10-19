-- "Empezar de cero" (Chalito, 2026-10-19): a person with no approved device left and no recovery
-- code proves it's them with a one-time code emailed to their account, and every Chalito device of
-- the account is retired right away (owner decision: no waiting period) so this browser can
-- activate as the first one. Only the code's HMAC is kept. Server only: the hub's API routes call
-- the two functions with the service role; browsers can't read or call anything here.

create table if not exists public.chalito_reset_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- null once used or expired
  code_hash text,
  expires_at timestamptz not null,
  attempts int not null default 0,
  -- codes sent in the current hour
  window_start timestamptz not null,
  sends int not null default 0
);

alter table public.chalito_reset_codes enable row level security;
revoke all on public.chalito_reset_codes from public, anon, authenticated;

-- A new code (replacing any earlier one, with fresh tries): 'ok', or 'rate_limited' after three in an hour.
create or replace function public.chalito_reset_issue(
  p_user uuid,
  p_hash text,
  p_expires timestamptz,
  p_now timestamptz
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.chalito_reset_codes;
begin
  insert into public.chalito_reset_codes (user_id, code_hash, expires_at, window_start, sends)
  values (p_user, null, p_now, p_now, 0)
  on conflict (user_id) do nothing;
  select * into r from public.chalito_reset_codes where user_id = p_user for update;
  if r.window_start + interval '1 hour' <= p_now then
    r.window_start := p_now;
    r.sends := 0;
  end if;
  if r.sends >= 3 then
    return 'rate_limited';
  end if;
  update public.chalito_reset_codes
  set code_hash = p_hash, expires_at = p_expires, attempts = 0,
      window_start = r.window_start, sends = r.sends + 1
  where user_id = p_user;
  return 'ok';
end;
$$;

-- Checks a typed code, atomically: 'ok' (and it's used up), 'bad_code', 'too_many' (five wrong
-- tries: ask for a new one), 'expired' or 'none'.
create or replace function public.chalito_reset_consume(
  p_user uuid,
  p_hash text,
  p_now timestamptz
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.chalito_reset_codes;
begin
  select * into r from public.chalito_reset_codes where user_id = p_user for update;
  if not found or r.code_hash is null then
    return 'none';
  end if;
  if r.expires_at <= p_now then
    update public.chalito_reset_codes set code_hash = null where user_id = p_user;
    return 'expired';
  end if;
  if r.attempts >= 5 then
    return 'too_many';
  end if;
  if r.code_hash = p_hash then
    update public.chalito_reset_codes set code_hash = null where user_id = p_user;
    return 'ok';
  end if;
  update public.chalito_reset_codes set attempts = attempts + 1 where user_id = p_user;
  return 'bad_code';
end;
$$;

revoke all on function public.chalito_reset_issue(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.chalito_reset_consume(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.chalito_reset_issue(uuid, text, timestamptz, timestamptz) to service_role;
grant execute on function public.chalito_reset_consume(uuid, text, timestamptz) to service_role;
