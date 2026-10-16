-- De Taquito a Imperio: server-side duel forfeits (N6, 11 Oct 2026).
--
-- A Realtime "forfeit" broadcast is anyone's to send. The phone that abandons the duel
-- now also calls taquito_duel_forfeit with its secret. duel_verdict treats that row as
-- the missing run (score 0) so the rival can get a decided win without waiting forever.
-- SEC-game-1 still applies: a fresh puppet that forfeits does not count on the board.

create table if not exists taquito.forfeits (
  player_id uuid not null references taquito.players(id) on delete cascade,
  seed bigint not null,
  rival_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (player_id, seed, rival_id)
);
create index if not exists taquito_forfeits_time on taquito.forfeits (player_id, created_at);
alter table taquito.forfeits enable row level security;
revoke all on taquito.forfeits from public, anon, authenticated;

create or replace function public.taquito_duel_forfeit(p_player uuid, p_secret text, p_seed bigint, p_rival uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform taquito.auth_player(p_player, p_secret);
  if p_rival is null or p_rival = p_player or p_seed is null then
    raise exception 'taquito: rival needed' using errcode = '22023';
  end if;
  -- Client calls are hostile: at most 20 forfeits per player an hour (a real player abandons
  -- a few duels a day at most), so nobody can fill the table with made-up seeds.
  if (select count(*) from taquito.forfeits f
      where f.player_id = p_player and f.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'taquito: too many forfeits' using errcode = '54000';
  end if;
  insert into taquito.forfeits (player_id, seed, rival_id) values (p_player, p_seed, p_rival)
  on conflict do nothing;
end $$;

revoke all on function public.taquito_duel_forfeit(uuid, text, bigint, uuid) from public;
grant execute on function public.taquito_duel_forfeit(uuid, text, bigint, uuid) to anon, authenticated, service_role;

-- Same as the plausibility migration, plus: a recorded forfeit fills in the missing run as 0.
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
  if mine is null then
    select f.created_at into mine_at from taquito.forfeits f
      where f.player_id = p_player and f.seed = p_seed and f.rival_id = p_rival;
    if mine_at is not null then
      mine := 0;
      mine_flags := '{}';
    end if;
  end if;
  if theirs is null then
    select f.created_at into theirs_at from taquito.forfeits f
      where f.player_id = p_rival and f.seed = p_seed and f.rival_id = p_player;
    if theirs_at is not null then
      theirs := 0;
      theirs_flags := '{}';
    end if;
  end if;
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

revoke all on function taquito.duel_verdict(uuid, bigint, uuid) from public, anon, authenticated;
