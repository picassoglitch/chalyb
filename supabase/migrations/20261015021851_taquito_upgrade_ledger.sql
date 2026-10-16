-- De Taquito a Imperio: the ticket's day and upgrades come from the server, not the cloud save (PR "Boletos:
-- día y mejoras del servidor", security P0, 14 Oct 2026).
--
-- taquito_begin_run took the day and the upgrade snapshot from taquito.saves, which the phone writes: saving
-- {day: 9999, upgrades: {…max}} got a ticket for a day-15, max-upgrade kitchen.
-- A. taquito.upgrade_buys: append-only ledger, one row per (player, upgrade, level) bought. Levels are the
--    best level of an upgrade anywhere (the puesto or any location), which is what taquito-verify checks
--    (src/sim/config.ts ticketUpgrades). Rows are never updated; they go only with the player (cascade).
-- B. taquito.upgrade_price(key, level): src/sim/config.ts UPGRADE_DEFS + upgradeCost, the puesto's price
--    (the cheapest place to buy that level). upgrade-ledger.mjs checks it against config.ts.
-- C. The server-known balance: the earnings of the player's recorded career runs that count (replayed by
--    taquito-verify, not flagged or voided) minus what the ledger already spent. Missions, chests, the tip
--    pile and other varos the phone adds can't be checked here, so they don't count: the server's kit can
--    lag behind the phone's, never run ahead of what was earned.
-- D. taquito_buy_upgrades(player, secret, levels): anon-callable with the player's secret. `levels` are the
--    best levels the phone has bought ({comal: 2, …}); the server records the missing levels one by one,
--    cheapest first, while the balance covers them. Idempotent per (player, key, level): a resend, a
--    double tap, a second phone or rebuying after Segundo Viento records nothing new and charges nothing.
--    Returns the ledger's levels and the balance left.
-- E. taquito_begin_run: the ticket's kit is the ledger's levels; its day is 1 + the recorded career runs
--    that weren't voided (every finished career shift moves the day by one, Results.ts), or the cloud
--    save's day up to day 7 (UNLOCK_DAY.drinks: everything unlocked) for early days played offline, plus
--    one for a run still on its way. Past day 7 only recorded runs move it.
-- F. Existing players (Aldo, 14 Oct 2026: rebuild from earnings): this migration credits what each cloud
--    save says was bought, cheapest first, as far as the player's recorded career earnings could have
--    paid for it. The rest stays on the phone only; the phone keeps sending its levels on each sync and
--    ticket (src/net/upgrades.ts), so later earnings credit the rest.

create table if not exists taquito.upgrade_buys (
  player_id uuid not null references taquito.players (id) on delete cascade,
  key text not null check (key in ('comal', 'chalan', 'musica', 'precios', 'mostrador', 'mesa')),
  level int not null check (level between 1 and 3),
  cost int not null check (cost between 0 and 100000),
  created_at timestamptz not null default now(),
  primary key (player_id, key, level)
);
alter table taquito.upgrade_buys enable row level security;
revoke all on taquito.upgrade_buys from public, anon, authenticated;

-- Append-only: no updates; a delete only with its player (on delete cascade runs after the player row is gone).
create or replace function taquito.upgrade_buys_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' or exists (select 1 from taquito.players p where p.id = old.player_id) then
    raise exception 'taquito: upgrade purchases are never changed' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists taquito_upgrade_buys_guard on taquito.upgrade_buys;
create trigger taquito_upgrade_buys_guard before update or delete on taquito.upgrade_buys
  for each row execute function taquito.upgrade_buys_guard();

-- src/sim/config.ts UPGRADE_DEFS (key, base, max).
create or replace function taquito.upgrade_defs() returns table (key text, base int, max int)
language sql immutable set search_path = '' as $$
  values ('comal', 120, 2), ('chalan', 250, 3), ('musica', 100, 3), ('precios', 200, 3), ('mostrador', 400, 1), ('mesa', 300, 1)
$$;

-- Price of buying `p_level` (1-based) of an upgrade at the puesto: upgradeCost(base, p_level - 1). Null past max.
create or replace function taquito.upgrade_price(p_key text, p_level int) returns int
language sql immutable set search_path = '' as $$
  select (round(d.base * power(2.2::numeric, p_level - 1) / 10) * 10)::int
  from taquito.upgrade_defs() d where d.key = p_key and p_level between 1 and d.max
$$;

