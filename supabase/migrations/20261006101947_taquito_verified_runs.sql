-- De Taquito a Imperio: server-checked scores (Aldo, 6 Oct 2026).
--
-- Rankings and duel wins no longer come from what the phone says. The phone sends
-- each run's seed and taps to the `taquito-verify` edge function, which replays the
-- shift with the game's own rules (src/sim) and records the real score here through
-- taquito_record_run, callable only with the service role.
--
-- Duels: both players' runs for the same seed are compared; the win counts only when
-- both runs are in (a "my rival left" claim can't be checked, so it never counts
-- online). Bot games are Práctica and never reach the server.

create table if not exists taquito.runs (
  id bigint generated always as identity primary key,
  player_id uuid not null references taquito.players (id) on delete cascade,
  mode text not null check (mode in ('career', 'daily', 'duel')),
  seed bigint not null,
  rival_id uuid,
  earned int not null,
  -- The replayed tap log, kept for audits (bounded by the edge function).
  log jsonb not null,
  created_at timestamptz not null default now()
);
create unique index if not exists taquito_runs_one_duel on taquito.runs (player_id, seed) where mode = 'duel';
create index if not exists taquito_runs_player_time on taquito.runs (player_id, created_at desc);

create table if not exists taquito.duels (
  seed bigint not null,
  player_a uuid not null references taquito.players (id) on delete cascade, -- the lower id
  player_b uuid not null references taquito.players (id) on delete cascade,
  winner uuid,
  week date not null,
  decided_at timestamptz not null default now(),
  primary key (seed, player_a, player_b)
);

alter table taquito.runs enable row level security;
alter table taquito.duels enable row level security;
revoke all on taquito.runs, taquito.duels from public, anon, authenticated;

-- Win/loss for `p_player` once both runs of a duel are in; records the duel once.
create or replace function taquito.duel_verdict(p_player uuid, p_seed bigint, p_rival uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  mine int;
  theirs int;
  a uuid := least(p_player, p_rival);
  b uuid := greatest(p_player, p_rival);
  wk date := taquito.this_week();
  w uuid;
  inserted int;
  wins_vs int;
begin
  select earned into mine from taquito.runs where player_id = p_player and seed = p_seed and mode = 'duel' and rival_id = p_rival;
  select earned into theirs from taquito.runs where player_id = p_rival and seed = p_seed and mode = 'duel' and rival_id = p_player;
  if mine is null or theirs is null then
    return jsonb_build_object('status', 'pending', 'mine', mine);
  end if;
  w := case when mine > theirs then p_player when theirs > mine then p_rival end;
  insert into taquito.duels (seed, player_a, player_b, winner, week) values (p_seed, a, b, w, wk)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 and w is not null then
    -- Two phones farming wins off each other: at most 3 wins a week against the same rival count.
    select count(*) into wins_vs from taquito.duels d
      where d.week = wk and d.winner = w and d.player_a = a and d.player_b = b;
    if wins_vs <= 3 then
      insert into taquito.weekly (player_id, week, duel_wins) values (w, wk, 1)
      on conflict (player_id, week) do update set duel_wins = taquito.weekly.duel_wins + 1;
    end if;
  end if;
  return jsonb_build_object(
    'status', 'decided', 'mine', mine, 'theirs', theirs,
    'result', case when w is null then 'tie' when w = p_player then 'win' else 'loss' end
  );
end $$;

-- Called by the edge function after it replayed the run. p_mode 'poll' only asks for a duel verdict.
create or replace function public.taquito_record_run(
  p_player uuid, p_secret text, p_mode text, p_seed bigint, p_rival uuid, p_earned int, p_log jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  wk date := taquito.this_week();
  recent int;
begin
  perform taquito.check_player(p_player, p_secret);
  if p_mode = 'poll' then
    if p_rival is null then raise exception 'taquito: rival needed' using errcode = '22023'; end if;
    return taquito.duel_verdict(p_player, p_seed, p_rival);
  end if;
  if p_mode not in ('career', 'daily', 'duel') or p_earned is null or p_earned < 0 or p_earned > 100000 then
    raise exception 'taquito: bad run' using errcode = '22023';
  end if;
  select count(*) into recent from taquito.runs where player_id = p_player and created_at > now() - interval '1 hour';
  if recent >= 60 then
    raise exception 'taquito: too many runs' using errcode = '54000';
  end if;
  update taquito.players set last_seen = now() where id = p_player;

  if p_mode = 'duel' then
    if p_rival is null or p_rival = p_player then raise exception 'taquito: rival needed' using errcode = '22023'; end if;
    insert into taquito.runs (player_id, mode, seed, rival_id, earned, log)
    values (p_player, 'duel', p_seed, p_rival, p_earned, p_log)
    on conflict (player_id, seed) where mode = 'duel' do nothing; -- one run per duel, no do-overs
    return taquito.duel_verdict(p_player, p_seed, p_rival);
  end if;

  insert into taquito.runs (player_id, mode, seed, earned, log) values (p_player, p_mode, p_seed, p_earned, p_log);
  insert into taquito.weekly (player_id, week, career, daily)
  values (p_player, wk, case when p_mode = 'career' then p_earned else 0 end, case when p_mode = 'daily' then p_earned else 0 end)
  on conflict (player_id, week) do update set
    career = greatest(taquito.weekly.career, excluded.career),
    daily = greatest(taquito.weekly.daily, excluded.daily);
  return jsonb_build_object('status', 'recorded', 'earned', p_earned);
end $$;

-- Profile only: the score arguments stay for older clients but are ignored now.
create or replace function public.taquito_submit(
  p_player uuid, p_secret text, p_name text, p_avatar int, p_city text, p_friend_code text,
  p_career int, p_daily int, p_duel_wins int
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform taquito.check_player(p_player, p_secret);
  update taquito.players set
    name = taquito.clean_name(p_name),
    avatar = least(greatest(coalesce(p_avatar, 0), 0), 99),
    city = left(coalesce(p_city, ''), 24),
    friend_code = case when p_friend_code ~ '^\d{6}$' then p_friend_code else friend_code end,
    last_seen = now()
  where id = p_player;
end $$;

-- "Borrar mi progreso" also deletes the server copy: profile, scores, runs and backup.
create or replace function public.taquito_delete(p_player uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform taquito.check_player(p_player, p_secret);
  delete from taquito.players where id = p_player;
end $$;

-- This week's numbers were self-reported by phones: start the week over with checked ones.
update taquito.weekly set career = 0, daily = 0, duel_wins = 0 where week = taquito.this_week();

revoke all on function taquito.duel_verdict(uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.taquito_record_run(uuid, text, text, bigint, uuid, int, jsonb) to service_role;
revoke all on function public.taquito_delete(uuid, text) from public;
grant execute on function public.taquito_delete(uuid, text) to anon, authenticated, service_role;
