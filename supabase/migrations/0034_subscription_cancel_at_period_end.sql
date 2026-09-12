-- =====================================================================
-- Chalyb — Cancel at period end.
--
-- THE MISMATCH THIS FIXES
-- /app/subscription said, in two places: "Conservas tu acceso … hasta que
-- termine el período que ya pagaste." The code behind the button called
-- changeUserTier(userId, 'FREE'), which dropped the user to FREE on the
-- spot. Someone who cancelled on day 2 of a month they had paid for lost
-- 28 days of the plan they bought.
--
-- THE MODEL
-- Two columns, no scheduler:
--
--   tier_period_end   When the currently-paid period runs out. The MP
--                     webhook sets it on every approved tier payment
--                     (payment date + 1 month).
--   tier_cancel_at    Set by the cancel action to tier_period_end. NULL
--                     means "no cancellation pending".
--
-- The downgrade is applied LAZILY, on read, by resolveSubscription() in
-- src/lib/billing/subscription-state.ts: once now() passes tier_cancel_at
-- the session reports FREE and the next server-side pass persists it.
-- That means no cron job to run, nothing to miss, and — importantly — no
-- background process that could downgrade a paying customer if a webhook
-- is ever delayed. Nothing expires on its own; only an explicit
-- cancellation ever sets tier_cancel_at.
--
-- Both columns are privileged: the user asks to cancel through a server
-- action, they do not write the date themselves.
--
-- Idempotent: re-runnable.
-- =====================================================================

alter table public.profiles
  add column if not exists tier_period_end timestamptz,
  add column if not exists tier_cancel_at timestamptz;

comment on column public.profiles.tier_period_end is
  'End of the paid period for the current tier. Set by the MP webhook on an approved tier payment. NULL for FREE / never-paid.';
comment on column public.profiles.tier_cancel_at is
  'When a requested cancellation takes effect (= tier_period_end at the time of the request). NULL = no pending cancellation.';

create index if not exists profiles_tier_cancel_at_idx
  on public.profiles (tier_cancel_at)
  where tier_cancel_at is not null;

-- A column added after 0032 revoked the blanket table grant inherits no
-- privileges, so these two are already not self-writable. Revoke explicitly
-- anyway: it costs nothing, it survives someone re-granting UPDATE on the
-- table, and it states the intent where the columns are defined.
revoke update (tier_period_end, tier_cancel_at) on public.profiles from authenticated;
revoke update (tier_period_end, tier_cancel_at) on public.profiles from anon;

-- ---------------------------------------------------------------------
-- Extend the 0032 guard to cover the two new columns.
--
-- They already default to not-self-writable (0032 revoked the blanket
-- UPDATE grant, so a column added afterwards has no grant at all), but
-- the trigger is the layer that produces a clear error message, and
-- leaving it silent about these two would be a trap for whoever grants
-- the column later.
-- ---------------------------------------------------------------------
-- SECURITY INVOKER, as in 0032: the guard has to see the CALLER's role, and
-- a definer function would report its own owner instead.
create or replace function public.tg_profiles_guard_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.can_write_privileged_profile_columns() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'profiles.role is not self-writable'
      using errcode = '42501';
  end if;
  if new.tier is distinct from old.tier then
    raise exception 'profiles.tier is not self-writable — pay through Mercado Pago or ask an admin'
      using errcode = '42501';
  end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'profiles.org_id is not self-writable'
      using errcode = '42501';
  end if;
  if new.token_bonus_balance is distinct from old.token_bonus_balance then
    raise exception 'profiles.token_bonus_balance is not self-writable'
      using errcode = '42501';
  end if;
  if new.welcome_gift_claimed_at is distinct from old.welcome_gift_claimed_at then
    raise exception 'profiles.welcome_gift_claimed_at is not self-writable'
      using errcode = '42501';
  end if;
  if new.chalybclip_trial_started_at is distinct from old.chalybclip_trial_started_at then
    raise exception 'profiles.chalybclip_trial_started_at is not self-writable'
      using errcode = '42501';
  end if;
  if new.tier_period_end is distinct from old.tier_period_end then
    raise exception 'profiles.tier_period_end is not self-writable'
      using errcode = '42501';
  end if;
  if new.tier_cancel_at is distinct from old.tier_cancel_at then
    raise exception 'profiles.tier_cancel_at is not self-writable — use the cancel action'
      using errcode = '42501';
  end if;
  if new.id is distinct from old.id then
    raise exception 'profiles.id is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
