-- De Taquito a Imperio: real-money purchases ledger (store-plan.md §3, Aldo OK 12 Oct 2026).
--
-- Purchases happen in the App Store / Google Play through RevenueCat. Only the edge function
-- taquito-purchase (service role) writes here, and only after re-checking the purchase with the
-- RevenueCat REST API. The phone never says what it bought or what it's owed: the grant comes
-- from taquito.products. A store transaction is credited once (transaction_id is unique).
-- Rows are never deleted: a refund flips status to 'refunded', and deleting a player keeps the
-- rows (tax and refund records) with player_id nulled.
-- Purchases need a signed-in account (a row in taquito.identities): a guest's would be lost.

create table if not exists taquito.products (
  id text primary key check (id ~ '^[a-z0-9_]{3,40}$'),
  kind text not null check (kind in ('consumable', 'non_consumable')),
  chiles int not null default 0 check (chiles between 0 and 10000),
  no_ads boolean not null default false,
  season int check (season between 1 and 1000),
  cosmetic text check (cosmetic ~ '^[a-z0-9-]{3,60}$')
);

-- Same table as src/meta/products.ts (purchases.mjs checks they match).
insert into taquito.products (id, kind, chiles, no_ads, season, cosmetic) values
  ('chiles_30', 'consumable', 30, false, null, null),
  ('chiles_160', 'consumable', 160, false, null, null),
  ('chiles_340', 'consumable', 340, false, null, null),
  ('chiles_720', 'consumable', 720, false, null, null),
  ('kit_taquero', 'non_consumable', 300, false, null, 'outfit-filipina'),
  ('no_ads', 'non_consumable', 0, true, null, null),
  ('temporada_s1', 'non_consumable', 0, false, 1, null),
  ('temporada_s2', 'non_consumable', 0, false, 2, null),
  ('temporada_s3', 'non_consumable', 0, false, 3, null),
  ('temporada_s4', 'non_consumable', 0, false, 4, null)
on conflict (id) do update set kind = excluded.kind, chiles = excluded.chiles, no_ads = excluded.no_ads, season = excluded.season, cosmetic = excluded.cosmetic;

create table if not exists taquito.purchases (
  id bigint generated always as identity primary key,
  player_id uuid references taquito.players (id) on delete set null,
  store text not null check (store in ('app_store', 'play_store')),
  product_id text not null references taquito.products (id),
  transaction_id text not null unique check (length(transaction_id) between 1 and 200),
  environment text not null check (environment in ('production', 'sandbox')),
  status text not null default 'granted' check (status in ('granted', 'refunded')),
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists taquito_purchases_player on taquito.purchases (player_id);

alter table taquito.products enable row level security;
alter table taquito.purchases enable row level security;
revoke all on taquito.products, taquito.purchases from public, anon, authenticated;

-- Append-only: no deletes; an update may only refund a granted row, or null the player (account deletion).
create or replace function taquito.purchases_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'taquito: purchases are never deleted' using errcode = '42501';
  end if;
  if new.id <> old.id or new.store <> old.store or new.product_id <> old.product_id or new.transaction_id <> old.transaction_id
    or new.environment <> old.environment or new.purchased_at is distinct from old.purchased_at or new.created_at <> old.created_at
    or (new.player_id is distinct from old.player_id and new.player_id is not null)
    or (new.status <> old.status and not (old.status = 'granted' and new.status = 'refunded')) then
    raise exception 'taquito: purchases only change by refund' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists taquito_purchases_guard on taquito.purchases;
create trigger taquito_purchases_guard before update or delete on taquito.purchases
  for each row execute function taquito.purchases_guard();

-- What the ledger gives a player: chiles bought (refunds take them back), no-ads, premium
-- seasons and cosmetics. The phone adds these on top of whatever save it has (src/meta/grants.ts).
create or replace function taquito.entitlements(p_player uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'chiles', coalesce(sum(pr.chiles), 0)::int,
    'no_ads', coalesce(bool_or(pr.no_ads), false),
    'seasons', coalesce(jsonb_agg(distinct pr.season) filter (where pr.season is not null), '[]'::jsonb),
    'cosmetics', coalesce(jsonb_agg(distinct pr.cosmetic) filter (where pr.cosmetic is not null), '[]'::jsonb),
    'count', count(*)::int
  )
  from taquito.purchases pu join taquito.products pr on pr.id = pu.product_id
  where pu.player_id = p_player and pu.status = 'granted';
$$;

-- Credits one store transaction, already checked with RevenueCat by the edge function. Idempotent:
-- the same transaction again changes nothing. Returns the player's entitlements.
create or replace function public.taquito_purchase_record(
  p_player uuid, p_store text, p_product text, p_txn text, p_env text, p_purchased_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
  found boolean;
begin
  if p_player is null or not exists (select 1 from taquito.players where id = p_player) then
    raise exception 'taquito: unknown player' using errcode = '28000';
  end if;
  if not exists (select 1 from taquito.identities where player_id = p_player) then
    raise exception 'taquito: account required' using errcode = '42501';
  end if;
  if not exists (select 1 from taquito.products where id = p_product) then
    raise exception 'taquito: unknown product' using errcode = '22023';
  end if;
  select player_id, true into owner, found from taquito.purchases where transaction_id = p_txn;
  if found then
    if owner is distinct from p_player then
      raise exception 'taquito: transaction belongs to another player' using errcode = '42501';
    end if;
  else
    insert into taquito.purchases (player_id, store, product_id, transaction_id, environment, purchased_at)
    values (p_player, p_store, p_product, p_txn, p_env, p_purchased_at)
    on conflict (transaction_id) do nothing;
  end if;
  return taquito.entitlements(p_player);
end $$;

-- A refund (RevenueCat CANCELLATION, re-checked by the edge function): the grant stops counting.
-- Chiles already spent leave the phone's balance below zero; it can't spend until it's positive.
create or replace function public.taquito_purchase_refund(p_txn text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p uuid;
begin
  update taquito.purchases set status = 'refunded' where transaction_id = p_txn and status = 'granted' returning player_id into p;
  if p is null then
    select player_id into p from taquito.purchases where transaction_id = p_txn;
  end if;
  if p is null then
    return null;
  end if;
  return jsonb_build_object('player', p, 'entitlements', taquito.entitlements(p));
end $$;

-- The phone reads its own entitlements (restore, sign-in on a new phone).
create or replace function public.taquito_entitlements(p_player uuid, p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform taquito.auth_player(p_player, p_secret);
  return taquito.entitlements(p_player);
end $$;

-- Whether the player may buy (the edge function asks before talking to RevenueCat).
create or replace function public.taquito_purchase_can(p_player uuid, p_secret text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform taquito.auth_player(p_player, p_secret);
  return exists (select 1 from taquito.identities where player_id = p_player);
end $$;

revoke all on function taquito.entitlements(uuid) from public, anon, authenticated;
revoke all on function taquito.purchases_guard() from public, anon, authenticated;
revoke all on function public.taquito_purchase_record(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.taquito_purchase_refund(text) from public, anon, authenticated;
revoke all on function public.taquito_purchase_can(uuid, text) from public, anon, authenticated;
revoke all on function public.taquito_entitlements(uuid, text) from public;
grant execute on function public.taquito_purchase_record(uuid, text, text, text, text, timestamptz) to service_role;
grant execute on function public.taquito_purchase_refund(text) to service_role;
grant execute on function public.taquito_purchase_can(uuid, text) to service_role;
grant execute on function public.taquito_entitlements(uuid, text) to anon, authenticated, service_role;
