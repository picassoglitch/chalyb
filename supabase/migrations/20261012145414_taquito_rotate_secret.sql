-- De Taquito a Imperio: a leaked backup code can be invalidated (WP-22, SEC-priv-3; 11 Oct 2026).
--
-- The backup code is "<player id>.<this phone's key>". "Nuevo código" in Cuenta swaps that key
-- for a new one: the old code stops working everywhere (also on any phone that restored it).
-- Only the caller's own key changes: the guest secret (players.secret_hash) or, on a phone that
-- signed in later, its own row in device_keys. The account's other phones keep their keys.
--
-- The SERVER makes the new key (Aldo, 12 Oct 2026: client data is hostile, the phone never picks it).
-- Two steps, so a lost answer never leaves the phone with only a key the server doesn't know:
--   1. taquito_rotate_begin(player, old key) -> new key. The server keeps only its hash, as pending;
--      the old key still works. A lost answer is harmless: the phone asks again and gets another one.
--   2. The phone stores the new key for good, then taquito_rotate_confirm(player, new key): the swap.
--      Only a key the server issued (pending, under 1 day old) is accepted. A retry after a lost
--      answer finds the new key already in place and succeeds.
-- No Edge Function change.

-- Never applied anywhere (the first draft let the phone send the new key): make sure it's gone.
drop function if exists public.taquito_rotate_secret(uuid, text, text);

create table if not exists taquito.rotations (
  player_id uuid not null,
  old_hash bytea not null,
  new_hash bytea not null unique,
  created_at timestamptz not null default now(),
  primary key (player_id, old_hash)
);
alter table taquito.rotations enable row level security;
revoke all on taquito.rotations from public, anon, authenticated;

create or replace function public.taquito_rotate_begin(p_player uuid, p_secret text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  h bytea;
begin
  perform taquito.auth_player(p_player, p_secret);
  h := extensions.digest(p_secret, 'sha256');
  -- 48 hex characters, like every key restoreFromCode (src/net/cloud.ts) reads.
  k := encode(extensions.gen_random_bytes(24), 'hex');
  delete from taquito.rotations where created_at < now() - interval '1 day';
  insert into taquito.rotations (player_id, old_hash, new_hash) values (p_player, h, extensions.digest(k, 'sha256'))
    on conflict (player_id, old_hash) do update set new_hash = excluded.new_hash, created_at = now();
  return k;
end $$;

create or replace function public.taquito_rotate_confirm(p_player uuid, p_new_secret text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n bytea;
  h bytea;
begin
  if p_new_secret is null or p_new_secret !~ '^[0-9a-f]{48}$' then
    raise exception 'taquito: bad credentials' using errcode = '28000';
  end if;
  n := extensions.digest(p_new_secret, 'sha256');
  -- A retry after a lost answer: the swap already happened.
  if exists (select 1 from taquito.players where id = p_player and secret_hash = n)
    or exists (select 1 from taquito.device_keys where player_id = p_player and secret_hash = n) then
    return;
  end if;
  -- Only a key this server issued for this player, recently. A key the phone made up is never in here.
  delete from taquito.rotations where player_id = p_player and new_hash = n and created_at > now() - interval '1 day'
    returning old_hash into h;
  if h is null then
    raise exception 'taquito: bad credentials' using errcode = '28000';
  end if;
  -- One update each: the old key stops working in the same statement that makes the new one work.
  update taquito.players set secret_hash = n where id = p_player and secret_hash = h;
  if not found then
    update taquito.device_keys set secret_hash = n where player_id = p_player and secret_hash = h;
  end if;
  -- The old key changed meanwhile (a concurrent rotation won): nothing swapped, so this must not report success.
  if not exists (select 1 from taquito.players where id = p_player and secret_hash = n)
    and not exists (select 1 from taquito.device_keys where player_id = p_player and secret_hash = n) then
    raise exception 'taquito: bad credentials' using errcode = '28000';
  end if;
end $$;

revoke all on function public.taquito_rotate_begin(uuid, text) from public;
revoke all on function public.taquito_rotate_confirm(uuid, text) from public;
grant execute on function public.taquito_rotate_begin(uuid, text) to anon, authenticated, service_role;
grant execute on function public.taquito_rotate_confirm(uuid, text) to anon, authenticated, service_role;
