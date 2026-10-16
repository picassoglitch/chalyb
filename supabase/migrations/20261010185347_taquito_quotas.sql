-- De Taquito a Imperio: quotas for anonymous callers (security audit SEC-api-1, 10 Oct 2026).
--
-- Every write registers an unknown player id on the spot and ids are free, so one caller could
-- fill the shared database with players, saves and run logs.
-- A. New players: at most 20 per IP an hour (taquito.client_ip(), from the request headers
--    PostgREST passes) and 2 000 an hour project-wide (circuit breaker). Players already
--    registered are never held back by either.
-- B. Saves: 64 KB at most (real ones are ~15 KB), and each top-level key the client writes must
--    have the type src/meta/save.ts fresh() gives it. Keys it no longer writes (old saves) pass.
-- C. Runs: 200 per player a day on top of 60 an hour. taquito_can_record lets taquito-verify
--    check credentials and both caps before it spends a replay. taquito.purge_runs_logs drops
--    old tap logs (the run and its score stay); scheduling it (pg_cron) is a dashboard step.

create table if not exists taquito.registrations (
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists taquito_registrations_time on taquito.registrations (created_at);
create index if not exists taquito_players_created on taquito.players (created_at);
alter table taquito.registrations enable row level security;
revoke all on taquito.registrations from public, anon, authenticated;

-- A purged run keeps its row and score, with a null log.
alter table taquito.runs alter column log drop not null;

-- The caller's address for per-IP quotas, or null without request headers (SQL editor, tests).
-- cf-connecting-ip is set by Cloudflare in front of the project; x-real-ip by a proxy; the first
-- x-forwarded-for entry is the client's own word, so it only counts when neither is there.
-- Every per-IP check reads this one function, so the order can change once real headers are seen.
create or replace function taquito.client_ip() returns text
language sql stable set search_path = '' as $$
  select coalesce(
    nullif(btrim(h ->> 'cf-connecting-ip'), ''),
    nullif(btrim(h ->> 'x-real-ip'), ''),
    nullif(btrim(split_part(h ->> 'x-forwarded-for', ',', 1)), '')
  )
  from (select nullif(current_setting('request.headers', true), '')::json as h) req
$$;

-- Registers the player on first use (within the quotas); afterwards the secret must match the
-- guest secret or one of the player's device keys.
create or replace function taquito.check_player(p_player uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  h bytea;
  src_ip text;
begin
  if p_player is null or p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    raise exception 'taquito: bad credentials' using errcode = '28000';
  end if;
  h := extensions.digest(p_secret, 'sha256');
  if not exists (select 1 from taquito.players where id = p_player) then
    -- No header (SQL editor, tests): no per-IP check. The Edge Functions call as service_role
    -- from IPs every player shares, so they are left to the global breaker.
    if current_setting('role', true) is distinct from 'service_role' then
      src_ip := taquito.client_ip();
    end if;
    if src_ip is not null then
      delete from taquito.registrations where created_at < now() - interval '1 hour'; -- IPs are kept one hour
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
  end if;
  if not exists (select 1 from taquito.players where id = p_player and secret_hash = h)
    and not exists (select 1 from taquito.device_keys where player_id = p_player and secret_hash = h) then
    raise exception 'taquito: bad credentials' using errcode = '28000';
  end if;
end $$;

-- Top-level types as src/meta/save.ts fresh() writes them (daily may be null). Nested levels
-- and keys not listed here (fields older clients still carry) are not checked.
create or replace function taquito.valid_save(p_data jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare
  shape constant jsonb := '{
    "varos": "number", "chiles": "number", "day": "number", "menuSeen": "number",
    "tutorialDone": "boolean", "sound": "boolean",
    "location": "string", "city": "string", "careerDate": "string", "dailyPopupDate": "string",
    "unlocked": "array", "chests": "array", "inbox": "array", "friends": "array", "duelHistory": "array", "tips": "array",
    "upgrades": "object", "stars": "object", "daily": "object", "duel": "object", "totals": "object", "stats": "object",
    "profile": "object", "settings": "object", "locUpgrades": "object", "missions": "object", "achievements": "object",
    "login": "object", "cosmetics": "object", "recipes": "object", "album": "object", "pass": "object", "noAds": "object",
    "weekly": "object", "seen": "object", "empire": "object", "tipPile": "object"
  }';
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 65536 then
    raise exception 'taquito: bad save' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(p_data) e
    where shape ? e.key and jsonb_typeof(e.value) <> shape ->> e.key
      and not (e.key = 'daily' and jsonb_typeof(e.value) = 'null')
  ) then
    raise exception 'taquito: bad save' using errcode = '22023';
  end if;
end $$;

-- Whether a player may record another run: under 60 in the last hour and 200 in the last day.
create or replace function taquito.runs_allowed(p_player uuid) returns boolean
language sql stable set search_path = '' as $$
  select count(*) filter (where r.created_at > now() - interval '1 hour') < 60 and count(*) < 200
  from taquito.runs r
  where r.player_id = p_player and r.created_at > now() - interval '1 day'
$$;

-- Called by the edge function after it replayed the run. p_mode 'poll' only asks for a duel verdict.
create or replace function public.taquito_record_run(
  p_player uuid, p_secret text, p_mode text, p_seed bigint, p_rival uuid, p_earned int, p_log jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  wk date := taquito.this_week();
begin
  perform taquito.check_player(p_player, p_secret);
  if p_mode = 'poll' then
    if p_rival is null then raise exception 'taquito: rival needed' using errcode = '22023'; end if;
    return taquito.duel_verdict(p_player, p_seed, p_rival);
  end if;
  if p_mode not in ('career', 'daily', 'duel') or p_earned is null or p_earned < 0 or p_earned > 100000 then
    raise exception 'taquito: bad run' using errcode = '22023';
  end if;
  if not taquito.runs_allowed(p_player) then
    raise exception 'taquito: too many runs' using errcode = '54000';
  end if;
  update taquito.players set last_seen = now() where id = p_player;

  if p_mode = 'duel' then
    if p_rival is null or p_rival = p_player then raise exception 'taquito: rival needed' using errcode = '22023'; end if;
    insert into taquito.runs (player_id, mode, seed, rival_id, earned, log)
    values (p_player, 'duel', p_seed, p_rival, p_earned, p_log)
    on conflict (player_id, seed) where mode = 'duel' do nothing; -- one run per duel, no do-overs
    return taquito.duel_verdict(p_player, p_seed, p_rival);
  end if;

  insert into taquito.runs (player_id, mode, seed, earned, log) values (p_player, p_mode, p_seed, p_earned, p_log);
  insert into taquito.weekly (player_id, week, career, daily)
  values (p_player, wk, case when p_mode = 'career' then p_earned else 0 end, case when p_mode = 'daily' then p_earned else 0 end)
  on conflict (player_id, week) do update set
    career = greatest(taquito.weekly.career, excluded.career),
    daily = greatest(taquito.weekly.daily, excluded.daily);
  return jsonb_build_object('status', 'recorded', 'earned', p_earned);
end $$;

-- taquito-verify asks this before replaying a run: false for an unknown id, a wrong secret or a
-- player over the run caps, so none of those costs a replay. Never registers anyone.
create or replace function public.taquito_can_record(p_player uuid, p_secret text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform taquito.auth_player(p_player, p_secret);
  return taquito.runs_allowed(p_player);
exception when invalid_authorization_specification then
  return false;
end $$;

-- Drops the tap logs of runs older than p_days; returns how many. For pg_cron or the service role.
create or replace function taquito.purge_runs_logs(p_days int default 30) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if p_days is null or p_days < 1 then
    raise exception 'taquito: bad days' using errcode = '22023';
  end if;
  update taquito.runs set log = null where log is not null and created_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function taquito.client_ip() from public, anon, authenticated;
revoke all on function taquito.runs_allowed(uuid) from public, anon, authenticated;
revoke all on function taquito.purge_runs_logs(int) from public, anon, authenticated;
revoke all on function public.taquito_can_record(uuid, text) from public, anon, authenticated;
grant execute on function taquito.purge_runs_logs(int) to service_role;
grant execute on function public.taquito_can_record(uuid, text) to service_role;
