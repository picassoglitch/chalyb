-- =====================================================================
-- Chalyb — Lock the privileged columns on public.profiles.
--
-- THE HOLE THIS CLOSES
-- 0001 created `profiles_update_own` as:
--     for update using (auth.uid() = id)
-- with NO `with check`. Two consequences, both exploitable with nothing
-- but the anon key and a signed-in session:
--   1. Anyone could PATCH their own row and set  role = 'SUPER_ADMIN',
--      tier = 'VIP', or token_bonus_balance = 10_000_000 — full privilege
--      escalation and unlimited paid quota without paying.
--   2. With no `with check`, the NEW row is unconstrained, so `id` itself
--      could be rewritten to point somewhere else.
--
-- THE MODEL
-- Self-service users own exactly the cosmetic/preference columns of their
-- own row: full_name, avatar_url, preferred_locale, email, and
-- selected_engine_id (which setSelectedLiveEngine already tier-gates in
-- the Next.js layer).
--
-- Everything that grants access or money — role, tier, org_id,
-- token_bonus_balance, welcome_gift_claimed_at, chalybclip_trial_started_at,
-- and the subscription-cancellation bookkeeping — becomes service-role only.
-- That is not a change of behaviour for the app: every server action that
-- writes one of these columns (changeUserTier, changeUserRole, the token
-- grants, the promo admin actions, the MP webhook) already goes through
-- createAdminClient(), because env-locked admins needed it anyway.
--
-- WHAT THIS DOES CHANGE: an admin holding only the anon key can no longer
-- write those columns over PostgREST, even though migration 0003's policy
-- still allows them the ROW. Column privileges are role-level, not row-level,
-- so the grant layer answers before any policy does. Nothing in the app takes
-- that path — the admin surfaces all call server actions.
--
-- TWO LAYERS, deliberately:
--   1. Column grants (section 3). PostgREST refuses the write before it
--      reaches the table. Blunt: it cannot distinguish admin from subscriber.
--   2. A BEFORE UPDATE trigger (section 2). Compares OLD to NEW, and lets a
--      stored SUPER_ADMIN/ADMIN through via public.is_admin(). A non-admin
--      cannot bootstrap into that branch: `role` is itself guarded, so
--      is_admin() can only become true through a service-role write.
--
-- Layer 2 exists because layer 1 is easy to undo by accident — one
-- `grant update on public.profiles to authenticated` in a later migration
-- and the column grants are gone, with nothing looking broken. The trigger
-- still refuses. supabase/tests/privilege_guard_test.sql asserts both.
--
-- The check has to be a trigger rather than an RLS `with check`, because
-- `with check` sees only the NEW row — it cannot say "this column did not
-- change". The trigger compares OLD to NEW, which is exactly the question.
--
-- Idempotent: re-runnable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Give the self-update policy a WITH CHECK so the row a user writes
--    back still has to be their own row.
-- ---------------------------------------------------------------------
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- 2. Column-level guard.
-- ---------------------------------------------------------------------

-- Is this statement running with enough authority to touch the guarded
-- columns? True for the service-role key, for migrations/superuser
-- sessions, and for a stored admin acting over PostgREST.
--
-- `current_user` is the reliable discriminator on Supabase: PostgREST
-- switches into the `authenticated` role for a user JWT and `anon` for no
-- JWT, into `service_role` for the service key, and migrations run as
-- `postgres`. Anything that is NOT one of the two end-user roles is
-- already trusted by definition — it holds a key that bypasses RLS
-- outright.
--
-- SECURITY INVOKER, deliberately. Inside a SECURITY DEFINER function
-- `current_user` is the function's OWNER, not the caller — so a definer
-- version of this check reads `postgres` for every caller and returns true
-- for everyone, which is the opposite of the intent. It needs no elevated
-- rights of its own: the one privileged read it makes is delegated to
-- public.is_admin(), which IS a definer (it has to be, to avoid recursing
-- through the policy it feeds).
create or replace function public.can_write_privileged_profile_columns()
returns boolean
language plpgsql
security invoker
set search_path = public
stable
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return true;
  end if;
  return public.is_admin();
end;
$$;

comment on function public.can_write_privileged_profile_columns() is
  'True when the caller may change role/tier/balance columns on profiles: service-role, migrations, or a stored SUPER_ADMIN/ADMIN.';

-- Also SECURITY INVOKER — see the note above. This function reads only OLD
-- and NEW, which a trigger always receives regardless of table privileges.
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

  -- Not privileged: every guarded column must come back unchanged. We
  -- pin each one back to its OLD value rather than raising, EXCEPT that
  -- we raise loudly instead — a silent revert would let the client
  -- believe the upgrade worked and is harder to spot in the logs.
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
  if new.id is distinct from old.id then
    raise exception 'profiles.id is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.tg_profiles_guard_privileged_columns() is
  'Rejects self-service UPDATEs that would change role, tier, org_id, token balances, promo state, or the row id.';

-- Fires LAST alphabetically-relevant order does not matter here; there is
-- only one other BEFORE UPDATE trigger (updated_at) and the two are
-- independent.
drop trigger if exists trg_profiles_guard_privileged_columns on public.profiles;
create trigger trg_profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.tg_profiles_guard_privileged_columns();

-- ---------------------------------------------------------------------
-- 3. Belt and braces: revoke column-level UPDATE from the end-user roles
--    so PostgREST rejects the write before it ever reaches the trigger.
--    RLS still governs WHICH rows; this governs WHICH columns.
--
--    NOTE FOR FUTURE MIGRATIONS: because the blanket table grant is gone,
--    a column added to profiles later is NOT self-writable until you
--    `grant update (<col>) on public.profiles to authenticated;`. That is
--    the safe default — opt a column in deliberately.
-- ---------------------------------------------------------------------
do $$
declare
  -- The authoritative list of columns a user may NOT write on their own
  -- row. Names that do not exist yet are simply absent from the loop below,
  -- so listing a column a LATER migration adds is both harmless and the
  -- point: 0032 is re-runnable, and without the later names here, re-running
  -- it after 0034 would hand `authenticated` UPDATE on 0034's columns.
  -- Add to this list whenever you add a privileged column.
  v_guarded text[] := array[
    'id',
    'role',
    'tier',
    'org_id',
    'token_bonus_balance',
    'welcome_gift_claimed_at',
    'chalybclip_trial_started_at',
    -- added by 0034
    'tier_period_end',
    'tier_cancel_at'
  ];
  v_col text;
  v_role text;
begin
  foreach v_role in array array['authenticated', 'anon'] loop
    -- Drop the blanket table grant, then hand back only the safe columns.
    execute format('revoke update on public.profiles from %I', v_role);

    for v_col in
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and not (column_name = any (v_guarded))
    loop
      execute format('grant update (%I) on public.profiles to %I', v_col, v_role);
    end loop;
  end loop;
end $$;
