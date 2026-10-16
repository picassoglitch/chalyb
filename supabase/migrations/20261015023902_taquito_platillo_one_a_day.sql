-- De Taquito a Imperio: one ranked Platillo a day, in the tier of the server's day (PR "Platillo: uno con ranking
-- al día", security P1, 14 Oct 2026).
--
-- The daily_one_ranked migration allowed one ranked Platillo per (player, date, kitchen tier), and the tier came
-- from the ticket's day, which the phone asked for: asking for days 3, 4, 5 and 6 gave 4 ranked attempts a day.
-- A. A Platillo ticket's day is the server's (taquito.known_day: recorded career runs, the save's
--    day up to 7), whatever the phone asks; so is its tier (taquito-verify: kitchenTier(ticket day)).
-- B. One ranked Platillo per (player, CDMX date): any later attempt that date, in any tier, is practice
--    (src/sim/config.ts rankedPlatillo; taquito_record_run; a unique index settles two at once).
--    The per-tier boards stay as they are.
-- C. Dates that already have two ranked Platillos (other tiers) keep the first; the later ones become practice
--    and that week's weekly.daily is counted again without them.

-- C. Before the new index: the later ranked Platillos of a date become practice.
with extra as (
  select r.id, r.player_id, date_trunc('week', r.created_at at time zone 'America/Mexico_City')::date as wk
  from (
    select x.id, x.player_id, x.created_at,
      row_number() over (partition by x.player_id, x.daily_date order by x.created_at, x.id) as nth
    from taquito.runs x
    where x.mode = 'daily' and not x.practice and x.daily_date is not null
  ) r
  where r.nth > 1
), marked as (
  update taquito.runs x set practice = true from extra e where x.id = e.id
  returning e.player_id, e.wk
)
update taquito.weekly w set daily = coalesce((
    select max(x.earned) from taquito.runs x
    where x.player_id = w.player_id and x.mode = 'daily' and not x.practice and taquito.run_counts(x.flags)
      and x.created_at >= w.week::timestamp at time zone 'America/Mexico_City'
      and x.created_at < (w.week + 7)::timestamp at time zone 'America/Mexico_City'
      and x.id not in (select e.id from extra e)), 0)
where (w.player_id, w.week) in (select m.player_id, m.wk from marked m);

drop index if exists taquito.taquito_runs_one_ranked_daily;
create unique index if not exists taquito_runs_one_ranked_daily_date on taquito.runs (player_id, daily_date)
  where mode = 'daily' and not practice;

create or replace function public.taquito_begin_run(
  p_player uuid, p_secret text, p_mode text, p_day int default null, p_seed bigint default null,
  p_rival uuid default null, p_match uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
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
  if p_mode = 'daily' and (select count(*) from taquito.run_tickets x
      where x.player_id = p_player and x.mode = 'daily' and x.daily_date = (now() at time zone 'America/Mexico_City')::date) >= 50 then
    raise exception 'taquito: too many Platillos today' using errcode = '54000';
  end if;
  -- The server's seed: career's at random, a live duel's shared with the rival (p_seed is ignored).
  s := case p_mode
    when 'career' then ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint
    when 'duel' then taquito.duel_seed(p_player, p_rival, p_match)
  end;
  -- One open ticket; an abandoned career ticket is a run of 0 (duel_seed migration).
  perform taquito.abandon_tickets(p_player);

  known := taquito.known_day(p_player);
  -- The Platillo ranks in the tier of the server's day, never one the phone picks; other modes may ask for
  -- a lower day (an older phone) or one more (a run on its way).
  d := case when p_mode = 'daily' then known else least(coalesce(p_day, known), known + 1, 10000) end;
  k := jsonb_build_object('upgrades', taquito.upgrade_levels(p_player), 'locUpgrades', '{}'::jsonb);

  insert into taquito.run_tickets (player_id, mode, seed, daily_date, day, kit, rival_id)
  values (p_player, p_mode, s, (now() at time zone 'America/Mexico_City')::date, d, k, case when p_mode = 'duel' then p_rival end)
  returning * into t;
  return jsonb_build_object('ticket', t.nonce, 'seed', t.seed, 'date', t.daily_date, 'day', t.day, 'kit', t.kit)
    || case when p_mode = 'daily' then jsonb_build_object('earlier', taquito.earlier_platillos(t)) else '{}' end
    || case when p_mode = 'duel' then jsonb_build_object('rival', t.rival_id) else '{}' end;
end $$;

-- As in the duel_seed migration; a Platillo is practice when the player has a ranked one that date, any tier.
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
    where t.nonce = p_ticket and t.player_id = p_player and t.mode = p_mode and t.used_at is null and t.voided_at is null
      and t.expires_at > now()
      and (p_mode = 'daily' or t.seed = p_seed)
      and (p_mode <> 'duel' or t.rival_id = p_rival)
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

  -- The Platillo: the first run of a date is the ranked one, in any tier; later ones are practice.
  if p_mode = 'daily' then
    practice := coalesce(p_practice, false) or exists (select 1 from taquito.runs r
      where r.player_id = p_player and r.mode = 'daily' and r.daily_date = ddate and not r.practice);
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

revoke all on function public.taquito_begin_run(uuid, text, text, int, bigint, uuid, uuid) from public;
grant execute on function public.taquito_begin_run(uuid, text, text, int, bigint, uuid, uuid) to anon, authenticated, service_role;
revoke all on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint, uuid, boolean) from public, anon, authenticated;
grant execute on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint, uuid, boolean) to service_role;