-- The ledger's levels, every key present: {"comal": 0, …}.
create or replace function taquito.upgrade_levels(p_player uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_object_agg(d.key, coalesce((select max(b.level) from taquito.upgrade_buys b where b.player_id = p_player and b.key = d.key), 0))
  from taquito.upgrade_defs() d
$$;

-- Varos the server can vouch for: recorded career runs that count, minus what the ledger spent.
create or replace function taquito.upgrade_balance(p_player uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce((select sum(r.earned) from taquito.runs r
      where r.player_id = p_player and r.mode = 'career' and taquito.run_counts(r.flags)), 0)
    - coalesce((select sum(b.cost) from taquito.upgrade_buys b where b.player_id = p_player), 0)
$$;

-- Record the missing levels up to `want` ({key: level}, already checked), cheapest first (lowest level,
-- then lowest price: the order the Mejoras screen lists them in), while the balance covers them. A level
-- needs the one below it. Idempotent per (player, key, level). Returns the balance left.
create or replace function taquito.credit_upgrades(p_player uuid, want jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  bal bigint;
  c record;
begin
  -- One purchase at a time per player (two phones, a double tap): the balance is read under this lock.
  perform 1 from taquito.players p where p.id = p_player for update;
  bal := taquito.upgrade_balance(p_player);
  for c in
    select d.key, l.level, taquito.upgrade_price(d.key, l.level) as cost
    from taquito.upgrade_defs() d
    cross join lateral generate_series(1, least(coalesce((want ->> d.key)::int, 0), d.max)) as l(level)
    where not exists (select 1 from taquito.upgrade_buys b where b.player_id = p_player and b.key = d.key and b.level = l.level)
    order by l.level, taquito.upgrade_price(d.key, l.level), d.key
  loop
    exit when c.cost > bal;
    if c.level > 1 and not exists (select 1 from taquito.upgrade_buys b where b.player_id = p_player and b.key = c.key and b.level = c.level - 1) then
      continue;
    end if;
    insert into taquito.upgrade_buys (player_id, key, level, cost) values (p_player, c.key, c.level, c.cost)
    on conflict do nothing;
    if found then bal := bal - c.cost; end if;
  end loop;
  return bal;
end $$;

-- A save's best level of each upgrade anywhere (its `upgrades` or any location's `locUpgrades`), within
-- UPGRADE_DEFS; junk counts as 0. The same reading as src/sim/config.ts ticketUpgrades.
create or replace function taquito.save_levels(p_data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_object_agg(d.key, coalesce((
    select max(least(greatest(floor((u ->> d.key)::numeric), 0), d.max))::int
    from (
      select p_data -> 'upgrades' as u
      union all
      select x.value from jsonb_each(case when jsonb_typeof(p_data -> 'locUpgrades') = 'object' then p_data -> 'locUpgrades' else '{}' end) x
    ) sets
    where jsonb_typeof(u) = 'object' and jsonb_typeof(u -> d.key) = 'number'), 0))
  from taquito.upgrade_defs() d
$$;

create or replace function public.taquito_buy_upgrades(p_player uuid, p_secret text, p_levels jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  want jsonb := coalesce(p_levels, '{}');
  k text;
  v jsonb;
  bal bigint;
begin
  perform taquito.check_player(p_player, p_secret);
  if jsonb_typeof(want) <> 'object' or octet_length(want::text) > 512 then
    raise exception 'taquito: bad levels' using errcode = '22023';
  end if;
  for k, v in select * from jsonb_each(want) loop
    if not exists (select 1 from taquito.upgrade_defs() d where d.key = k)
      or jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric)
      or (v #>> '{}')::numeric < 0 or (v #>> '{}')::numeric > (select d.max from taquito.upgrade_defs() d where d.key = k) then
      raise exception 'taquito: bad levels' using errcode = '22023';
    end if;
  end loop;
  bal := taquito.credit_upgrades(p_player, want);
  return jsonb_build_object('levels', taquito.upgrade_levels(p_player), 'balance', bal);
end $$;

-- Existing players (Aldo, 14 Oct 2026: "rebuild from earnings"): what their cloud save says they bought,
-- as far as their recorded career earnings could have paid for it, cheapest first. The rest stays on the
-- phone only and doesn't count for ranked tickets. Only players without ledger rows (a re-run changes nothing).
do $$
declare
  r record;
begin
  for r in select sa.player_id, sa.data from taquito.saves sa
    where jsonb_typeof(sa.data) = 'object'
      and not exists (select 1 from taquito.upgrade_buys b where b.player_id = sa.player_id)
  loop
    perform taquito.credit_upgrades(r.player_id, taquito.save_levels(r.data));
  end loop;
end $$;

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

  -- The day: recorded career runs (one day each), or the cloud save's day up to 7 (early days played offline).
  select sa.data into sv from taquito.saves sa where sa.player_id = p_player;
  if jsonb_typeof(sv -> 'day') = 'number' then
    save_day := least(greatest(floor((sv ->> 'day')::numeric), 1), 7)::int;
  end if;
  select count(*) into career_runs from taquito.runs r
  where r.player_id = p_player and r.mode = 'career' and not coalesce(r.flags ? 'void', false);
  known := greatest(save_day, least(1 + career_runs, 10000));
  d := least(coalesce(p_day, known), known + 1, 10000);
  s := case p_mode
    when 'career' then ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint
    when 'duel' then p_seed
  end;
  -- The upgrades: what the ledger says was bought (taquito_buy_upgrades), never the save.
  k := jsonb_build_object('upgrades', taquito.upgrade_levels(p_player), 'locUpgrades', '{}'::jsonb);

  insert into taquito.run_tickets (player_id, mode, seed, daily_date, day, kit)
  values (p_player, p_mode, s, (now() at time zone 'America/Mexico_City')::date, d, k)
  returning * into t;
  return jsonb_build_object('ticket', t.nonce, 'seed', t.seed, 'date', t.daily_date, 'day', t.day, 'kit', t.kit)
    || case when p_mode = 'daily' then jsonb_build_object('earlier', taquito.earlier_platillos(t)) else '{}' end;
end $$;

revoke all on function taquito.upgrade_buys_guard() from public, anon, authenticated;
revoke all on function taquito.upgrade_defs() from public, anon, authenticated;
revoke all on function taquito.upgrade_price(text, int) from public, anon, authenticated;
revoke all on function taquito.upgrade_levels(uuid) from public, anon, authenticated;
revoke all on function taquito.upgrade_balance(uuid) from public, anon, authenticated;
revoke all on function taquito.credit_upgrades(uuid, jsonb) from public, anon, authenticated;
revoke all on function taquito.save_levels(jsonb) from public, anon, authenticated;
revoke all on function public.taquito_buy_upgrades(uuid, text, jsonb) from public;
grant execute on function public.taquito_buy_upgrades(uuid, text, jsonb) to anon, authenticated, service_role;
revoke all on function public.taquito_begin_run(uuid, text, text, int, bigint) from public;
grant execute on function public.taquito_begin_run(uuid, text, text, int, bigint) to anon, authenticated, service_role;
