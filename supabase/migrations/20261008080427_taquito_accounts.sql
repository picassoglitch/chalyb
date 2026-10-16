-- De Taquito a Imperio: Google / Apple sign-in and automatic cloud saves.
--
-- Still no Supabase Auth (auth.users inserts create Chalyb hub profiles). The edge
-- function taquito-auth checks the Google / Apple ID token itself and then calls the
-- service-role RPCs below, which link provider + sub to a taquito player.
--
-- A player can now hold several device secrets: the first one is players.secret_hash
-- (the guest identity), every phone that signs in later gets its own row in device_keys.
-- Deleting the player (taquito_delete) cascades to identities and device keys.

create table if not exists taquito.device_keys (
  player_id uuid not null references taquito.players (id) on delete cascade,
  secret_hash bytea not null,
  created_at timestamptz not null default now(),
  primary key (player_id, secret_hash)
);

create table if not exists taquito.identities (
  provider text not null check (provider in ('google', 'apple')),
  sub text not null check (length(sub) between 1 and 255),
  player_id uuid not null references taquito.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, sub)
);
create index if not exists taquito_identities_player on taquito.identities (player_id);

alter table taquito.device_keys enable row level security;
alter table taquito.identities enable row level security;
revoke all on all tables in schema taquito from public, anon, authenticated;

-- Server revision of the cloud save: a phone only overwrites the copy it last saw.
alter table taquito.saves add column if not exists rev int not null default 0;

-- Registers the player on first use; afterwards the secret must match the guest
-- secret or one of the player's device keys.
create or replace function taquito.check_player(p_player uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  h bytea;
begin
  if p_player is null or p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    raise exception 'taquito: bad credentials' using errcode = '28000';
  end if;
  h := extensions.digest(p_secret, 'sha256');
  insert into taquito.players (id, secret_hash) values (p_player, h) on conflict (id) do nothing;
  if not exists (select 1 from taquito.players where id = p_player and secret_hash = h)
    and not exists (select 1 from taquito.device_keys where player_id = p_player and secret_hash = h) then
    raise exception 'taquito: bad credentials' using errcode = '28000';
  end if;
end $$;

create or replace function taquito.valid_save(p_data jsonb) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 200000 then
    raise exception 'taquito: bad save' using errcode = '22023';
  end if;
end $$;

-- Day, varos and stars of a save, for the "which one do you keep?" question.
create or replace function taquito.save_summary(p_data jsonb, p_saved_at bigint) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'day', case when jsonb_typeof(p_data -> 'day') = 'number' then (p_data ->> 'day')::numeric else 1 end,
    'varos', case when jsonb_typeof(p_data -> 'varos') = 'number' then (p_data ->> 'varos')::numeric else 0 end,
    'stars', case when jsonb_typeof(p_data -> 'stars') = 'object' then
      (select coalesce(sum(case when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric else 0 end), 0) from jsonb_each(p_data -> 'stars'))
      else 0 end,
    'saved_at', p_saved_at)
$$;

-- Older clients still use taquito_save_put: it now also moves the revision forward.
create or replace function public.taquito_save_put(p_player uuid, p_secret text, p_data jsonb, p_saved_at bigint)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  stored bigint;
begin
  perform taquito.check_player(p_player, p_secret);
  perform taquito.valid_save(p_data);
  insert into taquito.saves (player_id, data, saved_at, rev) values (p_player, p_data, p_saved_at, 1)
  on conflict (player_id) do update set data = excluded.data, saved_at = excluded.saved_at, rev = taquito.saves.rev + 1, updated_at = now()
    where taquito.saves.saved_at < excluded.saved_at;
  select saved_at into stored from taquito.saves where player_id = p_player;
  return stored;
end $$;

