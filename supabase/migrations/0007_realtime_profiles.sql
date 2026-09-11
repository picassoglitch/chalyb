-- =====================================================================
-- Nexo AI — Realtime on profiles.
-- Enables Supabase Realtime broadcast for changes to public.profiles so
-- the client-side ProfileSubscriber can react to tier/role updates without
-- the user having to refresh the page.
--
-- Why: admin changes a subscriber's tier from /dashboard/team. Our server
-- action writes to profiles and calls revalidatePath, but that only flushes
-- the server cache — the subscriber's already-open browser tab still shows
-- the stale render until they manually reload. With this migration + a tiny
-- client subscriber hook, the row UPDATE event is pushed over a websocket
-- and the subscriber calls router.refresh() to re-fetch the RSC payload.
--
-- RLS note: realtime only delivers events the subscriber has SELECT
-- permission for. Migration 0001 already grants "select_own" on profiles,
-- so users only receive events for their own row. No security regression.
-- Idempotent: re-runnable.
-- =====================================================================

-- The `supabase_realtime` publication is created by Supabase on every project.
-- ALTER PUBLICATION is idempotent only if the table is missing — wrapping in
-- an exception handler makes the migration safe to re-run after the first apply.
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;

-- REPLICA IDENTITY FULL ensures the OLD row is included in UPDATE/DELETE
-- payloads. Without this, postgres_changes payloads only contain the changed
-- columns + primary key — fine for our refresh-on-event use case, but FULL
-- makes future filtering (e.g. "only react when tier actually changed") work.
alter table public.profiles replica identity full;
