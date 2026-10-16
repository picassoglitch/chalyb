-- De Taquito a Imperio: orphaned players (security audit SEC-priv-2, 10 Oct 2026).
--
-- A. "Keep the account" on sign-in: the phone's old guest player (profile, save, runs, weekly)
--    was left behind with a secret nobody holds, although the dialog says it is deleted. Now it
--    is deleted, unless that player has a sign-in of its own (then it is still somebody's account).
-- B. taquito.purge_stale deletes guests (no sign-in, no device key) not seen for p_days (180 by
--    default) whose cloud save hasn't changed either; scheduling it (pg_cron) is a dashboard step.

-- Sign-in, step 2: this phone becomes the account's player and gets its own device key.
-- p_keep 'device' replaces the account's cloud save with this phone's (p_data);
-- 'account' keeps the account's, the phone downloads it and its guest player is deleted.
create or replace function public.taquito_identity_switch(
  p_provider text, p_sub text, p_player uuid, p_secret text, p_keep text, p_data jsonb, p_saved_at bigint
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  acct uuid;
  key text;
  r int;
begin
  perform taquito.check_player(p_player, p_secret);
  if p_keep not in ('device', 'account') then
    raise exception 'taquito: bad choice' using errcode = '22023';
  end if;
  select player_id into acct from taquito.identities where provider = p_provider and sub = p_sub;
  if acct is null then
    raise exception 'taquito: account not linked' using errcode = '22023';
  end if;
  if acct = p_player then
    return jsonb_build_object('player', p_player, 'secret', null);
  end if;
  key := encode(extensions.gen_random_bytes(24), 'hex');
  insert into taquito.device_keys (player_id, secret_hash) values (acct, extensions.digest(key, 'sha256'));
  if p_keep = 'device' then
    perform taquito.valid_save(p_data);
    insert into taquito.saves (player_id, data, saved_at, rev) values (acct, p_data, coalesce(p_saved_at, 0), 1)
    on conflict (player_id) do update set data = excluded.data, saved_at = excluded.saved_at, rev = taquito.saves.rev + 1, updated_at = now();
  elsif not exists (select 1 from taquito.identities where player_id = p_player) then
    delete from taquito.players where id = p_player; -- cascades to its save, runs, weekly and duels
  end if;
  select s.rev into r from taquito.saves s where s.player_id = acct;
  return jsonb_build_object('player', acct, 'secret', key, 'rev', coalesce(r, 0));
end $$;

-- Deletes guests unused for p_days; returns how many. For pg_cron or the service role.
-- last_seen only moves with scores and runs, so a recent cloud save also counts as use.
create or replace function taquito.purge_stale(p_days int default 180) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if p_days is null or p_days < 1 then
    raise exception 'taquito: bad days' using errcode = '22023';
  end if;
  delete from taquito.players p
  where p.last_seen < now() - make_interval(days => p_days)
    and not exists (select 1 from taquito.identities i where i.player_id = p.id)
    and not exists (select 1 from taquito.device_keys k where k.player_id = p.id)
    and not exists (select 1 from taquito.saves s where s.player_id = p.id and s.updated_at >= now() - make_interval(days => p_days));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.taquito_identity_switch(text, text, uuid, text, text, jsonb, bigint) from public, anon, authenticated;
revoke all on function taquito.purge_stale(int) from public, anon, authenticated;
grant execute on function public.taquito_identity_switch(text, text, uuid, text, text, jsonb, bigint) to service_role;
grant execute on function taquito.purge_stale(int) to service_role;
