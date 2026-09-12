-- =====================================================================
-- Chalyb — lock the privileged columns on public.profiles.
--
-- THE HOLE THIS CLOSES
-- 0001 created `profiles_update_own` as `for update using (auth.uid() = id)`
-- with no column guard and no WITH CHECK. Row-level security only decides
-- WHICH ROW you may write, never WHICH COLUMNS — so any signed-in user could
-- run, with nothing but the public anon key:
--
--   supabase.from('profiles').update({ tier: 'VIP', role: 'SUPER_ADMIN',
--                                      token_bonus_balance: 999999999 })
--                            .eq('id', myUserId)
--
-- and grant themselves a paid plan, admin rights and unlimited tokens. Every
-- server-side gate (changeUserTier, the Mercado Pago webhook, the admin team
-- page) was bypassed by talking to PostgREST directly.
--
-- THREE LAYERS, ALL FAIL-CLOSED
--   1. Column privileges — `authenticated` may UPDATE only the three display
--      columns. This is an allowlist: a column added by a future migration is
--      NOT writable by users until someone grants it here on purpose.
--   2. RLS — the self-update policy gets the explicit WITH CHECK it never had,
--      so a user cannot rewrite `id` to point the row at someone else.
--   3. A BEFORE UPDATE trigger that rejects privileged-column changes with a
--      clear error, as the backstop for any path that re-grants column
--      privileges later (a `grant all` in a future migration, say).
--
-- WHO CAN STILL WRITE THE PRIVILEGED COLUMNS
--   - `service_role` — every server-side write in the hub already goes through
--     createAdminClient(): the MP webhook, changeUserTier, the token grants,
--     the promo/admin actions, the welcome claim. Unaffected.
--   - `postgres` / `supabase_admin` — migrations and the SQL editor.
--   - Admin profiles (SUPER_ADMIN / ADMIN) keep the reach 0003 granted them,
--     for the trigger. Note they still need service_role for the column
--     privileges in layer 1, which is what the app uses.
--
-- Idempotent: re-runnable.
-- =====================================================================

-- ── 1. Column privileges ────────────────────────────────────────────────
-- Users get their own display fields and nothing else. Not listed here, and
-- therefore not user-writable: role, tier, org_id, token_bonus_balance,
-- selected_engine_id, welcome_gift_claimed_at, chalybclip_trial_started_at,
-- id, email, created_at, updated_at.
revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

grant update (full_name, avatar_url, preferred_locale)
  on public.profiles to authenticated;

-- ── 2. RLS: the self-update policy says what it means ───────────────────
-- USING picks the rows you may update; WITH CHECK validates the row AFTER the
-- update. 0001 omitted WITH CHECK, which Postgres then copies from USING —
-- correct by accident. Spelled out so a later edit to one can't silently widen
-- the other.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── 3. Trigger backstop ─────────────────────────────────────────────────
-- SECURITY INVOKER on purpose (the default): the check reads current_user,
-- and a SECURITY DEFINER function would report the function's owner instead
-- of the role PostgREST switched into for this request.
create or replace function public.tg_profiles_guard_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Server-side write paths. PostgREST runs `set local role service_role` for
  -- requests made with the service key, and migrations/SQL editor run as the
  -- owner or a supabase admin role.
  if current_user in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
  then
    return new;
  end if;

  -- Admins (0003) keep their reach over other people's profiles.
  if public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.tier is distinct from old.tier
     or new.org_id is distinct from old.org_id
     or new.token_bonus_balance is distinct from old.token_bonus_balance
     or new.selected_engine_id is distinct from old.selected_engine_id
     or new.welcome_gift_claimed_at is distinct from old.welcome_gift_claimed_at
     or new.chalybclip_trial_started_at is distinct from old.chalybclip_trial_started_at
     or new.created_at is distinct from old.created_at
  then
    raise exception
      'profiles: role, tier, org_id, token_bonus_balance, selected_engine_id, '
      'the promo timestamps and identity columns are not user-updatable'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  return new;
end;
$$;

comment on function public.tg_profiles_guard_privileged_columns() is
  'Rejects user-initiated changes to privileged profile columns. Backstop for the column-level GRANTs in 0032.';

drop trigger if exists trg_profiles_guard_privileged on public.profiles;
create trigger trg_profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.tg_profiles_guard_privileged_columns();

-- ── Verification (run as an ordinary user, e.g. from the browser client) ──
--   update profiles set tier = 'VIP' where id = auth.uid();
--     → ERROR: permission denied for column tier (layer 1)
--   update profiles set full_name = 'New name' where id = auth.uid();
--     → UPDATE 1
