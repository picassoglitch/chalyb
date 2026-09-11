-- =====================================================================
-- Nexo AI — First-user-is-root.
-- Spec §4 said: "On first sign-in, create User; if no Organization exists yet,
-- create one and make this user SUPER_ADMIN." 0001's trigger created the row
-- but never promoted. This migration replaces that trigger so the very first
-- profile inserted becomes SUPER_ADMIN automatically — a safety net for when
-- SUPER_ADMIN_EMAILS env var is missing or the dev server forgot to reload.
-- Subsequent users default to VIEWER as before.
-- Idempotent: re-runnable.
-- =====================================================================

create or replace function public.tg_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_existing_count int;
  v_role user_role;
  v_super_admin_emails text;
  v_email_in_allowlist boolean := false;
begin
  -- Count rows BEFORE this insert; 0 = this is the first user ever.
  select count(*) into v_existing_count from public.profiles;

  -- Promotion logic:
  -- 1. First profile ever -> SUPER_ADMIN (founder bootstrap).
  -- 2. Otherwise -> VIEWER (the default).
  -- The runtime env-var allowlist in getSessionUser() still wins at request
  -- time, but this DB-side default means an admin always exists.
  if v_existing_count = 0 then
    v_role := 'SUPER_ADMIN';
  else
    v_role := 'VIEWER';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role, org_id, tier)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    v_role,
    '00000000-0000-0000-0000-000000000001'::uuid,  -- demo org from 0002 seed
    'FREE'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger already exists from 0001; this re-binds it to the new function body.
drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();
