-- =====================================================================
-- Nexo AI — Admin profile policies.
-- 0001 created profiles with `select_own` / `update_own` RLS — that means
-- the admin Team page only sees their own row and changeUserRole() fails
-- on other users. This migration grants admins (SUPER_ADMIN + ADMIN)
-- SELECT + UPDATE on all profiles via a SECURITY DEFINER helper to avoid
-- the "policy queries its own table" recursion trap.
-- Idempotent: re-runnable.
-- =====================================================================

-- Helper: am I an admin? Runs as definer so it bypasses RLS while
-- checking — without this, the SELECT policy below would recurse infinitely.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('SUPER_ADMIN', 'ADMIN')
  );
$$;

-- Admins can SELECT all profile rows (in addition to self-select from 0001).
drop policy if exists "profiles_select_admins" on public.profiles;
create policy "profiles_select_admins"
  on public.profiles for select
  using (public.is_admin());

-- Admins can UPDATE any profile row (in addition to self-update from 0001).
drop policy if exists "profiles_update_admins" on public.profiles;
create policy "profiles_update_admins"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- Sanity check: the existing self-policies from 0001 still exist.
-- (No action needed — Postgres keeps multiple permissive policies and ORs them.)
