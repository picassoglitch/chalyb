-- De Taquito a Imperio: revoke Sign in with Apple tokens when a player is deleted
-- (App Store guideline 5.1.1(v), issue #33).
--
-- A. taquito.apple_tokens: the token Apple gave taquito-auth for each linked Apple ID (the refresh
--    token from the sign-in's authorization code; the access token if Apple sent no refresh token).
--    Service role only: no RPC ever returns it to a phone.
-- B. Deleting a player (taquito_delete, any path) cascades players -> identities -> apple_tokens,
--    and a trigger moves the token into taquito.apple_revocations in the same transaction. The
--    delete never waits for Apple; taquito-auth ("revoke") calls Apple's /auth/revoke for each
--    queued token and then forgets it. An Apple failure leaves it queued, retried with backoff
--    (1 minute, doubling, at most a day apart) until Apple takes it or says it's already invalid.
-- C. Signing in with the same Apple ID again before the queue ran keeps the new token and drops
--    the queued one. Game sessions never depend on Apple tokens (a phone plays with its player id
--    + secret), so this isn't about staying signed in: revoking the old token ends that Apple ID's
--    whole authorization for the app, the token just kept included, while the person is a player
--    again. Open question for Aldo: revoke the old one anyway?

create table if not exists taquito.apple_tokens (
  provider text not null default 'apple' check (provider = 'apple'),
  sub text not null check (length(sub) between 1 and 255),
  client_id text not null check (length(client_id) between 1 and 255),
  token text not null check (length(token) between 1 and 4096),
  token_type text not null check (token_type in ('refresh_token', 'access_token')),
  updated_at timestamptz not null default now(),
  primary key (provider, sub),
  foreign key (provider, sub) references taquito.identities (provider, sub) on delete cascade
);

create table if not exists taquito.apple_revocations (
  id bigint generated always as identity primary key,
  sub text not null,
  client_id text not null,
  token text not null,
  token_type text not null check (token_type in ('refresh_token', 'access_token')),
  queued_at timestamptz not null default now(),
  attempts int not null default 0,
  next_try_at timestamptz not null default now()
);

alter table taquito.apple_tokens enable row level security;
alter table taquito.apple_revocations enable row level security;
revoke all on taquito.apple_tokens, taquito.apple_revocations from public, anon, authenticated;

-- B. Whatever deletes the token row (the player's delete cascading here) queues it for Apple.
create or replace function taquito.queue_apple_revocation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into taquito.apple_revocations (sub, client_id, token, token_type)
  values (old.sub, old.client_id, old.token, old.token_type);
  return old;
end $$;

create or replace trigger taquito_apple_tokens_revoke
after delete on taquito.apple_tokens
for each row execute function taquito.queue_apple_revocation();

-- taquito-auth after a sign-in with Apple whose ID is linked to a player. If the link is gone
-- meanwhile (the player was just deleted), the token goes straight to the revocation queue.
create or replace function public.taquito_apple_token_put(p_sub text, p_client_id text, p_token text, p_token_type text)
returns text
language plpgsql security definer set search_path = '' as $$
begin
  if p_sub is null or length(p_sub) not between 1 and 255
    or p_client_id is null or length(p_client_id) not between 1 and 255
    or p_token is null or length(p_token) not between 1 and 4096
    or p_token_type is null or p_token_type not in ('refresh_token', 'access_token') then
    raise exception 'taquito: bad apple token' using errcode = '22023';
  end if;
  -- Holds the link until commit, so a delete running now can't slip between the check and the insert.
  perform 1 from taquito.identities where provider = 'apple' and sub = p_sub for share;
  if not found then
    insert into taquito.apple_revocations (sub, client_id, token, token_type) values (p_sub, p_client_id, p_token, p_token_type);
    return 'queued';
  end if;
  insert into taquito.apple_tokens (sub, client_id, token, token_type) values (p_sub, p_client_id, p_token, p_token_type)
  on conflict (provider, sub) do update
    set client_id = excluded.client_id, token = excluded.token, token_type = excluded.token_type, updated_at = now();
  delete from taquito.apple_revocations where sub = p_sub; -- C (open question for Aldo)
  return 'stored';
end $$;

-- taquito-auth's revoke pass: takes up to p_limit queued tokens that are due and pushes each one's
-- next try back (1, 2, 4… minutes, at most a day) before Apple is called, so two passes at once
-- don't both send it and a pass that dies midway is retried later.
create or replace function public.taquito_apple_revocations_claim(p_limit int default 10)
returns table (id bigint, client_id text, token text, token_type text)
language sql security definer set search_path = '' as $$
  update taquito.apple_revocations r
  set attempts = r.attempts + 1,
      next_try_at = now() + least(interval '1 minute' * power(2, least(r.attempts, 11)), interval '1 day')
  where r.id in (
    select q.id from taquito.apple_revocations q
    where q.next_try_at <= now()
    order by q.id
    limit greatest(1, least(coalesce(p_limit, 10), 50))
    for update skip locked)
  returning r.id, r.client_id, r.token, r.token_type;
$$;

-- Apple revoked these (or said they were already invalid): forget them.
create or replace function public.taquito_apple_revocations_done(p_ids bigint[])
returns int
language sql security definer set search_path = '' as $$
  with gone as (delete from taquito.apple_revocations where id = any (p_ids) returning 1)
  select count(*)::int from gone;
$$;

revoke all on function taquito.queue_apple_revocation() from public, anon, authenticated;
revoke all on function public.taquito_apple_token_put(text, text, text, text) from public, anon, authenticated;
revoke all on function public.taquito_apple_revocations_claim(int) from public, anon, authenticated;
revoke all on function public.taquito_apple_revocations_done(bigint[]) from public, anon, authenticated;
grant execute on function public.taquito_apple_token_put(text, text, text, text) to service_role;
grant execute on function public.taquito_apple_revocations_claim(int) to service_role;
grant execute on function public.taquito_apple_revocations_done(bigint[]) to service_role;
