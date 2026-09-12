-- =====================================================================
-- Regression test for migrations 0032–0034: the privilege guard on
-- public.profiles and the grant_token_pack RPC.
--
-- These are the rules that stop a signed-in user from handing themselves
-- SUPER_ADMIN, a VIP plan, or ten million tokens with nothing but the anon
-- key. A policy is easy to weaken by accident — a later migration that
-- re-grants UPDATE on the table, a helper quietly switched to SECURITY
-- DEFINER — and nothing about the app would look broken afterwards. So the
-- rules get a test.
--
-- HOW TO RUN
--   1. Against a scratch database (safest — it creates two users):
--        createdb chalyb_rls_test
--        psql -d chalyb_rls_test -f supabase/tests/fixtures/profiles_fixture.sql
--        psql -d chalyb_rls_test -f supabase/migrations/0032_profiles_privilege_guard.sql
--        psql -d chalyb_rls_test -f supabase/migrations/0033_grant_token_pack_rpc.sql
--        psql -d chalyb_rls_test -f supabase/migrations/0034_subscription_cancel_at_period_end.sql
--        psql -d chalyb_rls_test -v ON_ERROR_STOP=1 -f supabase/tests/privilege_guard_test.sql
--
--   2. `bash scripts/test-rls.sh` does all of the above against a throwaway
--      cluster, if you have a local postgres.
--
-- Every check RAISES on failure, so a non-zero exit from psql (with
-- ON_ERROR_STOP=1) is the whole verdict. The last line prints when all of
-- them passed.
--
-- The whole file runs inside one transaction and rolls back, so it leaves
-- the database exactly as it found it.
-- =====================================================================

\set ON_ERROR_STOP 1

begin;

-- The fixture's two users. A test run against a real database should point
-- these at throwaway accounts.
\set SUBSCRIBER '11111111-1111-1111-1111-111111111111'
\set ADMIN_USER '22222222-2222-2222-2222-222222222222'

