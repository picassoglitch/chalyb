-- De Taquito a Imperio: server run tickets (PR "Turnos con boleto del servidor", security P1, 12 Oct 2026).
--
-- The phone chose the seed and the kitchen of every ranked run (cleanCareerConfig only checks ranges):
-- a Día-1 account could send a max-upgrade, day-15 kitchen, or search seeds for its best score.
-- A. taquito.run_tickets: one row per ranked shift, made by taquito_begin_run when the shift starts.
--    It holds a single-use nonce, the seed (the server's own for career; the agreed seed of a live
--    duel; the Platillo's comes from the date), the CDMX date, and a snapshot of the player's day and
--    upgrades. Unused tickets expire after 2 days (queued runs keep theirs that long); a player keeps
--    at most 30 open ones (the oldest, from abandoned shifts, go first).
-- B. taquito_begin_run(player, secret, mode, day, seed): anon-callable with the player's secret.
--    The ticket's day is what the phone says, but never more than one day past what the server
--    knows: the cloud save's day or 1 + the career runs it recorded, whichever is higher. The
--    upgrade snapshot is the cloud save's `upgrades` and `locUpgrades`; taquito-verify takes the
--    best level of each (src/sim/config.ts ticketUpgrades) and checks the kitchen against it.
-- C. taquito_run_ticket(player, secret, ticket): service role. An open ticket of that player, or null.
-- D. taquito_record_run(..., p_ticket): burns the ticket in the run's own transaction, so a retry
--    after a failed record still works and a second use is refused. p_ticket is optional here so a
--    taquito-verify from before this migration keeps working until it is redeployed; the new
--    taquito-verify refuses ranked runs without one.

create table if not exists taquito.run_tickets (
  nonce uuid primary key default gen_random_uuid(),
  player_id uuid not null references taquito.players (id) on delete cascade,
  mode text not null check (mode in ('career', 'daily', 'duel')),
  seed bigint, -- null for the Platillo (its seed comes from the date)
  daily_date date not null,
  day int not null check (day between 1 and 10000),
  kit jsonb not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 days',
  used_at timestamptz
);
create index if not exists taquito_run_tickets_player on taquito.run_tickets (player_id, created_at desc);
create index if not exists taquito_run_tickets_expires on taquito.run_tickets (expires_at);
alter table taquito.run_tickets enable row level security;
revoke all on taquito.run_tickets from public, anon, authenticated;

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
  -- Abandoned shifts leave open tickets: keep the newest 29, so this one makes 30.
  delete from taquito.run_tickets where nonce in (
    select x.nonce from taquito.run_tickets x where x.player_id = p_player and x.used_at is null
    order by x.created_at desc offset 29);

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
  return jsonb_build_object('ticket', t.nonce, 'seed', t.seed, 'date', t.daily_date, 'day', t.day, 'kit', t.kit);
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
  return jsonb_build_object('mode', t.mode, 'seed', t.seed, 'date', t.daily_date, 'day', t.day, 'kit', t.kit);
end $$;

drop function if exists public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint);

-- Called by the edge function after it replayed the run. p_mode 'poll' only asks for a duel verdict.
-- p_flags: plausibility.ts's measures of the log; only admin_void_run sets "void".
-- p_tier: a Platillo run's kitchen tier (1-4); ignored for other modes.
-- p_ticket: the run's ticket from taquito_begin_run, burned here in the same transaction as the run
-- (a failed record leaves it usable for the retry; a second use is refused, 28000).
create or replace function public.taquito_record_run(
  p_player uuid, p_secret text, p_mode text, p_seed bigint, p_rival uuid, p_earned int, p_log jsonb,
  p_flags jsonb default '{}', p_tier smallint default null, p_ticket uuid default null
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
  if p_ticket is not null then
    update taquito.run_tickets t set used_at = now()
    where t.nonce = p_ticket and t.player_id = p_player and t.mode = p_mode and t.used_at is null and t.expires_at > now()
      and (p_mode = 'daily' or t.seed = p_seed);
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


revoke all on function public.taquito_begin_run(uuid, text, text, int, bigint) from public;
grant execute on function public.taquito_begin_run(uuid, text, text, int, bigint) to anon, authenticated, service_role;
revoke all on function public.taquito_run_ticket(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.taquito_run_ticket(uuid, text, uuid) to service_role;
revoke all on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint, uuid) from public, anon, authenticated;
grant execute on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb, jsonb, smallint, uuid) to service_role;
