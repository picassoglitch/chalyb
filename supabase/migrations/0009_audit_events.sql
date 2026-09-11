-- =====================================================================
-- Nexo AI — Audit log for billing-relevant events.
-- Every role change, tier change (manual or via MP webhook), and future
-- account-level mutation lands a row here. Used for:
--   - Customer support disputes ("when did my plan change?")
--   - Refund eligibility audits
--   - Detecting compromised admin accounts (unexpected promotions)
--
-- WHO WRITES: server actions (using admin client) + MP webhook. Anonymous
-- users can never write. Service role bypasses RLS so writes always succeed.
--
-- WHO READS: admins only (SUPER_ADMIN / ADMIN). Subscribers cannot see audit
-- events even for their own account — too easy to leak admin actor identity.
--
-- DESIGN NOTES:
--   - actor_id is NULL when the actor is the system (e.g. MP webhook flipping
--     tier after a successful payment — there's no human caller).
--   - target_email + actor_email are denormalized snapshots. If the user is
--     deleted from auth.users later, the log still tells you who they were.
--   - before/after store the relevant subset of profile fields as jsonb,
--     keyed to whichever action this is (tier change → { tier: 'PRO' }).
--   - metadata is freeform — webhook stores the MP payment id, manual changes
--     can store reason strings, etc.
-- Idempotent: re-runnable.
-- =====================================================================

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  -- Action name as a flat string. Convention: <subject>.<verb>.
  --   'tier.change'        — admin changed someone's tier via team page
  --   'tier.payment'       — MP webhook activated tier after payment
  --   'tier.downgrade'     — subscriber self-downgraded (Pro → Free etc.)
  --   'role.change'        — admin changed someone's role
  --   'selected_bot.change'— PRO subscriber swapped their live bot
  action text not null,
  actor_id uuid references auth.users on delete set null,
  actor_email text,
  target_user_id uuid not null references auth.users on delete cascade,
  target_email text,
  before jsonb,
  after jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_created_idx
  on public.audit_events (created_at desc);
create index if not exists audit_events_target_idx
  on public.audit_events (target_user_id, created_at desc);
create index if not exists audit_events_action_idx
  on public.audit_events (action, created_at desc);

alter table public.audit_events enable row level security;

-- Admins read everything. No subscriber-side read policy on purpose.
drop policy if exists "audit_events_select_admins" on public.audit_events;
create policy "audit_events_select_admins"
  on public.audit_events for select
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policy → only the service-role client (which
-- bypasses RLS) can write. This prevents any rogue authed session from
-- forging audit entries.
