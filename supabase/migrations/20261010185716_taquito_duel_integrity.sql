-- De Taquito a Imperio: duel wins against sock puppets don't count (security audit SEC-game-1, 10 Oct 2026).
--
-- A rival is any uuid the caller registers for free, and an empty tap log is a valid 0-point
-- run, so the 3-wins-per-rival cap alone let one player farm the Duelos board with throwaway ids.
-- A decided duel keeps its verdict for both phones, but the win counts on the board only when:
-- - the loser registered at least 10 minutes before the earlier of the two runs,
-- - the loser has played at least one career or daily run,
-- - both runs were recorded within 5 minutes of each other (a live duel lasts a minute),
-- - the winner has fewer than 3 counted wins against that rival this week (as before), and
-- - the rival is one of at most 10 different rivals the winner's counted wins came from this week.
-- taquito.duels.counted keeps the outcome for audits (rows from before this migration stay true).

alter table taquito.duels add column if not exists counted boolean not null default true;
create index if not exists taquito_duels_winner_week on taquito.duels (winner, week);

-- Win/loss for `p_player` once both runs of a duel are in; records the duel once.
create or replace function taquito.duel_verdict(p_player uuid, p_seed bigint, p_rival uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  mine int;
  theirs int;
  mine_at timestamptz;
  theirs_at timestamptz;
  a uuid := least(p_player, p_rival);
  b uuid := greatest(p_player, p_rival);
  wk date := taquito.this_week();
  w uuid;
  loser uuid;
  counts boolean;
  inserted int;
begin
  select r.earned, r.created_at into mine, mine_at from taquito.runs r
    where r.player_id = p_player and r.seed = p_seed and r.mode = 'duel' and r.rival_id = p_rival;
  select r.earned, r.created_at into theirs, theirs_at from taquito.runs r
    where r.player_id = p_rival and r.seed = p_seed and r.mode = 'duel' and r.rival_id = p_player;
  if mine is null or theirs is null then
    return jsonb_build_object('status', 'pending', 'mine', mine);
  end if;
  w := case when mine > theirs then p_player when theirs > mine then p_rival end;
  if not exists (select 1 from taquito.duels d where d.seed = p_seed and d.player_a = a and d.player_b = b) then
    loser := case when w = p_player then p_rival else p_player end;
    counts := w is not null
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
