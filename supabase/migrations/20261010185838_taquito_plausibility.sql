-- De Taquito a Imperio: plausibility flags, a daily cap on counted career runs and an admin void
-- (security audit SEC-game-2, 10 Oct 2026).
--
-- The replay proves a run is possible with the game's rules, not that a person played it: the
-- bot that ships in the client replays to top scores. taquito-verify now measures each tap log
-- (supabase/functions/taquito-verify/plausibility.ts) and sends the result as p_flags.
-- A. taquito.runs.flags keeps those measures. A run whose flags list a hard flag ("hard" is not
--    empty) is still recorded, but its score stays off the weekly board and a duel win from it is
--    decided as usual but not counted (taquito.duels.counted). weekly.flagged marks the week.
-- B. Career seeds come from the phone, so a script can search seeds for its best score: only the
--    player's first 20 career runs of a day (Mexico City) count toward weekly.career.
-- C. taquito.admin_void_run(run id), service role only: marks the run void (flags.void = when)
--    and recomputes that week's career and daily without it; a counted duel win from it comes off.
-- p_flags defaults to '{}', so a taquito-verify that doesn't send it yet keeps working; the old
-- 7-argument taquito_record_run is dropped so those calls aren't ambiguous.

alter table taquito.runs add column if not exists flags jsonb not null default '{}';
alter table taquito.weekly add column if not exists flagged boolean not null default false;

-- Whether a run's flags list any hard flag.
create or replace function taquito.run_flagged(p_flags jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_flags -> 'hard') = 'array' then jsonb_array_length(p_flags -> 'hard') > 0 else false end
$$;

