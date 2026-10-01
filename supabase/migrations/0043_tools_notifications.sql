-- =====================================================================
-- Chalyb — tool data the hub owns (rebuild P3).
--
--   user_notifications     Avisos (SCR-26): one row per notice, own rows only
--                          (public.notifications is the owner panel's own feed)
--   exchange_connections   Inversiones: the user's exchange key, ENCRYPTED by
--                          the app (AES-256-GCM, CONSENT_ENCRYPTION_KEY), never
--                          readable by the client; keys with withdrawal
--                          permission are refused before anything is stored
--
-- Signal preferences and automation rules live with their engines (adapter
-- contracts in src/lib/tools/adapters/tools.ts); nothing here stores a
-- balance, position, goal or risk profile.
--
-- Idempotent.
-- =====================================================================

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  -- Billing notices can't be deleted before their charge date.
  keep_until timestamptz,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists user_notifications_user_idx on public.user_notifications (user_id, created_at desc);
alter table public.user_notifications enable row level security;
drop policy if exists "user_notifications_select_own" on public.user_notifications;
create policy "user_notifications_select_own" on public.user_notifications for select using (auth.uid() = user_id);
drop policy if exists "user_notifications_update_own" on public.user_notifications;
create policy "user_notifications_update_own" on public.user_notifications for update using (auth.uid() = user_id);
drop policy if exists "user_notifications_delete_own" on public.user_notifications;
create policy "user_notifications_delete_own" on public.user_notifications for delete
  using (auth.uid() = user_id and (keep_until is null or keep_until <= now()));

create table if not exists public.exchange_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  exchange text not null,
  api_key_enc text not null,
  api_secret_enc text not null,
  can_trade boolean not null default false,
  consent_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, exchange)
);
alter table public.exchange_connections enable row level security;
-- No policies: only the service role reads or writes keys.

comment on table public.exchange_connections is
  'Inversiones exchange keys, app-encrypted. Withdrawal-permission keys are refused before insert. Never sent to the client.';
