-- De Taquito a Imperio: close guest-id squatting (SEC-api-2, 11 Oct 2026).
--
-- Writes (submit, save_sync, sign-in) used check_player, which inserted an unknown uuid
-- on first use. A lurker in the duel lobby who saw a new presence id could claim it
-- with their own secret; the real phone then got 28000 on every RPC and looked "offline".
--
-- Registration is now a dedicated RPC. check_player only authenticates (like auth_player).
-- The phone calls taquito_register before it broadcasts its id.

create or replace function taquito.check_player(p_player uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform taquito.auth_player(p_player, p_secret);
end $$;

-- Inserts a new player (same quotas as the old check_player). Idempotent: a second
-- call with the same secret succeeds; a different secret is 28000.
create or replace function public.taquito_register(p_player uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  h bytea;
  src_ip text;
begin
  if p_player is null or p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    raise exception 'taquito: bad credentials' using errcode = '28000';
  end if;
  h := extensions.digest(p_secret, 'sha256');
  if exists (select 1 from taquito.players where id = p_player) then
    perform taquito.auth_player(p_player, p_secret);
    return;
  end if;
  if current_setting('role', true) is distinct from 'service_role' then
    src_ip := taquito.client_ip();
  end if;
  if src_ip is not null then
    delete from taquito.registrations where created_at < now() - interval '1 hour';
    if (select count(*) from taquito.registrations r where r.ip = src_ip and r.created_at > now() - interval '1 hour') >= 20 then
      raise exception 'taquito: too many new players' using errcode = '54000';
    end if;
  end if;
  if (select count(*) from taquito.players p where p.created_at > now() - interval '1 hour') >= 2000 then
    raise exception 'taquito: too many new players' using errcode = '54000';
  end if;
  insert into taquito.players (id, secret_hash) values (p_player, h) on conflict (id) do nothing;
  if found and src_ip is not null then
    insert into taquito.registrations (ip) values (src_ip);
  end if;
  perform taquito.auth_player(p_player, p_secret);
end $$;

revoke all on function public.taquito_register(uuid, text) from public;
grant execute on function public.taquito_register(uuid, text) to anon, authenticated, service_role;

-- Sign-in is service-role only (taquito-auth). A first-launch guest may not have called
-- taquito_register yet; identity_* register that phone instead of failing 28000.
create or replace function public.taquito_identity_login(p_provider text, p_sub text, p_player uuid, p_secret text, p_nonce_hash text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  acct uuid;
  sv record;
begin
  perform public.taquito_register(p_player, p_secret);
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
    select player_id into acct from taquito.identities where provider = p_provider and sub = p_sub;
  end if;
  if acct = p_player then
    return jsonb_build_object('status', 'linked', 'player', p_player);
  end if;
  update taquito.auth_nonces set switch_ok = true where provider = p_provider and sub = p_sub and nonce_hash = p_nonce_hash;
  select s.data, s.saved_at into sv from taquito.saves s where s.player_id = acct and s.rev > 0;
  return jsonb_build_object('status', 'choose', 'player', acct,
    'account', case when found then taquito.save_summary(sv.data, sv.saved_at) else null end);
end $$;

create or replace function public.taquito_identity_switch(
  p_provider text, p_sub text, p_player uuid, p_secret text, p_keep text, p_data jsonb, p_saved_at bigint, p_nonce_hash text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  acct uuid;
  key text;
  r int;
begin
  perform public.taquito_register(p_player, p_secret);
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
    delete from taquito.players where id = p_player;
  end if;
  select s.rev into r from taquito.saves s where s.player_id = acct;
  return jsonb_build_object('player', acct, 'secret', key, 'rev', coalesce(r, 0));
end $$;

revoke all on function public.taquito_identity_login(text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.taquito_identity_switch(text, text, uuid, text, text, jsonb, bigint, text) from public, anon, authenticated;
grant execute on function public.taquito_identity_login(text, text, uuid, text, text) to service_role;
grant execute on function public.taquito_identity_switch(text, text, uuid, text, text, jsonb, bigint, text) to service_role;
