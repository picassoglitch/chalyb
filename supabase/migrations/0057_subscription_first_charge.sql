-- 0057 · When a subscription's first charge was due (billing review of PR #41,
-- finding #9). Idempotent.
--
--   subscriptions.first_charge_at   the date its first charge was scheduled
--                                   for: today for a paid start, the change
--                                   date for a plan change, the trial end for
--                                   a trial. Written once, at creation.
--
-- A subscription that never charged had no deadline: Mercado Pago keeps the
-- preapproval 'authorized' while it retries a card that never pays, so the
-- plan ran on. unpaidCharge() now dates that first charge from this column
-- (next_charge_at can't serve: Mercado Pago moves it forward on every retry)
-- and gives it PRICING.graceDays of grace. Rows from before this column stay
-- null and keep today's behaviour (no deadline), so no paid customer whose
-- charge we merely failed to record loses access on deploy.

alter table public.subscriptions
  add column if not exists first_charge_at timestamptz;

comment on column public.subscriptions.first_charge_at is
  'When the first charge was scheduled (paid start: creation; change: effective date; trial: trial end). Dates the deadline of a subscription that never charged.';