create or replace function pg_temp.as_user(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

-- ── 1. A subscriber cannot escalate their own row ─────────────────────
do $$
declare
  v_sub uuid := '11111111-1111-1111-1111-111111111111';
  v_blocked boolean;
  v_case text;
  v_statements text[] := array[
    'update public.profiles set role = ''SUPER_ADMIN'' where id = %L',
    'update public.profiles set tier = ''VIP'' where id = %L',
    'update public.profiles set token_bonus_balance = 10000000 where id = %L',
    'update public.profiles set welcome_gift_claimed_at = now() where id = %L',
    'update public.profiles set chalybclip_trial_started_at = now() where id = %L',
    'update public.profiles set tier_period_end = now() + interval ''10 years'' where id = %L',
    'update public.profiles set tier_cancel_at = now() + interval ''10 years'' where id = %L',
    'update public.profiles set org_id = gen_random_uuid() where id = %L'
  ];
begin
  foreach v_case in array v_statements loop
    v_blocked := false;
    begin
      perform pg_temp.as_user(v_sub);
      execute format(v_case, v_sub);
    exception when insufficient_privilege then
      -- Either layer may answer: the column grant (42501 "permission denied
      -- for table") or the trigger (42501, with our own message). Both are
      -- a refusal, which is what this asserts.
      v_blocked := true;
    end;
    reset role;
    if not v_blocked then
      raise exception 'FAIL: a subscriber was allowed to run: %', format(v_case, v_sub);
    end if;
  end loop;
  raise notice 'PASS  subscriber cannot write any privileged column (% cases)',
    array_length(v_statements, 1);
end $$;

-- ── 2. A subscriber cannot rewrite their row id ───────────────────────
do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform pg_temp.as_user('11111111-1111-1111-1111-111111111111');
    update public.profiles
       set id = '22222222-2222-2222-2222-222222222222'
     where id = '11111111-1111-1111-1111-111111111111';
  exception when insufficient_privilege or unique_violation or foreign_key_violation then
    v_blocked := true;
  end;
  reset role;
  if not v_blocked then
    raise exception 'FAIL: a subscriber rewrote their own row id';
  end if;
  raise notice 'PASS  profiles.id is immutable from the client';
end $$;

-- ── 3. The columns a user IS meant to own still work ──────────────────
do $$
declare
  v_name text;
begin
  perform pg_temp.as_user('11111111-1111-1111-1111-111111111111');
  update public.profiles
     set full_name = 'Nombre Propio', preferred_locale = 'es'
   where id = '11111111-1111-1111-1111-111111111111';
  update public.profiles
     set selected_engine_id = gen_random_uuid()
   where id = '11111111-1111-1111-1111-111111111111';
  select full_name into v_name
    from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  reset role;
  if v_name is distinct from 'Nombre Propio' then
    raise exception 'FAIL: a subscriber could not save their own name (got %)', v_name;
  end if;
  raise notice 'PASS  name, locale and selected engine remain self-writable';
end $$;

-- ── 4. RLS still scopes writes to the caller's own row ────────────────
do $$
declare
  v_rows int;
begin
  perform pg_temp.as_user('11111111-1111-1111-1111-111111111111');
  update public.profiles set full_name = 'pwned'
   where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics v_rows = row_count;
  reset role;
  if v_rows <> 0 then
    raise exception 'FAIL: a subscriber wrote to another user''s row (% rows)', v_rows;
  end if;
  raise notice 'PASS  a subscriber cannot touch another row';
end $$;

-- ── 5. The service role (server actions, MP webhook) still can ────────
do $$
declare
  v_tier text;
begin
  set local role service_role;
  update public.profiles
     set tier = 'VIP', tier_period_end = now() + interval '1 month', tier_cancel_at = null
   where id = '11111111-1111-1111-1111-111111111111';
  select tier::text into v_tier
    from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  reset role;
  if v_tier <> 'VIP' then
    raise exception 'FAIL: the service role could not grant a paid tier (got %)', v_tier;
  end if;
  raise notice 'PASS  the service role still writes privileged columns';
end $$;

-- ── 6. grant_token_pack is not callable by an ordinary user ───────────
do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform pg_temp.as_user('11111111-1111-1111-1111-111111111111');
    perform public.grant_token_pack(
      '11111111-1111-1111-1111-111111111111'::uuid, 5000000, 'promo', null);
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  reset role;
  if not v_blocked then
    raise exception 'FAIL: a subscriber called grant_token_pack directly';
  end if;
  raise notice 'PASS  grant_token_pack is service-role only';
end $$;

-- ── 7. grant_token_pack credits exactly once per payment id ───────────
do $$
declare
  v_first jsonb;
  v_again jsonb;
  v_balance bigint;
  v_rows int;
begin
  set local role service_role;
  v_first := public.grant_token_pack(
    '11111111-1111-1111-1111-111111111111'::uuid, 500000, 'mp_payment', 'test-mp-1');
  v_again := public.grant_token_pack(
    '11111111-1111-1111-1111-111111111111'::uuid, 500000, 'mp_payment', 'test-mp-1');
  select token_bonus_balance into v_balance
    from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  select count(*) into v_rows
    from public.token_pack_purchases where mp_payment_id = 'test-mp-1';
  reset role;

  if (v_first->>'already_granted')::boolean then
    raise exception 'FAIL: the first grant reported itself as a duplicate';
  end if;
  if not (v_again->>'already_granted')::boolean then
    raise exception 'FAIL: a duplicate webhook delivery granted the pack twice';
  end if;
  if v_balance <> 500000 then
    raise exception 'FAIL: balance is % after one grant of 500000', v_balance;
  end if;
  if v_rows <> 1 then
    raise exception 'FAIL: % purchase rows for one payment id', v_rows;
  end if;
  raise notice 'PASS  grant_token_pack is idempotent on mp_payment_id';
end $$;

-- ── 8. A failed grant leaves no purchase row behind ───────────────────
do $$
declare
  v_failed boolean := false;
  v_rows int;
begin
  begin
    set local role service_role;
    perform public.grant_token_pack(
      '33333333-3333-3333-3333-333333333333'::uuid, 1000, 'mp_payment', 'test-mp-orphan');
  exception when others then
    v_failed := true;
  end;
  reset role;
  if not v_failed then
    raise exception 'FAIL: granting to a non-existent user succeeded';
  end if;
  select count(*) into v_rows
    from public.token_pack_purchases where mp_payment_id = 'test-mp-orphan';
  if v_rows <> 0 then
    raise exception 'FAIL: a failed grant left % purchase row(s) behind — not atomic', v_rows;
  end if;
  raise notice 'PASS  a failed grant rolls the purchase row back';
end $$;

-- ── 9. The guard rejects nonsense arguments ───────────────────────────
do $$
declare
  v_rejected int := 0;
begin
  begin
    set local role service_role;
    perform public.grant_token_pack(
      '11111111-1111-1111-1111-111111111111'::uuid, 0, 'mp_payment', null);
  exception when others then v_rejected := v_rejected + 1;
  end;
  begin
    set local role service_role;
    perform public.grant_token_pack(
      '11111111-1111-1111-1111-111111111111'::uuid, 10, 'not_a_source', null);
  exception when others then v_rejected := v_rejected + 1;
  end;
  reset role;
  if v_rejected <> 2 then
    raise exception 'FAIL: only % of 2 bad-argument calls were rejected', v_rejected;
  end if;
  raise notice 'PASS  grant_token_pack rejects a zero grant and an unknown source';
end $$;

-- ── 10. No privileged column is self-writable by grant either ─────────
-- The trigger is one layer; the column grants are the other. This asserts
-- the grant layer directly, so re-running 0032 after a later migration
-- adds a column cannot silently re-open it.
do $$
declare
  v_leaked text;
begin
  select string_agg(column_name, ', ' order by column_name) into v_leaked
    from information_schema.column_privileges
   where grantee = 'authenticated'
     and table_schema = 'public'
     and table_name = 'profiles'
     and privilege_type = 'UPDATE'
     and column_name in (
       'id', 'role', 'tier', 'org_id', 'token_bonus_balance',
       'welcome_gift_claimed_at', 'chalybclip_trial_started_at',
       'tier_period_end', 'tier_cancel_at'
     );
  if v_leaked is not null then
    raise exception 'FAIL: authenticated holds UPDATE on privileged column(s): %', v_leaked;
  end if;
  raise notice 'PASS  no privileged column is granted to authenticated';
end $$;

rollback;

\echo ''
\echo 'ALL PRIVILEGE-GUARD CHECKS PASSED'
