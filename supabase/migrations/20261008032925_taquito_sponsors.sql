-- De Taquito a Imperio: in-world sponsors (Aldo, 7 Oct 2026).
--
-- Brands on the stand's fridge, wall posters, sign, counter bottles and napkins.
-- Until a real deal is signed these are the game's own parody brands; a signed
-- brand becomes a row here (with dates and weight) and reaches every phone at
-- launch, no release needed. The client checks every field again, and keeps its
-- built-in list (the same three brands as the seed below) if this answers with
-- nothing usable. The list REPLACES the built-in one, so keep every brand that
-- should show as an enabled row.
--
-- Read-only for players: the table isn't reachable through the API; only the
-- public.taquito_sponsors() RPC reads it. Edit rows from the SQL editor.

create table if not exists taquito.sponsors (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  name text not null check (char_length(name) between 1 and 28),
  tagline text not null default '' check (char_length(tagline) <= 48),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'), -- background
  ink text not null check (ink ~ '^#[0-9a-fA-F]{6}$'),     -- text on it
  slots text[] not null check (cardinality(slots) > 0 and slots <@ array['nevera', 'cartel', 'letrero', 'mostrador', 'servilletas']),
  drink text check (drink in ('refresco', 'jugo')),        -- the fridge shelf it stocks
  art jsonb not null default '{}'::jsonb,                  -- {slot: sprite key}, keys must ship in the app
  starts_on date,
  ends_on date,
  weight real not null default 1 check (weight > 0 and weight <= 100),
  bonus_title text check (char_length(bonus_title) <= 40), -- the opt-in "patrocinado" offer
  bonus_body text check (char_length(bonus_body) <= 60),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table taquito.sponsors enable row level security;
revoke all on taquito.sponsors from public, anon, authenticated;

insert into taquito.sponsors (id, name, tagline, color, ink, slots, drink, art, weight, bonus_title, bonus_body) values
  ('cola-loca', 'Cola Loca', '¡Refresca la locura!', '#8a5bb8', '#f3ebdd', array['nevera', 'cartel', 'letrero', 'mostrador'], 'refresco',
   '{"cartel": "T1-PRP-cartel-cola-01__base", "mostrador": "T1-PRP-refresco-01__base"}', 3, 'Cola Loca te invita', 'Propinas x2 este turno'),
  ('mangazo', 'Jugos Mangazo', 'Puro mango, puro gusto', '#f29a1f', '#3b2418', array['nevera', 'cartel', 'mostrador'], 'jugo',
   '{"cartel": "T1-PRP-cartel-jugo-01__base", "mostrador": "T1-PRP-jugo-01__base"}', 2, 'Jugos Mangazo te invita', 'Propinas x2 este turno'),
  ('nam', 'Tiendas ÑAM 24/7', 'Siempre abierto, siempre cerca', '#2bb3b1', '#3b2418', array['servilletas', 'letrero'], null,
   '{}', 1, null, null)
on conflict (id) do nothing;

-- Enabled brands not yet expired (a day of slack for time zones), as the client's Sponsor shape.
create or replace function public.taquito_sponsors() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'tagline', s.tagline,
    'color', s.color,
    'ink', s.ink,
    'slots', to_jsonb(s.slots),
    'drink', s.drink,
    'art', case when s.art = '{}'::jsonb then null else s.art end,
    'from', s.starts_on::text,
    'to', s.ends_on::text,
    'weight', s.weight,
    'bonus', case when s.bonus_title is not null and s.bonus_body is not null
                  then jsonb_build_object('title', s.bonus_title, 'body', s.bonus_body) end
  )) order by s.id), '[]'::jsonb)
  from taquito.sponsors s
  where s.enabled
    and (s.ends_on is null or s.ends_on >= (now() at time zone 'America/Mexico_City')::date - 1);
$$;

revoke all on function public.taquito_sponsors() from public;
grant execute on function public.taquito_sponsors() to anon, authenticated, service_role;
