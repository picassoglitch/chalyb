-- De Taquito a Imperio: the Platillo del Día is ranked within kitchen tiers (Aldo, 12 Oct 2026; tiers
-- pending his OK, PR "Platillo y Duelo: solo con la cocina desbloqueada").
--
-- The Platillo now uses each player's own kitchen (src/sim/config.ts dailyConfig(date, day)), so a
-- Día-3 kitchen (pastor, suadero) and a Día-6 one (+ piña, bistec, two-taco orders) can't share a
-- board. taquito-verify sends the run's tier (kitchenTier(day): 1 Día 3, 2 Día 4, 3 Día 5, 4 Día 6+).
-- A. taquito.runs.tier: the tier of a Platillo run (null for career, duels and runs from before).
-- B. taquito_record_run takes p_tier (default null, so a taquito-verify that doesn't send it yet keeps
--    working); the 8-argument version is dropped so calls aren't ambiguous. Otherwise unchanged.
-- C. taquito_leaderboard takes p_tier (default null: the old weekly boards, unchanged). With
--    p_metric 'daily' and a tier, it ranks each player's best counted Platillo run of this week in
--    that tier (from taquito.runs: no hard flag, not voided). weekly.daily keeps every tier mixed
--    (Tu semana, friends); it's no longer what the Platillo board shows.

alter table taquito.runs add column if not exists tier smallint;
create index if not exists taquito_runs_daily_tier on taquito.runs (tier, created_at) where mode = 'daily';

drop function if exists public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb);

-- Called by the edge function after it replayed the run. p_mode 'poll' only asks for a duel verdict.
-- p_flags: plausibility.ts's measures of the log; only admin_void_run sets "void".
-- p_tier: a Platillo run's kitchen tier (1-4); ignored for other modes.
create or replace function public.taquito_record_run(
  p_player uuid, p_secret text, p_mode text, p_seed bigint, p_rival uuid, p_earned int, p_log jsonb,
  p_flags jsonb default '{}', p_tier smallint default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  wk date := taquito.this_week();
  flags jsonb := coalesce(p_flags, '{}');
  counts boolean;
begin
  perform taquito.check_player(p_player, p_secret);
  if p_mode = 'poll' then
    if p_rival is null then raise exception 'taquito: rival needed' using errcode = '22023'; end if;
    return taquito.duel_verdict(p_player, p_seed, p_rival);
  end if;
  if p_mode not in ('career', 'daily', 'duel') or p_earned is null or p_earned < 0 or p_earned > 100000 then
    raise exception 'taquito: bad run' using errcode = '22023';
  end if;
  if p_tier is not null and (p_tier < 1 or p_tier > 4) then
    raise exception 'taquito: bad tier' using errcode = '22023';
  end if;
  if jsonb_typeof(flags) <> 'object' or octet_length(flags::text) > 2048 then
    raise exception 'taquito: bad flags' using errcode = '22023';
  end if;
  flags := flags - 'void';
  if not taquito.runs_allowed(p_player) then
    raise exception 'taquito: too many runs' using errcode = '54000';
  end if;
  update taquito.players set last_seen = now() where id = p_player;
  if taquito.run_flagged(flags) then
    insert into taquito.weekly (player_id, week, flagged) values (p_player, wk, true)
    on conflict (player_id, week) do update set flagged = true;
  end if;

  if p_mode = 'duel' then
    if p_rival is null or p_rival = p_player then raise exception 'taquito: rival needed' using errcode = '22023'; end if;
    insert into taquito.runs (player_id, mode, seed, rival_id, earned, log, flags)
    values (p_player, 'duel', p_seed, p_rival, p_earned, p_log, flags)
    on conflict (player_id, seed) where mode = 'duel' do nothing; -- one run per duel, no do-overs
    return taquito.duel_verdict(p_player, p_seed, p_rival);
  end if;

  counts := taquito.run_counts(flags) and (p_mode <> 'career' or (
    select count(*) from taquito.runs r
    where r.player_id = p_player and r.mode = 'career'
      and r.created_at >= (date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')
  ) < 20);
  insert into taquito.runs (player_id, mode, seed, earned, log, flags, tier)
  values (p_player, p_mode, p_seed, p_earned, p_log, flags, case when p_mode = 'daily' then p_tier end);
  if counts then
    insert into taquito.weekly (player_id, week, career, daily)
    values (p_player, wk, case when p_mode = 'career' then p_earned else 0 end, case when p_mode = 'daily' then p_earned else 0 end)
    on conflict (player_id, week) do update set
      career = greatest(taquito.weekly.career, excluded.career),
      daily = greatest(taquito.weekly.daily, excluded.daily);
  end if;
  return jsonb_build_object('status', 'recorded', 'earned', p_earned);
end $$;

drop function if exists public.taquito_leaderboard(text, text, int);

-- This week's top players, nationally (p_city null/'') or for one city.
-- p_metric: 'career' | 'daily' | 'duel_wins'. Players are identified by friend code.
-- p_tier (only with 'daily'): the Platillo board of that kitchen tier, from the runs themselves.
create or replace function public.taquito_leaderboard(p_metric text, p_city text default null, p_limit int default 50, p_tier smallint default null)
returns table (rank bigint, friend_code text, name text, avatar int, city text, value int)
language plpgsql stable security definer set search_path = '' as $$
declare
  week_start timestamptz := taquito.this_week()::timestamp at time zone 'America/Mexico_City';
begin
  if p_metric not in ('career', 'daily', 'duel_wins') then
    raise exception 'taquito: bad metric' using errcode = '22023';
  end if;
  if p_tier is not null and (p_metric <> 'daily' or p_tier < 1 or p_tier > 4) then
    raise exception 'taquito: bad tier' using errcode = '22023';
  end if;
  return query
    select row_number() over (order by v.value desc, p.created_at), p.friend_code, p.name, p.avatar, p.city, v.value
    from (
      select w.player_id,
        case p_metric when 'career' then w.career when 'daily' then w.daily else w.duel_wins end as value
      from taquito.weekly w
      where p_tier is null and w.week = taquito.this_week()
      union all
      select x.player_id, max(x.earned) as value
      from taquito.runs x
      where p_tier is not null and x.mode = 'daily' and x.tier = p_tier and x.created_at >= week_start
        and taquito.run_counts(x.flags)
      group by x.player_id
    ) v
    join taquito.players p on p.id = v.player_id
    where v.value > 0 and (coalesce(p_city, '') = '' or p.city = p_city)
    order by v.value desc, p.created_at
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;

revoke all on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint) from public, anon, authenticated;
grant execute on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint) to service_role;
revoke all on function public.taquito_leaderboard(text, text, int, smallint) from public;
grant execute on function public.taquito_leaderboard(text, text, int, smallint) to anon, authenticated, service_role;
