-- De Taquito a Imperio: single-use sign-in nonces (security audit SEC-api-4, 10 Oct 2026).
--
-- taquito-auth checked that the ID token carries the hash of the raw nonce in the body, but
-- never marked it used: a captured login body could be replayed with another player's id and
-- secret while the token lived, and `switch` then hands out a key for the victim's account.
-- Now taquito-auth passes the nonce hash and the server keeps one row per (provider, sub, nonce):
-- login takes it for the calling player; after a 'choose' login, that same player's switch may
-- use it once more (the game sends login, then switch, with one token). Anything else is refused.
-- Calls without p_nonce_hash (the function before its redeploy, the SQL editor) skip the check:
-- both RPCs stay service-role only.

-- No foreign key on player_id: switch keep=account deletes that guest, and the row must outlive it.
create table if not exists taquito.auth_nonces (
  provider text not null,
  sub text not null,
  nonce_hash text not null,
  player_id uuid not null,
  switch_ok boolean not null default false,
  -- Outlives any ID token taquito-auth accepts (Google 1 h, Apple up to a day).
  expires_at timestamptz not null default now() + interval '2 days',
  primary key (provider, sub, nonce_hash)
);
create index if not exists taquito_auth_nonces_expires on taquito.auth_nonces (expires_at);
alter table taquito.auth_nonces enable row level security;
revoke all on taquito.auth_nonces from public, anon, authenticated;

-- The new last parameter changes the signatures: drop the old ones so 4- and 7-argument calls
-- resolve to these (with a null nonce) instead of being ambiguous.
drop function if exists public.taquito_identity_login(text, text, uuid, text);
drop function if exists public.taquito_identity_switch(text, text, uuid, text, text, jsonb, bigint);

create or replace function public.taquito_identity_login(p_provider text, p_sub text, p_player uuid, p_secret text, p_nonce_hash text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  acct uuid;
  sv record;
begin
  perform taquito.check_player(p_player, p_secret);
  if p_nonce_hash is not null then
    delete from taquito.auth_nonces where expires_at < now();
    insert into taquito.auth_nonces (provider, sub, nonce_hash, player_id) values (p_provider, p_sub, p_nonce_hash, p_player)
    on conflict do nothing;
    if not found then
      raise exception 'taquito: sign-in already used' using errcode = '28000';
    end if;
  end if;
  select player_id into acct from taquito.identities where provider = p_provider and sub = p_sub;
  if acct is null then
    if exists (select 1 from taquito.identities where player_id = p_player and provider = p_provider) then
      return jsonb_build_object('status', 'taken');
    end if;
    insert into taquito.identities (provider, sub, player_id) values (p_provider, p_sub, p_player)
    on conflict (provider, sub) do nothing;
    -- Another phone may have linked this account a moment ago: whichever link won counts.
    select player_id into acct from taquito.identities where provider = p_provider and sub = p_sub;
  end if;
  if acct = p_player then
    return jsonb_build_object('status', 'linked', 'player', p_player);
  end if;
  -- The game asks which progress to keep, then calls switch with the same token.
  update taquito.auth_nonces set switch_ok = true where provider = p_provider and sub = p_sub and nonce_hash = p_nonce_hash;
  select s.data, s.saved_at into sv from taquito.saves s where s.player_id = acct and s.rev > 0;
  return jsonb_build_object('status', 'choose', 'player', acct,
    'account', case when found then taquito.save_summary(sv.data, sv.saved_at) else null end);
end $$;

-- Sign-in, step 2: this phone becomes the account's player and gets its own device key.
-- p_keep 'device' replaces the account's cloud save with this phone's (p_data);
-- 'account' keeps the account's, the phone downloads it and its guest player is deleted.
create or replace function public.taquito_identity_switch(
  p_provider text, p_sub text, p_player uuid, p_secret text, p_keep text, p_data jsonb, p_saved_at bigint, p_nonce_hash text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  acct uuid;
  key text;
  r int;
begin
  perform taquito.check_player(p_player, p_secret);
  if p_nonce_hash is not null then
    update taquito.auth_nonces set switch_ok = false
    where provider = p_provider and sub = p_sub and nonce_hash = p_nonce_hash and player_id = p_player and switch_ok;
    if not found then
      insert into taquito.auth_nonces (provider, sub, nonce_hash, player_id) values (p_provider, p_sub, p_nonce_hash, p_player)
      on conflict do nothing;
      if not found then
        raise exception 'taquito: sign-in already used' using errcode = '28000';
      end if;
    end if;
  end if;
  if p_keep not in ('device', 'account') then
    raise exception 'taquito: bad choice' using errcode = '22023';
  end if;
  select player_id into acct from taquito.identities where provider = p_provider and sub = p_sub;
  if acct is null then
    raise exception 'taquito: account not linked' using errcode = '22023';
  end if;
  if acct = p_player then
    return jsonb_build_object('player', p_player, 'secret', null);
  end if;
  key := encode(extensions.gen_random_bytes(24), 'hex');
  insert into taquito.device_keys (player_id, secret_hash) values (acct, extensions.digest(key, 'sha256'));
  if p_keep = 'device' then
    perform taquito.valid_save(p_data);
    insert into taquito.saves (player_id, data, saved_at, rev) values (acct, p_data, coalesce(p_saved_at, 0), 1)
    on conflict (player_id) do update set data = excluded.data, saved_at = excluded.saved_at, rev = taquito.saves.rev + 1, updated_at = now();
  elsif not exists (select 1 from taquito.identities where player_id = p_player) then
    delete from taquito.players where id = p_player; -- cascades to its save, runs, weekly and duels
  end if;
  select s.rev into r from taquito.saves s where s.player_id = acct;
  return jsonb_build_object('player', acct, 'secret', key, 'rev', coalesce(r, 0));
end $$;

revoke all on function public.taquito_identity_login(text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.taquito_identity_switch(text, text, uuid, text, text, jsonb, bigint, text) from public, anon, authenticated;
grant execute on function public.taquito_identity_login(text, text, uuid, text, text) to service_role;
grant execute on function public.taquito_identity_switch(text, text, uuid, text, text, jsonb, bigint, text) to service_role;
