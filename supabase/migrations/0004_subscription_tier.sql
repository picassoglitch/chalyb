-- =====================================================================
-- Nexo AI — Subscription tier.
-- Adds tier enum + column to profiles so subscription state has somewhere
-- real to live. Independent from role (permissions). Defaults to FREE for
-- every existing + new profile. Mercado Pago integration in step 05 will
-- write to this column on successful checkout.
-- Idempotent: re-runnable.
-- =====================================================================

do $$ begin
  create type subscription_tier as enum ('FREE', 'PRO', 'ALL_ACCESS');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists tier subscription_tier not null default 'FREE';

-- Make sure every existing profile has a non-null tier (the default handles
-- new rows; this one-shot fills any historical NULLs from prior schemas).
update public.profiles set tier = 'FREE' where tier is null;
