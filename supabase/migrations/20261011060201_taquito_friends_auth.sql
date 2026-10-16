-- SEC-priv-1: Require credentials for taquito_friends (profile enumeration fix).
--
-- Before this migration, taquito_friends was callable by anonymous callers,
-- allowing anyone to enumerate profiles and last_seen timestamps by guessing
-- 6-digit friend codes. Now:
--   * the caller must be an already registered player (auth_player: a lookup never
--     registers an unknown id, so it can't be used to squat a guest id, SEC-api-2);
--   * at most 20 codes per call (the Amigos screen asks for 4 per page);
--   * at most 120 lookups per player per hour (54000 above that).
--
-- This migration is idempotent: safe to apply multiple times.

create table if not exists taquito.friend_lookups (
  player_id uuid not null references taquito.players(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists taquito_friend_lookups_player on taquito.friend_lookups (player_id, created_at);
alter table taquito.friend_lookups enable row level security;
revoke all on taquito.friend_lookups from public, anon, authenticated;

-- Drop the old function signature if it exists (only p_codes)
drop function if exists public.taquito_friends(text[]);

-- New function: requires player credentials before returning friend info.
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
    select p.friend_code, p.name, p.avatar, p.city, p.last_seen,
      coalesce(w.career, 0), coalesce(w.daily, 0), coalesce(w.duel_wins, 0)
    from taquito.players p
    left join taquito.weekly w on w.player_id = p.id and w.week = taquito.this_week()
    where p.friend_code = any (p_codes) and p.friend_code <> '';
end $$;

-- Keep the function accessible only to anon/authenticated/service_role
revoke all on function public.taquito_friends(uuid, text, text[]) from public;
grant execute on function public.taquito_friends(uuid, text, text[]) to anon, authenticated, service_role;
