-- Does migration 0032 actually stop a user from promoting themselves?
--
-- Run this in the Supabase SQL editor (or psql against the project). It
-- impersonates an ordinary API caller — the same role and JWT claims PostgREST
-- sets up for a request made with the public anon key and a user's session —
-- and asserts that the privileged columns are refused and the display columns
-- are not.
--
-- Everything runs inside a transaction that rolls back, so it changes nothing.
--
-- USAGE: replace the uuid below with a real profiles.id, then run the whole
-- file. Success looks like four NOTICE lines, all starting with OK.

begin;

-- ↓↓↓ put a real profile id here ↓↓↓
create temporary table _t (user_id uuid) on commit drop;
insert into _t values ('00000000-0000-0000-0000-000000000000');

do $$
declare
  v_user uuid;
begin
  select user_id into v_user from _t;

  -- Become the API's authenticated role, with that user's claims.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  -- 1. tier — the paid-plan column.
  begin
    update public.profiles set tier = 'VIP' where id = v_user;
    raise exception 'FAIL: a user was able to set their own tier';
  exception
    when insufficient_privilege then raise notice 'OK: tier rejected';
  end;

  -- 2. role — the admin column.
  begin
    update public.profiles set role = 'SUPER_ADMIN' where id = v_user;
    raise exception 'FAIL: a user was able to set their own role';
  exception
    when insufficient_privilege then raise notice 'OK: role rejected';
  end;

  -- 3. token_bonus_balance — the money-adjacent column.
  begin
    update public.profiles set token_bonus_balance = 999999999 where id = v_user;
    raise exception 'FAIL: a user was able to set their own token balance';
  exception
    when insufficient_privilege then raise notice 'OK: token_bonus_balance rejected';
  end;

  -- 4. full_name — a display column, which must still work: /app/settings
  --    saves it through the user-scoped client.
  update public.profiles set full_name = 'RLS check' where id = v_user;
  raise notice 'OK: full_name accepted';
end $$;

rollback;
