-- =====================================================================
-- Chalyb — Atomic token-pack grant.
--
-- THE PROBLEM
-- grantTokenPack() in src/lib/usage/tokens.ts did three round trips from
-- Node: SELECT to de-dupe, INSERT the purchase row, then read-modify-write
-- profiles.token_bonus_balance. Two failure modes, both real:
--
--   1. NOT ATOMIC. The purchase row can land and the balance bump fail
--      (a network blip between the two statements). The mp_payment_id
--      UNIQUE then makes the retry a no-op and the user has PAID for
--      tokens they never receive.
--   2. LOST UPDATE. The balance bump is `read current, add, write back`.
--      Two concurrent grants (MP delivers a webhook twice, or a pack
--      purchase races an admin grant) both read the same starting value
--      and the second write silently discards the first grant.
--
-- THE FIX
-- One SECURITY DEFINER function, one transaction: de-dupe, insert, and
-- an in-place `balance = balance + n` increment that the row lock makes
-- serial. Either everything lands or nothing does.
--
-- Idempotent: re-runnable.
-- =====================================================================

create or replace function public.grant_token_pack(
  p_user_id uuid,
  p_tokens bigint,
  p_source text,
  p_mp_payment_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_new_balance bigint;
begin
  if p_tokens is null or p_tokens <= 0 then
    raise exception 'grant_token_pack: tokens must be positive, got %', p_tokens
      using errcode = '22023';
  end if;
  if p_source not in ('mp_payment', 'admin_grant', 'promo') then
    raise exception 'grant_token_pack: unknown source %', p_source
      using errcode = '22023';
  end if;

  -- De-dupe on the payment id. ON CONFLICT is the real guard (it holds
  -- even against a simultaneous duplicate delivery); the RETURNING tells
  -- us which branch we took. NULL mp_payment_id never conflicts, which is
  -- what we want for admin/promo grants.
  insert into public.token_pack_purchases (user_id, tokens_granted, source, mp_payment_id)
  values (p_user_id, p_tokens, p_source, p_mp_payment_id)
  on conflict (mp_payment_id) do nothing
  returning id into v_purchase_id;

  if v_purchase_id is null then
    return jsonb_build_object('ok', true, 'already_granted', true);
  end if;

  -- In-place increment: reads and writes under the same row lock, so
  -- concurrent grants queue instead of clobbering each other.
  update public.profiles
     set token_bonus_balance = token_bonus_balance + p_tokens
   where id = p_user_id
  returning token_bonus_balance into v_new_balance;

  if v_new_balance is null then
    -- No such profile. Raising rolls the INSERT above back, so we do not
    -- leave a purchase row recording tokens that were never credited.
    raise exception 'grant_token_pack: no profile %', p_user_id
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'ok', true,
    'already_granted', false,
    'purchase_id', v_purchase_id,
    'balance', v_new_balance
  );
end;
$$;

comment on function public.grant_token_pack(uuid, bigint, text, text) is
  'Atomically records a token-pack purchase and credits profiles.token_bonus_balance. Idempotent on mp_payment_id. Service-role only.';

-- CRITICAL. A SECURITY DEFINER function is executable by PUBLIC unless you
-- say otherwise, and PostgREST exposes every public function as an RPC —
-- so without these revokes any signed-in user could POST
-- /rest/v1/rpc/grant_token_pack and credit themselves any balance they
-- like. Only the service-role key may call it.
revoke all on function public.grant_token_pack(uuid, bigint, text, text) from public;
revoke all on function public.grant_token_pack(uuid, bigint, text, text) from anon;
revoke all on function public.grant_token_pack(uuid, bigint, text, text) from authenticated;
grant execute on function public.grant_token_pack(uuid, bigint, text, text) to service_role;
