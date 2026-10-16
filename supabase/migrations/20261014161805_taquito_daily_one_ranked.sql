-- De Taquito a Imperio: one ranked Platillo del Día per day and kitchen tier (PR "Platillo: un intento
-- con ranking al día", P1, 12 Oct 2026).
--
-- The Platillo's seed is public and the same all day, so unlimited attempts let anyone learn it and
-- replay their best. Now the first attempt of a date in a kitchen tier is ranked and later ones are
-- saved as practice ("Práctica (no cuenta para el ranking)").
-- A. taquito.runs.daily_date (the run ticket's CDMX date) and taquito.runs.practice; a unique index
--    allows one ranked Platillo per (player, daily_date, tier).
-- B. The attempt is the first Platillo *ticket* of the date in that tier, so quitting a bad attempt
--    and starting over doesn't give a new ranked one. Tiers are computed in one place
--    (src/sim/config.ts kitchenTier): begin_run and run_ticket return `earlier`, the days of the
--    player's earlier Platillo tickets of that date, and taquito-verify sends p_practice.
--    taquito_record_run also checks the stored runs, and the unique index settles two at once.
--    Platillo tickets are no longer dropped by the 30-open cap; at most 50 per player per date.
-- C. Practice runs never reach weekly.daily, the per-tier board or admin_void_run's recount.
--    record_run answers practice: true/false for Platillo runs.

alter table taquito.runs add column if not exists daily_date date;
alter table taquito.runs add column if not exists practice boolean not null default false;
create unique index if not exists taquito_runs_one_ranked_daily on taquito.runs (player_id, daily_date, tier)
  where mode = 'daily' and not practice;
create index if not exists taquito_run_tickets_daily on taquito.run_tickets (player_id, daily_date) where mode = 'daily';

-- Days of the player's Platillo tickets of the same date made before this one (oldest first).
create or replace function taquito.earlier_platillos(t taquito.run_tickets) returns int[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(x.day order by x.created_at, x.nonce), '{}') from taquito.run_tickets x
  where x.player_id = t.player_id and x.mode = 'daily' and x.daily_date = t.daily_date
    and (x.created_at, x.nonce) < (t.created_at, t.nonce)
$$;

create or replace function public.taquito_begin_run(p_player uuid, p_secret text, p_mode text, p_day int default null, p_seed bigint default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  sv jsonb;
  save_day int := 1;
  career_runs int;
  known int;
  d int;
  s bigint;
  k jsonb;
  t taquito.run_tickets;
begin
  perform taquito.check_player(p_player, p_secret);
  if p_mode is null or p_mode not in ('career', 'daily', 'duel') then
    raise exception 'taquito: bad mode' using errcode = '22023';
  end if;
  if p_day is not null and (p_day < 1 or p_day > 10000) then
    raise exception 'taquito: bad day' using errcode = '22023';
  end if;
  if p_mode = 'duel' and (p_seed is null or p_seed < 0 or p_seed >= 4294967296) then
    raise exception 'taquito: duel seed needed' using errcode = '22023';
  end if;
  delete from taquito.run_tickets where expires_at < now();
  -- Abandoned shifts leave open tickets: keep the newest 29, so this one makes 30. Platillo tickets stay
  -- until they expire: the first one of a date is the ranked attempt (an abandoned one too).
  delete from taquito.run_tickets where nonce in (
    select x.nonce from taquito.run_tickets x where x.player_id = p_player and x.used_at is null and x.mode <> 'daily'
    order by x.created_at desc offset 29);
  if p_mode = 'daily' and (select count(*) from taquito.run_tickets x
      where x.player_id = p_player and x.mode = 'daily' and x.daily_date = (now() at time zone 'America/Mexico_City')::date) >= 50 then
    raise exception 'taquito: too many Platillos today' using errcode = '54000';
  end if;

  select sa.data into sv from taquito.saves sa where sa.player_id = p_player;
  if jsonb_typeof(sv -> 'day') = 'number' then
    save_day := least(greatest(floor((sv ->> 'day')::numeric), 1), 10000)::int;
  end if;
  select count(*) into career_runs from taquito.runs r where r.player_id = p_player and r.mode = 'career';
  known := greatest(save_day, least(1 + career_runs, 10000));
  d := least(coalesce(p_day, known), known + 1, 10000);
  s := case p_mode
    when 'career' then ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint
    when 'duel' then p_seed
  end;
  k := jsonb_build_object('upgrades', coalesce(sv -> 'upgrades', '{}'), 'locUpgrades', coalesce(sv -> 'locUpgrades', '{}'));
  if octet_length(k::text) > 4096 then k := '{}'; end if;

  insert into taquito.run_tickets (player_id, mode, seed, daily_date, day, kit)
  values (p_player, p_mode, s, (now() at time zone 'America/Mexico_City')::date, d, k)
  returning * into t;
  return jsonb_build_object('ticket', t.nonce, 'seed', t.seed, 'date', t.daily_date, 'day', t.day, 'kit', t.kit)
    || case when p_mode = 'daily' then jsonb_build_object('earlier', taquito.earlier_platillos(t)) else '{}' end;
end $$;

create or replace function public.taquito_run_ticket(p_player uuid, p_secret text, p_ticket uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t taquito.run_tickets;
begin
  perform taquito.check_player(p_player, p_secret);
  select * into t from taquito.run_tickets x
  where x.nonce = p_ticket and x.player_id = p_player and x.used_at is null and x.expires_at > now();
  if not found then return null; end if;
  return jsonb_build_object('mode', t.mode, 'seed', t.seed, 'date', t.daily_date, 'day', t.day, 'kit', t.kit)
    || case when t.mode = 'daily' then jsonb_build_object('earlier', taquito.earlier_platillos(t)) else '{}' end;
end $$;

drop function if exists public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint, uuid);

-- Called by the edge function after it replayed the run. p_mode 'poll' only asks for a duel verdict.
-- p_flags: plausibility.ts's measures of the log; only admin_void_run sets "void".
-- p_tier: a Platillo run's kitchen tier (1-4); ignored for other modes.
-- p_ticket: the run's ticket from taquito_begin_run, burned here in the same transaction as the run.
-- p_practice: taquito-verify's call that this Platillo isn't the first of its date and tier.
create or replace function public.taquito_record_run(
  p_player uuid, p_secret text, p_mode text, p_seed bigint, p_rival uuid, p_earned int, p_log jsonb,
  p_flags jsonb default '{}', p_tier smallint default null, p_ticket uuid default null, p_practice boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  wk date := taquito.this_week();
  flags jsonb := coalesce(p_flags, '{}');
  counts boolean;
  ddate date := (now() at time zone 'America/Mexico_City')::date;
  practice boolean := false;
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
  if p_ticket is not null then
    update taquito.run_tickets t set used_at = now()
    where t.nonce = p_ticket and t.player_id = p_player and t.mode = p_mode and t.used_at is null and t.expires_at > now()
      and (p_mode = 'daily' or t.seed = p_seed)
    returning t.daily_date into ddate;
    if not found then
      raise exception 'taquito: ticket refused' using errcode = '28000';
    end if;
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

  -- The Platillo: the first run of a date in a kitchen tier is the ranked one, later ones are practice.
  if p_mode = 'daily' then
    practice := coalesce(p_practice, false) or exists (select 1 from taquito.runs r
      where r.player_id = p_player and r.mode = 'daily' and r.daily_date = ddate and r.tier is not distinct from p_tier and not r.practice);
  end if;
  counts := not practice and taquito.run_counts(flags) and (p_mode <> 'career' or (
    select count(*) from taquito.runs r
    where r.player_id = p_player and r.mode = 'career'
      and r.created_at >= (date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')
  ) < 20);
  begin
    insert into taquito.runs (player_id, mode, seed, earned, log, flags, tier, daily_date, practice)
    values (p_player, p_mode, p_seed, p_earned, p_log, flags, case when p_mode = 'daily' then p_tier end,
      case when p_mode = 'daily' then ddate end, practice);
  exception when unique_violation then
    -- Another run of the same Platillo got in first (two sent at once): this one is practice.
    practice := true;
    counts := false;
    insert into taquito.runs (player_id, mode, seed, earned, log, flags, tier, daily_date, practice)
    values (p_player, p_mode, p_seed, p_earned, p_log, flags, p_tier, ddate, true);
  end;
  if counts then
    insert into taquito.weekly (player_id, week, career, daily)
    values (p_player, wk, case when p_mode = 'career' then p_earned else 0 end, case when p_mode = 'daily' then p_earned else 0 end)
    on conflict (player_id, week) do update set
      career = greatest(taquito.weekly.career, excluded.career),
      daily = greatest(taquito.weekly.daily, excluded.daily);
  end if;
  return jsonb_build_object('status', 'recorded', 'earned', p_earned) || case when p_mode = 'daily' then jsonb_build_object('practice', practice) else '{}' end;
end $$;

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
      where p_tier is not null and x.mode = 'daily' and x.tier = p_tier and x.created_at >= week_start and not x.practice
        and taquito.run_counts(x.flags)
      group by x.player_id
    ) v
    join taquito.players p on p.id = v.player_id
    where v.value > 0 and (coalesce(p_city, '') = '' or p.city = p_city)
    order by v.value desc, p.created_at
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;

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
      where x.player_id = r.player_id and x.mode = 'daily' and not x.practice and taquito.run_counts(x.flags)
        and x.created_at >= week_start and x.created_at < week_start + interval '7 days'), 0)
  where w.player_id = r.player_id and w.week = wk;
  select to_jsonb(w) - 'player_id' into result from taquito.weekly w where w.player_id = r.player_id and w.week = wk;
  return result;
end $$;

revoke all on function taquito.earlier_platillos(taquito.run_tickets) from public, anon, authenticated;
revoke all on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint, uuid, boolean) from public, anon, authenticated;
grant execute on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint, uuid, boolean) to service_role;
revoke all on function taquito.admin_void_run(bigint) from public, anon, authenticated;
grant execute on function taquito.admin_void_run(bigint) to service_role;
