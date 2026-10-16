-- De Taquito a Imperio: profile whitelist (security audit SEC-api-3, 10 Oct 2026).
--
-- taquito_submit stored any 24-char name, any city and any 6-digit friend code, so a direct RPC
-- call could show slurs in Ranking/Amigos or take a friend's code and appear in their circle.
-- A. Names must be one of the game's nicknames plus three digits (src/meta/profile.ts FIRST,
--    what rerollName() and live.ts generate); anything else is refused.
-- B. City must be one of src/meta/social.ts CITIES, or '' (no city).
-- C. The friend code is always derived from the player id (FNV-1a, as src/sim/rng.ts hashString
--    and src/meta/social.ts friendCode); p_friend_code is ignored. Existing rows keep their code
--    until their next submit; a unique index waits for a backfill.

-- friendCode(id) of src/meta/social.ts: FNV-1a 32-bit over 'friend-' || id, mod 1 000 000.
-- uuid::text is lowercase ASCII, like crypto.randomUUID(), so bytes = UTF-16 code units.
create or replace function taquito.friend_code(p_id uuid) returns text
language plpgsql immutable set search_path = '' as $$
declare
  s bytea := convert_to('friend-' || p_id::text, 'UTF8');
  h bigint := 2166136261; -- 0x811c9dc5
begin
  for i in 0 .. length(s) - 1 loop
    h := ((h # get_byte(s, i)::bigint) * 16777619) & 4294967295; -- Math.imul(h, 0x01000193) >>> 0
  end loop;
  return lpad((h % 1000000)::text, 6, '0');
end $$;

create or replace function public.taquito_submit(
  p_player uuid, p_secret text, p_name text, p_avatar int, p_city text, p_friend_code text,
  p_career int, p_daily int, p_duel_wins int
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Keep in sync with FIRST in src/meta/profile.ts (copied verbatim).
  if p_name is null or p_name !~ '^(Taquero|Taquera|Pastorcito|Doña Salsa|El Comal|La Tortilla|Don Trompo|La Güera|El Chilango|Morenita) [0-9]{3}$' then
    raise exception 'taquito: bad name' using errcode = '22023';
  end if;
  -- Keep in sync with CITIES in src/meta/social.ts (copied verbatim).
  if coalesce(p_city, '') <> all (array['', 'CDMX', 'Guadalajara', 'Monterrey', 'Puebla', 'Mérida', 'Oaxaca', 'Tijuana', 'Querétaro', 'León', 'Otra']) then
    raise exception 'taquito: bad city' using errcode = '22023';
  end if;
  perform taquito.check_player(p_player, p_secret);
  update taquito.players set
    name = p_name,
    avatar = least(greatest(coalesce(p_avatar, 0), 0), 99),
    city = coalesce(p_city, ''),
    friend_code = taquito.friend_code(p_player),
    last_seen = now()
  where id = p_player;
end $$;

revoke all on function taquito.friend_code(uuid) from public, anon, authenticated;
