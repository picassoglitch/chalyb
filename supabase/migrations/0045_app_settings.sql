-- =====================================================================
-- Chalyb — owner settings that save (rebuild P5-6).
--
--   app_settings   key → JSON value, written only by the owner panel
--                  (service role) and audit-logged by the app. Today the
--                  one key is `billing_toggle_enabled` (Mensual/Anual),
--                  an override over TRIAL_PLAN_CHOICE_ENABLED.
--
-- Idempotent.
-- =====================================================================

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);
alter table public.app_settings enable row level security;
-- No policies: only the service role reads or writes settings.

comment on table public.app_settings is
  'Owner-panel overrides over env flags (P5-6). Every write is audit-logged by the app.';
