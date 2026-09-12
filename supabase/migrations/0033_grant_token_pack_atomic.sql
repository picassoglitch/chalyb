-- =====================================================================
-- Chalyb — grant a token pack in one transaction.
--
-- THE BUG THIS FIXES
-- grantTokenPack() did the work in three client round-trips:
--   1. select from token_pack_purchases (dedupe)
--   2. insert the purchase row
--   3. select profiles.token_bonus_balance, add, update it back
--
-- Step 3 is a read-modify-write across two statements, so two concurrent
-- grants both read the same starting balance and the second overwrites the
-- first: one grant silently disappears. Mercado Pago makes that concurrency
-- routine — it retries a notification while the first delivery is still in
-- flight, and a user can buy two packs back to back.
--
-- A function runs inside a single transaction, so the insert and the balance
-- bump commit together or not at all, and the bump is now an in-SQL increment
-- (`+ p_tokens` against the stored value) which no concurrent statement can
-- lose. The UNIQUE on mp_payment_id remains the idempotency key for retries:
-- if two deliveries race past the dedupe select, the loser hits the
-- constraint and reports already_granted instead of double-crediting.
--
-- SECURITY DEFINER because it writes profiles.token_bonus_balance, which
-- migration 0032 made unwritable by `authenticated`. EXECUTE is granted to
-- service_role only, so the only caller is the server (the MP webhook and the
-- admin grant action) — never a browser.
--
-- Idempotent: re-runnable.
-- =====================================================================

create or replace function public.grant_token_pack(
  p_user_id       uuid,
  p_tokens        bigint,
  p_source        text,
  p_mp_payment_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance bigint;
begin
  if p_tokens is null or p_tokens <= 0 then
    raise exception 'grant_token_pack: tokens must be positive (got %)', p_tokens
      using errcode = '22023';
  end if;
  if p_source not in ('mp_payment', 'admin_grant', 'promo') then
    raise exception 'grant_token_pack: unknown source %', p_source
      using errcode = '22023';
  end if;

  -- Fast path for an MP retry we have already credited.
  if p_mp_payment_id is not null
     and exists (
       select 1 from public.token_pack_purchases
       where mp_payment_id = p_mp_payment_id
     )
  then
    return jsonb_build_object('ok', true, 'already_granted', true);
  end if;

  insert into public.token_pack_purchases (user_id, tokens_granted, source, mp_payment_id)
  values (p_user_id, p_tokens, p_source, p_mp_payment_id);

  update public.profiles
     set token_bonus_balance = token_bonus_balance + p_tokens
   where id = p_user_id
  returning token_bonus_balance into v_new_balance;

  if v_new_balance is null then
    -- No profile row: roll the purchase row back with it rather than leaving
    -- a purchase that credited nobody.
    raise exception 'grant_token_pack: no profile for user %', p_user_id
      using errcode = 'P0002';
  end if;

  return jsonb_build_object('ok', true, 'already_granted', false, 'balance', v_new_balance);

exception
  when unique_violation then
    -- Two deliveries of the same payment raced. The other one won; nothing to
    -- do, and nothing was double-credited because this transaction rolls back.
    return jsonb_build_object('ok', true, 'already_granted', true);
end;
$$;

comment on function public.grant_token_pack(uuid, bigint, text, text) is
  'Atomically records a token pack purchase and increments profiles.token_bonus_balance. Idempotent per mp_payment_id. Server-side (service_role) only.';

-- Lock the door: only the server may call this.
revoke all on function public.grant_token_pack(uuid, bigint, text, text) from public;
revoke all on function public.grant_token_pack(uuid, bigint, text, text) from anon;
revoke all on function public.grant_token_pack(uuid, bigint, text, text) from authenticated;
grant execute on function public.grant_token_pack(uuid, bigint, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Admin balance adjustment — same story, other caller.
--
-- grantTokenPackAdmin() (src/lib/usage/token-grant-actions.ts) read the
-- balance, clamped it at zero and wrote it back, so an admin grant issued
-- while a paid pack was being credited overwrote the pack. Making only one of
-- the two paths atomic fixes nothing: the stale writer still clobbers the
-- careful one. This does the read and the write in a single statement under a
-- row lock, and returns both balances so the audit log can record the real
-- before/after.
--
-- Negative deltas revoke, clamped at zero (revoking 500k from a user holding
-- 200k leaves 0, never a negative balance the CHECK would reject).
-- ---------------------------------------------------------------------
create or replace function public.adjust_token_bonus_balance(
  p_user_id uuid,
  p_delta   bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev bigint;
  v_next bigint;
begin
  -- FOR UPDATE serializes concurrent adjustments of the same profile.
  select token_bonus_balance into v_prev
    from public.profiles
   where id = p_user_id
     for update;

  if v_prev is null then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  update public.profiles
     set token_bonus_balance = greatest(0, v_prev + p_delta)
   where id = p_user_id
  returning token_bonus_balance into v_next;

  return jsonb_build_object(
    'ok', true,
    'previous_balance', v_prev,
    'balance', v_next,
    'effective_delta', v_next - v_prev
  );
end;
$$;

comment on function public.adjust_token_bonus_balance(uuid, bigint) is
  'Atomically adds (or removes, clamped at 0) bonus tokens and returns previous/new balance. Server-side (service_role) only.';

revoke all on function public.adjust_token_bonus_balance(uuid, bigint) from public;
revoke all on function public.adjust_token_bonus_balance(uuid, bigint) from anon;
revoke all on function public.adjust_token_bonus_balance(uuid, bigint) from authenticated;
grant execute on function public.adjust_token_bonus_balance(uuid, bigint) to service_role;
