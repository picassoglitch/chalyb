-- =====================================================================
-- Nexo AI — Partner program + in-app messaging (slice P.0).
--
-- WHAT THIS ADDS:
--   1. PARTNER tier — a 4th subscription level. Partners get PRO-equivalent
--      access PLUS one always-on engine they own (the engine they're
--      personally building), for an effective limit of 2 active engines:
--      their owned engine + 1 selected slot (same mechanic as PRO).
--   2. engines.owner_user_id — ownership pointer so the "personal engine"
--      idea has somewhere to live. Always-on access is enforced in TS
--      (tiers.ts → engineCanRunLive), not in SQL — the column is a pure
--      reference. Partial UNIQUE WHERE NOT NULL stops a partner from
--      claiming two engines.
--   3. messages table — bidirectional thread per subscriber. Every row
--      belongs to ONE conversation (keyed by thread_user_id = the
--      subscriber). Admin replies still carry the subscriber's id in
--      thread_user_id; the actor is in sender_role. Two read_at_*
--      columns let each side track their own unread count independently.
--   4. partner_inquiries table — landing-page contact form rows whose
--      pane = 'partner' land here so the admin inbox sees every
--      partnership ping, not just the existing email blast. Same shape
--      survives anon submissions (FK is nullable, anon insert is via
--      service-role from the server action — RLS denies anon writes).
--
-- WHY ONE MIGRATION FOR FOUR THINGS:
--   These are launched together and depend on each other (TIER_CAPS.PARTNER
--   in TS code needs the enum value to exist; the team page links partner
--   tier to their owned engine; messages page surfaces partner_inquiries
--   alongside threads). One atomic migration keeps the deploy path simple.
--
-- WHY NO NEW THREAD ID:
--   With at most one thread per subscriber (their conversation with the
--   admin team), the thread IS the subscriber. Saves a join, saves a
--   table. If multi-thread support ever lands (e.g. per-engine support
--   threads), add a thread_id PK then.
--
-- Idempotent: re-runnable.
-- =====================================================================

-- ── 1. PARTNER tier value ────────────────────────────────────────────────
-- Postgres won't let us add an enum value inside a transaction in older
-- versions, but Supabase runs each migration file in its own transaction
-- on PG 15+ which supports `ADD VALUE IF NOT EXISTS` without that limit.
alter type subscription_tier add value if not exists 'PARTNER';

-- ── 2. engines.owner_user_id ─────────────────────────────────────────────
alter table public.engines
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

-- A partner can only own one engine. Partial unique index permits NULL
-- (every existing platform-owned engine) without restricting the count.
create unique index if not exists engines_one_owner_per_user
  on public.engines (owner_user_id)
  where owner_user_id is not null;

create index if not exists engines_owner_idx
  on public.engines (owner_user_id)
  where owner_user_id is not null;

-- ── 3. messages (subscriber ⇄ admin threads) ─────────────────────────────
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  thread_user_id  uuid not null references auth.users(id) on delete cascade,
  -- thread_user_id is the SUBSCRIBER side of the conversation. Admin
  -- messages keep this pointed at the subscriber so the whole thread
  -- can be loaded with a single WHERE filter.
  sender_user_id  uuid references auth.users(id) on delete set null,
  -- NULL is allowed so a deleted admin doesn't blow away history (the
  -- sender_role still tells us "an admin wrote this").
  sender_role     text not null check (sender_role in ('USER', 'ADMIN')),
  body            text not null check (length(body) between 1 and 4000),
  -- Each side tracks read state independently so unread badges are
  -- accurate from either perspective. NULL = unread.
  read_at_user    timestamptz,
  read_at_admin   timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists messages_thread_idx
  on public.messages (thread_user_id, created_at desc);

-- Unread-count index for admins (one row scanned per unread message
-- across all threads). Partial so the index stays tiny — only unread
-- USER-sent rows are admin-relevant.
create index if not exists messages_admin_unread_idx
  on public.messages (thread_user_id)
  where sender_role = 'USER' and read_at_admin is null;

alter table public.messages enable row level security;

-- Subscriber: read your own thread, send messages into your own thread.
drop policy if exists "messages_select_own_thread" on public.messages;
create policy "messages_select_own_thread"
  on public.messages for select
  using (thread_user_id = (select auth.uid()));

drop policy if exists "messages_insert_own_thread" on public.messages;
create policy "messages_insert_own_thread"
  on public.messages for insert
  with check (
    thread_user_id = (select auth.uid())
    and sender_role = 'USER'
    and sender_user_id = (select auth.uid())
  );

-- Subscriber may mark their inbound (admin-sent) messages as read.
-- WHERE clause on the policy stops them from rewriting body/role.
drop policy if exists "messages_user_mark_read" on public.messages;
create policy "messages_user_mark_read"
  on public.messages for update
  using (thread_user_id = (select auth.uid()))
  with check (thread_user_id = (select auth.uid()));

-- Admin: full access to every thread (read inbox, reply, mark read).
drop policy if exists "messages_admin_all" on public.messages;
create policy "messages_admin_all"
  on public.messages for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── 4. partner_inquiries (anon-submitted contact form leads) ─────────────
create table if not exists public.partner_inquiries (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(name) between 1 and 200),
  email             text not null check (length(email) between 3 and 320),
  message           text not null check (length(message) between 1 and 4000),
  pane              text not null check (pane in ('client', 'partner', 'earn')),
  -- Best-effort attribution from the request — not authenticated.
  ip_addr           text,
  user_agent        text,
  -- Once an admin promotes the inquiry to a real partner account, link
  -- the resulting profile here so we never lose the lead context.
  promoted_user_id  uuid references auth.users(id) on delete set null,
  read_at_admin     timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists partner_inquiries_unread_idx
  on public.partner_inquiries (created_at desc)
  where read_at_admin is null;

alter table public.partner_inquiries enable row level security;

-- Anonymous + authenticated users cannot read these. Only admins.
-- INSERT happens via service-role from src/lib/contact/contact-actions.ts
-- (which bypasses RLS), so we don't need a public insert policy.
drop policy if exists "partner_inquiries_admin_all" on public.partner_inquiries;
create policy "partner_inquiries_admin_all"
  on public.partner_inquiries for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── Realtime — let the admin inbox + partner thread auto-refresh ─────────
-- Pattern mirrors 0007_realtime_profiles.sql.
alter table public.messages replica identity full;
alter table public.partner_inquiries replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.partner_inquiries;
exception when duplicate_object then null; end $$;
