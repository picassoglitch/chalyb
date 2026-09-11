-- =====================================================================
-- Nexo AI — Selected live bot for PRO tier.
-- PRO subscribers pick ONE bot to run in live execution. This column
-- stores that choice. FREE = always null. ALL_ACCESS = ignored (all live).
-- Nullable so existing rows don't break; cascade-set-null if the bot is
-- deleted so we don't leak orphan references.
-- =====================================================================

alter table public.profiles
  add column if not exists selected_bot_id uuid references public.bots(id) on delete set null;
