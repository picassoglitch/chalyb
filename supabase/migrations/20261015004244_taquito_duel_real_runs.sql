-- De Taquito a Imperio: a duel win counts only when both players played a real run (P0, 14 Oct 2026).
--
-- Duelo wins could still be farmed with puppet accounts: the puppet sends an empty log (it replays
-- to 0) or calls taquito_duel_forfeit, and the main account's win counted on the Duelos board as
-- long as the puppet was 10 minutes old and had one career/daily run.
-- A. taquito.duel_run_real(player, seed, rival): the player's duel run of that seed is a real run:
--    - a replayed row in taquito.runs (a forfeit is not a run),
--    - earned > 0 (it sold something),
--    - plausibility flags from taquito-verify (flags.v) with at least 21 ticks with taps, i.e. the
--      20 gaps plausibility.ts needs (MIN_GAPS) before it judges a log at all,
--    - at least 5 orders served in the replay (flags.served, ShiftState.customersServed, which
--      taquito-verify sends from this PR on; runs without it never count),
--    - not hard-flagged and not voided (taquito.run_counts),
--    - recorded with a server run ticket: a used 'duel' ticket of that player and seed
--      (taquito_record_run burns it in the run's own transaction).
-- B. taquito.duel_verdict: a win counts only when BOTH runs are real, on top of the existing caps
--    (rival 10 minutes old with a career/daily run, runs 5 minutes apart, 3 a week per rival,
--    10 rivals a week). A forfeit still fills in the missing run as 0 and decides the duel for the
--    UI, but never adds a duel win. The reply is unchanged.
-- C. Backfill (Aldo, 14 Oct 2026: remove the wins farmed before the fix): taquito.uncount_farmed_duels()
--    sets counted = false on this week's counted duels where either side lacks a replayed duel run
--    and takes those wins off taquito.weekly.duel_wins. Runs from before this fix have no
--    flags.served and their tickets may be gone, so it uses a looser check than duel_run_real:
--    a replayed duel run (so a forfeit fails), earned > 0, >= 21 ticks with taps, not flagged or
--    voided. Idempotent: it only touches duels still counted, and the migration calls it once.
-- Only duel_verdict is redefined here; taquito_record_run and the run tickets are untouched.
-- Aldo's call (14 Oct 2026): "verified + minimum work". Needs the taquito-verify redeploy that adds
-- flags.served; until then no duel win counts.

create or replace function taquito.duel_run_real(p_player uuid, p_seed bigint, p_rival uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from taquito.runs r
    where r.player_id = p_player and r.seed = p_seed and r.mode = 'duel' and r.rival_id = p_rival
      and r.earned > 0
      and jsonb_typeof(r.flags) = 'object'
      and r.flags ? 'v'
      and jsonb_typeof(r.flags -> 'ticks') = 'number' and (r.flags ->> 'ticks')::numeric >= 21
      and jsonb_typeof(r.flags -> 'served') = 'number' and (r.flags ->> 'served')::numeric >= 5
      and taquito.run_counts(r.flags)
  ) and exists (
    select 1 from taquito.run_tickets t
    where t.player_id = p_player and t.mode = 'duel' and t.seed = p_seed and t.used_at is not null
  )
$$;

-- Same as the forfeit migration, plus: both runs must be real (taquito.duel_run_real).
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
      -- Both players played a real run: a forfeit, an empty log or a flagged run never adds a win.
      and taquito.duel_run_real(p_player, p_seed, p_rival)
      and taquito.duel_run_real(p_rival, p_seed, p_player)
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

-- C. This week's counted duels without a replayed run on both sides stop counting; returns how many.
create or replace function taquito.uncount_farmed_duels() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  with bad as (
    update taquito.duels d set counted = false
    where d.week = taquito.this_week() and d.counted and d.winner is not null
      and not (
        exists (select 1 from taquito.runs r
          where r.player_id = d.player_a and r.rival_id = d.player_b and r.seed = d.seed and r.mode = 'duel'
            and r.earned > 0 and jsonb_typeof(r.flags -> 'ticks') = 'number' and (r.flags ->> 'ticks')::numeric >= 21
            and taquito.run_counts(r.flags))
        and exists (select 1 from taquito.runs r
          where r.player_id = d.player_b and r.rival_id = d.player_a and r.seed = d.seed and r.mode = 'duel'
            and r.earned > 0 and jsonb_typeof(r.flags -> 'ticks') = 'number' and (r.flags ->> 'ticks')::numeric >= 21
            and taquito.run_counts(r.flags)))
    returning d.winner, d.week
  ), lost as (
    select b.winner, b.week, count(*)::int as k from bad b group by b.winner, b.week
  ), fixed as (
    update taquito.weekly w set duel_wins = greatest(w.duel_wins - l.k, 0)
    from lost l where w.player_id = l.winner and w.week = l.week
  ) -- data-modifying CTEs always run, referenced or not
  select coalesce(sum(l.k), 0)::int into n from lost l;
  return n;
end $$;

revoke all on function taquito.uncount_farmed_duels() from public, anon, authenticated;
select taquito.uncount_farmed_duels();

revoke all on function taquito.duel_run_real(uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function taquito.duel_verdict(uuid, bigint, uuid) from public, anon, authenticated;