-- Automatic cloud save. Writes only when the phone's copy is based on the server's current
-- revision (p_base_rev); otherwise answers 'conflict' with the server copy, so a phone that
-- missed newer progress from another phone can never overwrite it.
create or replace function public.taquito_save_sync(p_player uuid, p_secret text, p_data jsonb, p_saved_at bigint, p_base_rev int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cur record;
begin
  perform taquito.check_player(p_player, p_secret);
  perform taquito.valid_save(p_data);
  insert into taquito.saves (player_id, data, saved_at, rev) values (p_player, '{}'::jsonb, 0, 0) on conflict (player_id) do nothing;
  select s.rev, s.saved_at, s.data into cur from taquito.saves s where s.player_id = p_player for update;
  if cur.rev <> coalesce(p_base_rev, -1) then
    return jsonb_build_object('status', 'conflict', 'rev', cur.rev, 'saved_at', cur.saved_at, 'data', cur.data);
  end if;
  update taquito.saves set data = p_data, saved_at = coalesce(p_saved_at, 0), rev = cur.rev + 1, updated_at = now()
  where player_id = p_player;
  return jsonb_build_object('status', 'saved', 'rev', cur.rev + 1);
end $$;

-- The cloud copy with its revision (null when there is none yet).
create or replace function public.taquito_save_pull(p_player uuid, p_secret text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  res jsonb;
begin
  perform taquito.check_player(p_player, p_secret);
  select jsonb_build_object('rev', s.rev, 'saved_at', s.saved_at, 'data', s.data) into res
  from taquito.saves s where s.player_id = p_player and s.rev > 0;
  return res;
end $$;

-- Sign-in, step 1 (edge function only, after checking the ID token).
--   linked: this phone's player is (now) the account's player.
--   taken:  this phone's player is already linked to another account of that provider.
--   choose: the account belongs to another player; the phone must pick whose progress stays
--           (taquito_identity_switch). `account` summarises the account's cloud save.
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
    insert into taquito.identities (provider, sub, player_id) values (p_provider, p_sub, p_player);
    return jsonb_build_object('status', 'linked', 'player', p_player);
  end if;
  if acct = p_player then
    return jsonb_build_object('status', 'linked', 'player', p_player);
  end if;
  select s.data, s.saved_at into sv from taquito.saves s where s.player_id = acct and s.rev > 0;
  return jsonb_build_object('status', 'choose', 'player', acct,
    'account', case when found then taquito.save_summary(sv.data, sv.saved_at) else null end);
end $$;

-- Sign-in, step 2: this phone becomes the account's player and gets its own device key.
-- p_keep 'device' replaces the account's cloud save with this phone's (p_data);
-- 'account' keeps the account's and the phone downloads it.
create or replace function public.taquito_identity_switch(
  p_provider text, p_sub text, p_player uuid, p_secret text, p_keep text, p_data jsonb, p_saved_at bigint
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  acct uuid;
  key text;
  r int;
begin
  perform taquito.check_player(p_player, p_secret);
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
  end if;
  select s.rev into r from taquito.saves s where s.player_id = acct;
  return jsonb_build_object('player', acct, 'secret', key, 'rev', coalesce(r, 0));
end $$;

-- Which providers this player is signed in with (shown in Cuenta).
create or replace function public.taquito_identities(p_player uuid, p_secret text)
returns text[]
language plpgsql security definer set search_path = '' as $$
begin
  perform taquito.check_player(p_player, p_secret);
  return array(select i.provider from taquito.identities i where i.player_id = p_player order by i.provider);
end $$;

revoke all on function taquito.valid_save(jsonb) from public, anon, authenticated;
revoke all on function taquito.save_summary(jsonb, bigint) from public, anon, authenticated;
revoke all on function public.taquito_save_sync(uuid, text, jsonb, bigint, int) from public;
revoke all on function public.taquito_save_pull(uuid, text) from public;
revoke all on function public.taquito_identities(uuid, text) from public;
revoke all on function public.taquito_identity_login(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.taquito_identity_switch(text, text, uuid, text, text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.taquito_save_sync(uuid, text, jsonb, bigint, int) to anon, authenticated, service_role;
grant execute on function public.taquito_save_pull(uuid, text) to anon, authenticated, service_role;
grant execute on function public.taquito_identities(uuid, text) to anon, authenticated, service_role;
grant execute on function public.taquito_identity_login(text, text, uuid, text) to service_role;
grant execute on function public.taquito_identity_switch(text, text, uuid, text, text, jsonb, bigint) to service_role;
