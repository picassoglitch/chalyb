-- De Taquito a Imperio: friends see the hour you played, not the minute (SEC-priv-1, WP-19, 11 Oct 2026).
--
-- taquito_friends returned players.last_seen to the second, so anyone holding your
-- friend code could follow your sessions minute by minute. It now returns
-- date_trunc('hour', last_seen): enough for "Jugó hace…" in Amigos, nothing finer.
-- Everything else is exactly 20261011060201_taquito_friends_auth.sql: credentials,
-- at most 20 codes, at most 120 lookups per player per hour.
--
-- Same signature and return type, so create or replace is enough. Idempotent.

create or replace function public.taquito_friends(
  p_player uuid,
  p_secret text,
  p_codes text[]
)
returns table (friend_code text, name text, avatar int, city text, last_seen timestamptz, career int, daily int, duel_wins int)
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform taquito.auth_player(p_player, p_secret);
  if p_codes is null or cardinality(p_codes) > 20 then
    raise exception 'taquito: too many codes' using errcode = '22023';
  end if;
  delete from taquito.friend_lookups l where l.player_id = p_player and l.created_at < now() - interval '1 hour';
  if (select count(*) from taquito.friend_lookups l where l.player_id = p_player) >= 120 then
    raise exception 'taquito: too many lookups' using errcode = '54000';
  end if;
  insert into taquito.friend_lookups (player_id) values (p_player);
  return query
    select p.friend_code, p.name, p.avatar, p.city, date_trunc('hour', p.last_seen),
      coalesce(w.career, 0), coalesce(w.daily, 0), coalesce(w.duel_wins, 0)
    from taquito.players p
    left join taquito.weekly w on w.player_id = p.id and w.week = taquito.this_week()
    where p.friend_code = any (p_codes) and p.friend_code <> '';
end $$;

revoke all on function public.taquito_friends(uuid, text, text[]) from public;
grant execute on function public.taquito_friends(uuid, text, text[]) to anon, authenticated, service_role;
