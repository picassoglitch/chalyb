-- =====================================================================
-- Chalyb — claw a token pack back when Mercado Pago reverses the payment.
--
-- WHY THIS EXISTS
-- A refund or a chargeback means the buyer has the money again. The tokens
-- the payment bought must go back too, or a pack becomes free by disputing
-- the charge. The webhook already learns about reversals (payment status
-- `refunded` / `charged_back`); this is the write it needs.
--
-- Same shape as grant_token_pack (migration 0033): one SQL function, one
-- transaction, idempotent on the Mercado Pago payment id. The clawback row is
-- what makes a retried notification a no-op — the UNIQUE on mp_payment_id
-- means the second delivery reports already_clawed_back and subtracts
-- nothing. The balance is clamped at zero: a user who spent the tokens
-- before the dispute lands ends at 0, never negative.
--
-- Idempotent: re-runnable.
-- =====================================================================

create table if not exists public.token_pack_clawbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- The reversed payment. UNIQUE = one clawback per payment, however many
  -- times Mercado Pago tells us about it.
  mp_payment_id text unique not null,
  -- What the purchase granted (token_pack_purchases.tokens_granted).
  tokens_granted bigint not null check (tokens_granted > 0),
  -- What actually came off the balance (≤ tokens_granted; clamped at 0).
  tokens_removed bigint not null check (tokens_removed >= 0),
  reason text not null check (reason in ('refunded', 'charged_back')),
  created_at timestamptz not null default now()
);

create index if not exists token_pack_clawbacks_user_idx
  on public.token_pack_clawbacks (user_id, created_at desc);

alter table public.token_pack_clawbacks enable row level security;

drop policy if exists "token_pack_clawbacks_select_self" on public.token_pack_clawbacks;
create policy "token_pack_clawbacks_select_self"
  on public.token_pack_clawbacks for select
  using (auth.uid() = user_id);

drop policy if exists "token_pack_clawbacks_select_admins" on public.token_pack_clawbacks;
create policy "token_pack_clawbacks_select_admins"
  on public.token_pack_clawbacks for select
  using (public.is_admin());

create or replace function public.clawback_token_pack(
  p_mp_payment_id text,
  p_reason        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_granted bigint;
  v_prev    bigint;
  v_next    bigint;
begin
  if p_reason not in ('refunded', 'charged_back') then
    raise exception 'clawback_token_pack: unknown reason %', p_reason
      using errcode = '22023';
  end if;

  -- Only a pack this payment actually bought can be clawed back. No
  -- purchase row = nothing was granted = nothing to remove. Fail closed.
  select user_id, tokens_granted into v_user_id, v_granted
    from public.token_pack_purchases
   where mp_payment_id = p_mp_payment_id;
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_purchase');
  end if;

  -- Fast path for a reversal we already applied.
  if exists (select 1 from public.token_pack_clawbacks where mp_payment_id = p_mp_payment_id) then
    return jsonb_build_object('ok', true, 'already_clawed_back', true);
  end if;

  -- FOR UPDATE serialises this against grants and admin adjustments.
  select token_bonus_balance into v_prev
    from public.profiles
   where id = v_user_id
     for update;
  if v_prev is null then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  update public.profiles
     set token_bonus_balance = greatest(0, v_prev - v_granted)
   where id = v_user_id
  returning token_bonus_balance into v_next;

  insert into public.token_pack_clawbacks (user_id, mp_payment_id, tokens_granted, tokens_removed, reason)
  values (v_user_id, p_mp_payment_id, v_granted, v_prev - v_next, p_reason);

  return jsonb_build_object(
    'ok', true,
    'already_clawed_back', false,
    'user_id', v_user_id,
    'tokens_granted', v_granted,
    'tokens_removed', v_prev - v_next,
    'previous_balance', v_prev,
    'balance', v_next
  );

exception
  when unique_violation then
    -- Two deliveries of the same reversal raced; the other one applied it
    -- and this transaction rolls back its balance change with it.
    return jsonb_build_object('ok', true, 'already_clawed_back', true);
end;
$$;

comment on function public.clawback_token_pack(text, text) is
  'Removes the tokens a reversed (refunded/charged back) Mercado Pago payment had granted. Idempotent per mp_payment_id, clamped at 0. Server-side (service_role) only.';

revoke all on function public.clawback_token_pack(text, text) from public;
revoke all on function public.clawback_token_pack(text, text) from anon;
revoke all on function public.clawback_token_pack(text, text) from authenticated;
grant execute on function public.clawback_token_pack(text, text) to service_role;
