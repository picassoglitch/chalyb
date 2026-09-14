-- =====================================================================
-- Chalyb — paid access runs to the end of the period the user paid for.
--
-- WHY THIS EXISTS
-- Cancelling wrote tier = 'FREE' immediately: a user who paid for a month on
-- the 1st and cancelled on the 3rd lost 27 days they had already paid for,
-- with no refund. Under the LFPC that is charging for a service not rendered,
-- and Art. 90 treats a clause that lets us keep the money and withdraw the
-- service as abusive — PROFECO reads it the same way. Every other subscription
-- business handles it the same way for the same reason.
--
-- So cancellation now stops the renewal and schedules the end of access:
-- `tier_ends_at` is when the paid tier lapses to FREE.
--
-- HOW IT IS ENFORCED
-- Lazily, on read. getSessionUser() treats a paid tier whose tier_ends_at has
-- passed as FREE and converges the row. That is fail-closed by construction:
-- there is no scheduled job whose failure would silently leave someone on a
-- paid plan forever.
--
-- NULL means "no scheduled end" — an open-ended plan, an admin grant, or any
-- row that existed before this migration. Nobody's access changes when this
-- is applied; the column only ever gets set by a cancellation.
--
-- Idempotent: re-runnable.
-- =====================================================================

alter table public.profiles
  add column if not exists tier_ends_at timestamptz;

comment on column public.profiles.tier_ends_at is
  'When the current paid tier lapses to FREE (set on cancellation). NULL = no scheduled end. Enforced on read in getSessionUser().';

-- The 0032 guard lists the privileged columns explicitly, so the new one has
-- to join the list — the column GRANTs already exclude it (they are an
-- allowlist of three display columns), this keeps the backstop honest.
create or replace function public.tg_profiles_guard_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
  then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.tier is distinct from old.tier
     or new.tier_ends_at is distinct from old.tier_ends_at
     or new.org_id is distinct from old.org_id
     or new.token_bonus_balance is distinct from old.token_bonus_balance
     or new.selected_engine_id is distinct from old.selected_engine_id
     or new.welcome_gift_claimed_at is distinct from old.welcome_gift_claimed_at
     or new.chalybclip_trial_started_at is distinct from old.chalybclip_trial_started_at
     or new.created_at is distinct from old.created_at
  then
    raise exception
      'profiles: role, tier, tier_ends_at, org_id, token_bonus_balance, '
      'selected_engine_id, the promo timestamps and identity columns are not '
      'user-updatable'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  return new;
end;
$$;
