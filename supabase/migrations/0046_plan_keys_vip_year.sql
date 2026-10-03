-- 0046 · VIP anual (all-pending WS-5, PRICING-CARDS-SPEC §12.4 #1) and the
-- key Pro Lealtad will use (WS-7, behind LEALTAD_ENABLED), so that WS-7 needs
-- no second rewrite of these CHECKs.
--
-- Idempotent: drops and re-adds both constraints with the full list.

alter table public.subscriptions drop constraint if exists subscriptions_plan_key_check;
alter table public.subscriptions
  add constraint subscriptions_plan_key_check
  check (plan_key is null or plan_key in ('pro_month', 'pro_year', 'vip_month', 'vip_year', 'pro_lealtad'));

alter table public.subscriptions drop constraint if exists subscriptions_pending_plan_key_check;
alter table public.subscriptions
  add constraint subscriptions_pending_plan_key_check
  check (
    pending_plan_key is null
    or pending_plan_key in ('pro_month', 'pro_year', 'vip_month', 'vip_year', 'pro_lealtad')
  );
