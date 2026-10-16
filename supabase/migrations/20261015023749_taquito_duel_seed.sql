-- De Taquito a Imperio: the server picks a live duel's seed, and a player holds one open ticket (PR "Duelos:
-- semilla del servidor y un solo boleto abierto", security P1, 14 Oct 2026).
--
-- A duel ticket kept the seed the phone sent (the lobby's offer), and a player could hold 30 open tickets:
-- ask for many, replay each seed with a bot, and play only the best one.
-- A. taquito.duel_matches: one row per live duel, keyed by the sorted player pair and a match id the two
--    phones agreed on in the lobby (src/net/live.ts). The first of the two to ask creates the seed
--    (gen_random_bytes); the other gets the same one. At most 30 new duels a player per hour.
-- B. taquito_begin_run(..., p_rival, p_match): a duel ticket now needs the rival and the match id, never a
--    seed; p_seed is ignored (kept so the signature only grows). The ticket stores its rival.
-- C. One open ticket per player: a new ticket voids the player's unused ones (voided_at; the rows stay until
--    they expire, so the Platillo's "first ticket of the date is the ranked one" still sees them). The phone
--    sends a finished run still in its queue before asking for a new ticket, and plays unranked while it
--    can't (src/net/online.ts beginRun; Aldo, 14 Oct 2026: "new shift waits").
-- D. taquito_run_ticket and taquito_record_run take only open, unvoided tickets; a duel's ticket must be for
--    the run's rival (and seed, as before).
-- E. Abandoned career tickets are ranked 0 (below).

alter table taquito.run_tickets add column if not exists voided_at timestamptz;
alter table taquito.run_tickets add column if not exists rival_id uuid;
create index if not exists taquito_run_tickets_open on taquito.run_tickets (player_id) where used_at is null and voided_at is null;

create table if not exists taquito.duel_matches (
  player_a uuid not null references taquito.players (id) on delete cascade,
  player_b uuid not null references taquito.players (id) on delete cascade,
  match_id uuid not null,
  seed bigint not null check (seed between 0 and 4294967295),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (player_a, player_b, match_id),
  check (player_a < player_b)
);
create index if not exists taquito_duel_matches_by on taquito.duel_matches (created_by, created_at);
create index if not exists taquito_duel_matches_created on taquito.duel_matches (created_at);
alter table taquito.duel_matches enable row level security;
revoke all on taquito.duel_matches from public, anon, authenticated;

-- The seed of the live duel between p_player and p_rival with this match id, made once.
create or replace function taquito.duel_seed(p_player uuid, p_rival uuid, p_match uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  a uuid := least(p_player, p_rival);
  b uuid := greatest(p_player, p_rival);
  s bigint;
begin
  if p_rival is null or p_match is null or p_rival = p_player then
    raise exception 'taquito: duel rival and match needed' using errcode = '22023';
  end if;
  if not exists (select 1 from taquito.players p where p.id = p_rival) then
    raise exception 'taquito: no such rival' using errcode = '22023';
  end if;
  select m.seed into s from taquito.duel_matches m where m.player_a = a and m.player_b = b and m.match_id = p_match;
  if found then return s; end if;
  delete from taquito.duel_matches m where m.created_at < now() - interval '2 days';
  if (select count(*) from taquito.duel_matches m where m.created_by = p_player and m.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'taquito: too many duels' using errcode = '54000';
  end if;
  insert into taquito.duel_matches (player_a, player_b, match_id, seed, created_by)
  values (a, b, p_match, ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint, p_player)
  on conflict do nothing;
  select m.seed into s from taquito.duel_matches m where m.player_a = a and m.player_b = b and m.match_id = p_match;
  return s;
end $$;

-- E. "Abandoned = ranked 0" (Aldo, 14 Oct 2026): one open ticket still let a player ask for a career ticket,
--    look at the seed and ask for another until a good one came. A career ticket left unused is now a career
--    run of 0 (flags {"abandoned": true}) once a new ticket voids it (if it's older than 10 s, so a crash or
--    relaunch right after opening isn't punished) or once it expires. The 0 run counts toward the 20 ranked
--    career runs a day; it never lowers a weekly best (weekly isn't touched), never pays for upgrades (0) and
--    is never a day of the server's day formula (taquito.known_day). Platillo and duel tickets aren't: the
--    Platillo's first ticket of the date already is its ranked attempt, and leaving a live duel is a forfeit.
create or replace function taquito.abandon_tickets(p_player uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Expired, never used (anyone's: the cleanup below is global).
  insert into taquito.runs (player_id, mode, seed, earned, log, flags)
  select x.player_id, 'career', x.seed, 0, '[]'::jsonb, '{"abandoned": true}'::jsonb
  from taquito.run_tickets x
  where x.expires_at < now() and x.mode = 'career' and x.used_at is null and x.voided_at is null;
  delete from taquito.run_tickets where expires_at < now();
  -- This player's open tickets: void them all; a career one older than 10 s is a 0.
  insert into taquito.runs (player_id, mode, seed, earned, log, flags)
  select x.player_id, 'career', x.seed, 0, '[]'::jsonb, '{"abandoned": true}'::jsonb
  from taquito.run_tickets x
  where x.player_id = p_player and x.mode = 'career' and x.used_at is null and x.voided_at is null
    and x.created_at < now() - interval '10 seconds';
  update taquito.run_tickets x set voided_at = now()
  where x.player_id = p_player and x.used_at is null and x.voided_at is null;
end $$;

-- The day the server vouches for: 1 + recorded career runs (not voided, not abandoned), or the cloud save's day
-- up to 7 (upgrade_ledger migration).
create or replace function taquito.known_day(p_player uuid) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(
    coalesce((select case when jsonb_typeof(sa.data -> 'day') = 'number'
      then least(greatest(floor((sa.data ->> 'day')::numeric), 1), 7)::int end
      from taquito.saves sa where sa.player_id = p_player), 1),
    least(1 + (select count(*) from taquito.runs r
      where r.player_id = p_player and r.mode = 'career'
        and not coalesce(r.flags ? 'void', false) and not coalesce(r.flags ? 'abandoned', false)), 10000)::int)
$$;

drop function if exists public.taquito_begin_run(uuid, text, text, int, bigint);

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
  -- One open ticket: this one voids the player's unused ones (kept until they expire, for earlier_platillos);
  -- an abandoned career ticket is a run of 0 (E).
  perform taquito.abandon_tickets(p_player);

  known := taquito.known_day(p_player);
  d := least(coalesce(p_day, known), known + 1, 10000);
  k := jsonb_build_object('upgrades', taquito.upgrade_levels(p_player), 'locUpgrades', '{}'::jsonb);

  insert into taquito.run_tickets (player_id, mode, seed, daily_date, day, kit, rival_id)
  values (p_player, p_mode, s, (now() at time zone 'America/Mexico_City')::date, d, k, case when p_mode = 'duel' then p_rival end)
  returning * into t;
  return jsonb_build_object('ticket', t.nonce, 'seed', t.seed, 'date', t.daily_date, 'day', t.day, 'kit', t.kit)
    || case when p_mode = 'daily' then jsonb_build_object('earlier', taquito.earlier_platillos(t)) else '{}' end
    || case when p_mode = 'duel' then jsonb_build_object('rival', t.rival_id) else '{}' end;
end $$;

create or replace function public.taquito_run_ticket(p_player uuid, p_secret text, p_ticket uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t taquito.run_tickets;
begin
  perform taquito.check_player(p_player, p_secret);
  select * into t from taquito.run_tickets x
  where x.nonce = p_ticket and x.player_id = p_player and x.used_at is null and x.voided_at is null and x.expires_at > now();
  if not found then return null; end if;
  return jsonb_build_object('mode', t.mode, 'seed', t.seed, 'date', t.daily_date, 'day', t.day, 'kit', t.kit)
    || case when t.mode = 'daily' then jsonb_build_object('earlier', taquito.earlier_platillos(t)) else '{}' end
    || case when t.mode = 'duel' then jsonb_build_object('rival', t.rival_id) else '{}' end;
end $$;

-- As in the daily_one_ranked migration; the ticket must also be unvoided and, for a duel, the run's rival's.
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

revoke all on function taquito.duel_seed(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function taquito.abandon_tickets(uuid) from public, anon, authenticated;
revoke all on function taquito.known_day(uuid) from public, anon, authenticated;
revoke all on function public.taquito_begin_run(uuid, text, text, int, bigint, uuid, uuid) from public;
grant execute on function public.taquito_begin_run(uuid, text, text, int, bigint, uuid, uuid) to anon, authenticated, service_role;
revoke all on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint, uuid, boolean) from public, anon, authenticated;
grant execute on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint, uuid, boolean) to service_role;