-- Whether a run may count on the weekly board: no hard flag and not voided.
create or replace function taquito.run_counts(p_flags jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select not taquito.run_flagged(p_flags) and not coalesce(p_flags ? 'void', false)
$$;

-- Win/loss for `p_player` once both runs of a duel are in; records the duel once.
-- As in the duel_integrity migration, plus: a win from a flagged or voided run doesn't count.
create or replace function taquito.duel_verdict(p_player uuid, p_seed bigint, p_rival uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  mine int;
  theirs int;
  mine_at timestamptz;
  theirs_at timestamptz;
  mine_flags jsonb;
  theirs_flags jsonb;
  a uuid := least(p_player, p_rival);
  b uuid := greatest(p_player, p_rival);
  wk date := taquito.this_week();
  w uuid;
  loser uuid;
  counts boolean;
  inserted int;
begin
  select r.earned, r.created_at, r.flags into mine, mine_at, mine_flags from taquito.runs r
    where r.player_id = p_player and r.seed = p_seed and r.mode = 'duel' and r.rival_id = p_rival;
  select r.earned, r.created_at, r.flags into theirs, theirs_at, theirs_flags from taquito.runs r
    where r.player_id = p_rival and r.seed = p_seed and r.mode = 'duel' and r.rival_id = p_player;
  if mine is null or theirs is null then
    return jsonb_build_object('status', 'pending', 'mine', mine);
  end if;
  w := case when mine > theirs then p_player when theirs > mine then p_rival end;
  if not exists (select 1 from taquito.duels d where d.seed = p_seed and d.player_a = a and d.player_b = b) then
    loser := case when w = p_player then p_rival else p_player end;
    counts := w is not null
      and taquito.run_counts(case when w = p_player then mine_flags else theirs_flags end)
      and exists (select 1 from taquito.players p
        where p.id = loser and p.created_at <= least(mine_at, theirs_at) - interval '10 minutes')
      and exists (select 1 from taquito.runs r where r.player_id = loser and r.mode in ('career', 'daily'))
      and abs(extract(epoch from mine_at - theirs_at)) <= 300
      and (select count(*) from taquito.duels d
        where d.week = wk and d.winner = w and d.counted and d.player_a = a and d.player_b = b) < 3
      and (select count(distinct case when d.player_a = w then d.player_b else d.player_a end) from taquito.duels d
        where d.week = wk and d.winner = w and d.counted and not (d.player_a = a and d.player_b = b)) < 10;
    insert into taquito.duels (seed, player_a, player_b, winner, week, counted) values (p_seed, a, b, w, wk, counts)
    on conflict do nothing;
    get diagnostics inserted = row_count;
    if inserted = 1 and counts then
      insert into taquito.weekly (player_id, week, duel_wins) values (w, wk, 1)
      on conflict (player_id, week) do update set duel_wins = taquito.weekly.duel_wins + 1;
    end if;
  end if;
  return jsonb_build_object(
    'status', 'decided', 'mine', mine, 'theirs', theirs,
    'result', case when w is null then 'tie' when w = p_player then 'win' else 'loss' end
  );
end $$;

drop function if exists public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb);

-- Called by the edge function after it replayed the run. p_mode 'poll' only asks for a duel verdict.
-- p_flags: plausibility.ts's measures of the log; only admin_void_run sets "void".
create or replace function public.taquito_record_run(
  p_player uuid, p_secret text, p_mode text, p_seed bigint, p_rival uuid, p_earned int, p_log jsonb,
  p_flags jsonb default '{}'
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
  insert into taquito.runs (player_id, mode, seed, earned, log, flags) values (p_player, p_mode, p_seed, p_earned, p_log, flags);
  if counts then
    insert into taquito.weekly (player_id, week, career, daily)
    values (p_player, wk, case when p_mode = 'career' then p_earned else 0 end, case when p_mode = 'daily' then p_earned else 0 end)
    on conflict (player_id, week) do update set
      career = greatest(taquito.weekly.career, excluded.career),
      daily = greatest(taquito.weekly.daily, excluded.daily);
  end if;
  return jsonb_build_object('status', 'recorded', 'earned', p_earned);
end $$;

-- Takes a run off the boards (the Terms' "podemos quitar resultados"): the run stays recorded,
-- marked void, and its week's career and daily are recomputed from the runs that still count
-- (first 20 career runs of each day, no hard flag, not voided). Returns that week's row.
create or replace function taquito.admin_void_run(p_run bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  wk date;
  week_start timestamptz;
  dwk date;
  result jsonb;
begin
  select * into r from taquito.runs where id = p_run for update;
  if not found then
    raise exception 'taquito: no such run' using errcode = 'P0002';
  end if;
  wk := date_trunc('week', r.created_at at time zone 'America/Mexico_City')::date;
  week_start := wk::timestamp at time zone 'America/Mexico_City';
  if not (r.flags ? 'void') then
    update taquito.runs set flags = r.flags || jsonb_build_object('void', now()) where id = p_run;
  end if;
  if r.mode = 'duel' then
    update taquito.duels d set counted = false
    where d.seed = r.seed and d.player_a = least(r.player_id, r.rival_id) and d.player_b = greatest(r.player_id, r.rival_id)
      and d.winner = r.player_id and d.counted
    returning d.week into dwk;
    if found then
      update taquito.weekly w set duel_wins = greatest(w.duel_wins - 1, 0) where w.player_id = r.player_id and w.week = dwk;
    end if;
  end if;
  update taquito.weekly w set
    career = coalesce((
      select max(c.earned) from (
        select x.earned, x.flags,
          row_number() over (partition by (x.created_at at time zone 'America/Mexico_City')::date order by x.created_at, x.id) as nth
        from taquito.runs x
        where x.player_id = r.player_id and x.mode = 'career'
          and x.created_at >= week_start and x.created_at < week_start + interval '7 days'
      ) c
      where c.nth <= 20 and taquito.run_counts(c.flags)), 0),
    daily = coalesce((
      select max(x.earned) from taquito.runs x
      where x.player_id = r.player_id and x.mode = 'daily' and taquito.run_counts(x.flags)
        and x.created_at >= week_start and x.created_at < week_start + interval '7 days'), 0)
  where w.player_id = r.player_id and w.week = wk;
  select to_jsonb(w) - 'player_id' into result from taquito.weekly w where w.player_id = r.player_id and w.week = wk;
  return result;
end $$;

revoke all on function taquito.run_flagged(jsonb) from public, anon, authenticated;
revoke all on function taquito.run_counts(jsonb) from public, anon, authenticated;
revoke all on function taquito.duel_verdict(uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb) to service_role;
revoke all on function taquito.admin_void_run(bigint) from public, anon, authenticated;
grant execute on function taquito.admin_void_run(bigint) to service_role;
