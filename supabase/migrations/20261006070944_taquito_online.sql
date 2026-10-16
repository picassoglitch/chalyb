-- De Taquito a Imperio: online rankings, friends' activity and cloud saves.
--
-- Lives in nexo-ai next to the Chalyb hub but touches nothing of the hub's:
-- everything is in the `taquito` schema (not exposed through the API) plus
-- `public.taquito_*` RPCs, which are the only way in.
--
-- No Supabase Auth on purpose: a sign-in creates a hub profile
-- (tg_handle_new_user on auth.users), and game players are not Chalyb users.
-- Instead each device makes a random player id + secret; the first write
-- registers the pair and every later write must present the same secret.
-- Scores are self-reported by the client (as in any client-side game), so
-- the RPCs clamp them to plausible ranges.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists taquito;
revoke all on schema taquito from public;
revoke all on schema taquito from anon, authenticated;

create table if not exists taquito.players (
  id uuid primary key,
  secret_hash bytea not null,
  name text not null default '',
  avatar int not null default 0,
  city text not null default '',
  friend_code text not null default '',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists taquito_players_friend_code on taquito.players (friend_code);

-- One row per player per week (Monday, Mexico City time).
create table if not exists taquito.weekly (
  player_id uuid not null references taquito.players (id) on delete cascade,
  week date not null,
  career int not null default 0,
  daily int not null default 0,
  duel_wins int not null default 0,
  primary key (player_id, week)
);
create index if not exists taquito_weekly_career on taquito.weekly (week, career desc);
create index if not exists taquito_weekly_daily on taquito.weekly (week, daily desc);
create index if not exists taquito_weekly_duels on taquito.weekly (week, duel_wins desc);

create table if not exists taquito.saves (
  player_id uuid primary key references taquito.players (id) on delete cascade,
  data jsonb not null,
  -- Client clock (ms) of the save: an older copy never overwrites a newer one.
  saved_at bigint not null,
  updated_at timestamptz not null default now()
);

alter table taquito.players enable row level security;
alter table taquito.weekly enable row level security;
alter table taquito.saves enable row level security;
revoke all on all tables in schema taquito from public, anon, authenticated;

create or replace function taquito.this_week() returns date
language sql stable set search_path = '' as $$
  select date_trunc('week', now() at time zone 'America/Mexico_City')::date
$$;

-- Registers the player on first use; afterwards the secret must match.
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
  if not exists (select 1 from taquito.players where id = p_player and secret_hash = h) then
    raise exception 'taquito: bad credentials' using errcode = '28000';
  end if;
end $$;

create or replace function taquito.clean_name(p text) returns text
language sql immutable set search_path = '' as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '[[:cntrl:]]', '', 'g')), 24)
$$;

