-- =====================================================================
-- Nexo AI — real notifications feed for the command center.
--
-- Replaces the hardcoded NOTIFS mock in /dashboard/notifications with a
-- real table. Producers insert via the service-role admin client — the
-- Mercado Pago webhook is the first one (payment approved / rejected);
-- engines and crons can join later through src/lib/notifications/notify.ts.
--
-- READS:  admins only (the page lives in the admin command center).
-- WRITES: service-role only — no INSERT/UPDATE/DELETE policies on purpose.
--         "Mark all as read" goes through a role-gated server action that
--         uses the admin client, same pattern as token grants.
--
-- Idempotent: re-runnable.
-- =====================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- Single-org today (demo org), but org-scoped from day one so
  -- multi-tenant doesn't need a backfill later.
  org_id uuid not null references public.organizations(id) on delete cascade
    default '00000000-0000-0000-0000-000000000001',
  severity text not null default 'info'
    check (severity in ('critical', 'warning', 'info')),
  title text not null,
  body text,
  -- Optional deep-link rendered by the UI (e.g. '/dashboard/billing').
  href text,
  -- Which system emitted it: 'mp.webhook', 'usage.api', 'admin', ...
  source text not null default 'system',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_org_time_idx
  on public.notifications (org_id, created_at desc);
-- The page splits unread/read; partial index keeps the unread scan cheap
-- as the table grows (read rows quickly dominate).
create index if not exists notifications_unread_idx
  on public.notifications (org_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_admins" on public.notifications;
create policy "notifications_select_admins"
  on public.notifications for select
  using (public.is_admin());
