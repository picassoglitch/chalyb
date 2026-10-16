-- De Taquito a Imperio: security review fixes (8 Oct 2026).
--
-- A. Reads never register a player. check_player registers an unknown id on first use; when a
--    read did that (pull, identities, restore with a mistyped code), anyone who learned a new
--    player's id (it travels in duel lobby presence) could claim it with their own secret
--    before the real phone's first write. Reads and deletes now use auth_player, which never
--    inserts. Writes (submit, save_put, save_sync, sign-in) still register.
-- B. Two phones signing in to a new account at the same moment: the second insert no longer
--    fails, it reads back whichever link won.
-- D. Cerrar sesión revokes this phone's key on the server (taquito_signout).
--
-- Old clients' taquito_save_put / _get stay callable: cached copies of the first beta use them.

-- Like check_player, but an unknown id is just bad credentials.
create or replace function taquito.auth_player(p_player uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  h bytea;
begin
  if p_player is null or p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    raise exception 'taquito: bad credentials' using errcode = '28000';
  end if;
  h := extensions.digest(p_secret, 'sha256');
  if not exists (select 1 from taquito.players where id = p_player and secret_hash = h)
    and not exists (select 1 from taquito.device_keys where player_id = p_player and secret_hash = h) then
    raise exception 'taquito: bad credentials' using errcode = '28000';
  end if;
end $$;

create or replace function public.taquito_save_get(p_player uuid, p_secret text)
returns table (data jsonb, saved_at bigint)
language plpgsql security definer set search_path = '' as $$
begin
  perform taquito.auth_player(p_player, p_secret);
  return query select s.data, s.saved_at from taquito.saves s where s.player_id = p_player;
end $$;

create or replace function public.taquito_save_pull(p_player uuid, p_secret text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  res jsonb;
begin
  perform taquito.auth_player(p_player, p_secret);
  select jsonb_build_object('rev', s.rev, 'saved_at', s.saved_at, 'data', s.data) into res
  from taquito.saves s where s.player_id = p_player and s.rev > 0;
  return res;
end $$;

create or replace function public.taquito_identities(p_player uuid, p_secret text)
returns text[]
language plpgsql security definer set search_path = '' as $$
begin
  perform taquito.auth_player(p_player, p_secret);
  return array(select i.provider from taquito.identities i where i.player_id = p_player order by i.provider);
end $$;

create or replace function public.taquito_delete(p_player uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform taquito.auth_player(p_player, p_secret);
  delete from taquito.players where id = p_player;
end $$;

create or replace function public.taquito_identity_login(p_provider text, p_sub text, p_player uuid, p_secret text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  acct uuid;
  sv record;
begin
  perform taquito.check_player(p_player, p_secret);
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
  select s.data, s.saved_at into sv from taquito.saves s where s.player_id = acct and s.rev > 0;
  return jsonb_build_object('status', 'choose', 'player', acct,
    'account', case when found then taquito.save_summary(sv.data, sv.saved_at) else null end);
end $$;

-- Cerrar sesión: this phone's key stops working. A phone that signed in later holds a device
-- key (deleted); the phone that started as the guest holds the player's first secret (replaced
-- by a random one nobody knows). Only for signed-in players: a guest would lock itself out.
create or replace function public.taquito_signout(p_player uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  h bytea := extensions.digest(coalesce(p_secret, ''), 'sha256');
begin
  perform taquito.auth_player(p_player, p_secret);
  if not exists (select 1 from taquito.identities where player_id = p_player) then
    raise exception 'taquito: not signed in' using errcode = '22023';
  end if;
  delete from taquito.device_keys where player_id = p_player and secret_hash = h;
  update taquito.players set secret_hash = extensions.digest(encode(extensions.gen_random_bytes(32), 'hex'), 'sha256')
  where id = p_player and secret_hash = h;
end $$;

revoke all on function taquito.auth_player(uuid, text) from public, anon, authenticated;
revoke all on function public.taquito_signout(uuid, text) from public;
grant execute on function public.taquito_signout(uuid, text) to anon, authenticated, service_role;