-- Profile + this week's bests. Bests only go up (greatest), clamped to sane ranges.
create or replace function public.taquito_submit(
  p_player uuid, p_secret text, p_name text, p_avatar int, p_city text, p_friend_code text,
  p_career int, p_daily int, p_duel_wins int
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  wk date := taquito.this_week();
begin
  perform taquito.check_player(p_player, p_secret);
  update taquito.players set
    name = taquito.clean_name(p_name),
    avatar = least(greatest(coalesce(p_avatar, 0), 0), 99),
    city = left(coalesce(p_city, ''), 24),
    friend_code = case when p_friend_code ~ '^\d{6}$' then p_friend_code else friend_code end,
    last_seen = now()
  where id = p_player;
  insert into taquito.weekly (player_id, week, career, daily, duel_wins)
  values (
    p_player, wk,
    least(greatest(coalesce(p_career, 0), 0), 50000),
    least(greatest(coalesce(p_daily, 0), 0), 50000),
    least(greatest(coalesce(p_duel_wins, 0), 0), 1000)
  )
  on conflict (player_id, week) do update set
    career = greatest(taquito.weekly.career, excluded.career),
    daily = greatest(taquito.weekly.daily, excluded.daily),
    duel_wins = greatest(taquito.weekly.duel_wins, excluded.duel_wins);
end $$;

-- This week's top players, nationally (p_city null/'') or for one city.
-- p_metric: 'career' | 'daily' | 'duel_wins'. Players are identified by friend code.
create or replace function public.taquito_leaderboard(p_metric text, p_city text default null, p_limit int default 50)
returns table (rank bigint, friend_code text, name text, avatar int, city text, value int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_metric not in ('career', 'daily', 'duel_wins') then
    raise exception 'taquito: bad metric' using errcode = '22023';
  end if;
  return query
    select row_number() over (order by v.value desc, p.created_at), p.friend_code, p.name, p.avatar, p.city, v.value
    from (
      select w.player_id,
        case p_metric when 'career' then w.career when 'daily' then w.daily else w.duel_wins end as value
      from taquito.weekly w
      where w.week = taquito.this_week()
    ) v
    join taquito.players p on p.id = v.player_id
    where v.value > 0 and (coalesce(p_city, '') = '' or p.city = p_city)
    order by v.value desc, p.created_at
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;

-- Friends' profiles and this week's numbers, by friend code (max 100 codes).
create or replace function public.taquito_friends(p_codes text[])
returns table (friend_code text, name text, avatar int, city text, last_seen timestamptz, career int, daily int, duel_wins int)
language sql stable security definer set search_path = '' as $$
  select p.friend_code, p.name, p.avatar, p.city, p.last_seen,
    coalesce(w.career, 0), coalesce(w.daily, 0), coalesce(w.duel_wins, 0)
  from taquito.players p
  left join taquito.weekly w on w.player_id = p.id and w.week = taquito.this_week()
  where p.friend_code = any (p_codes[1:100]) and p.friend_code <> ''
$$;

-- Cloud save. Returns the saved_at now stored (the caller's, or a newer one it lost to).
create or replace function public.taquito_save_put(p_player uuid, p_secret text, p_data jsonb, p_saved_at bigint)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  stored bigint;
begin
  perform taquito.check_player(p_player, p_secret);
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 200000 then
    raise exception 'taquito: bad save' using errcode = '22023';
  end if;
  insert into taquito.saves (player_id, data, saved_at) values (p_player, p_data, p_saved_at)
  on conflict (player_id) do update set data = excluded.data, saved_at = excluded.saved_at, updated_at = now()
    where taquito.saves.saved_at < excluded.saved_at;
  select saved_at into stored from taquito.saves where player_id = p_player;
  return stored;
end $$;

create or replace function public.taquito_save_get(p_player uuid, p_secret text)
returns table (data jsonb, saved_at bigint)
language plpgsql security definer set search_path = '' as $$
begin
  perform taquito.check_player(p_player, p_secret);
  return query select s.data, s.saved_at from taquito.saves s where s.player_id = p_player;
end $$;

-- Internal helpers are not callable through the API; the five RPCs are.
revoke all on function taquito.this_week() from public, anon, authenticated;
revoke all on function taquito.check_player(uuid, text) from public, anon, authenticated;
revoke all on function taquito.clean_name(text) from public, anon, authenticated;
revoke all on function public.taquito_submit(uuid, text, text, int, text, text, int, int, int) from public;
revoke all on function public.taquito_leaderboard(text, text, int) from public;
revoke all on function public.taquito_friends(text[]) from public;
revoke all on function public.taquito_save_put(uuid, text, jsonb, bigint) from public;
revoke all on function public.taquito_save_get(uuid, text) from public;
grant execute on function public.taquito_submit(uuid, text, text, int, text, text, int, int, int) to anon, authenticated, service_role;
grant execute on function public.taquito_leaderboard(text, text, int) to anon, authenticated, service_role;
grant execute on function public.taquito_friends(text[]) to anon, authenticated, service_role;
grant execute on function public.taquito_save_put(uuid, text, jsonb, bigint) to anon, authenticated, service_role;
grant execute on function public.taquito_save_get(uuid, text) to anon, authenticated, service_role;
