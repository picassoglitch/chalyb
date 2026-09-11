-- =====================================================================
-- Nexo AI — First-time welcome gift + NexoClip 7-day trial.
--
-- Two onboarding promotions, tracked per-profile:
--
--   welcome_gift_claimed_at:
--     NULL  → first-time user, hasn't accepted the welcome banner yet.
--             The /app home page shows the gift banner while this is NULL.
--     set   → user accepted (confetti played). The gift itself is the
--             existing Free 50k/month allocation — no separate token grant.
--
--   nexoclip_trial_started_at:
--     NULL  → no NexoClip trial.
--     set   → NexoClip runs LIVE (Pro-level) for the user while
--             now() < started_at + 7 days, regardless of their tier.
--             Read by the live-execution gating in src/lib/billing/tiers.ts
--             (see isNexoclipTrialActive) across the /app surfaces.
--
-- Both are admin-modifiable from /dashboard/team (grant / extend / revoke a
-- trial, reset the welcome banner) in addition to the self-serve claim.
--
-- Idempotent: re-runnable.
-- =====================================================================

alter table public.profiles
  add column if not exists welcome_gift_claimed_at timestamptz,
  add column if not exists nexoclip_trial_started_at timestamptz;

comment on column public.profiles.welcome_gift_claimed_at is
  'When the user accepted the first-time welcome banner (NULL = not yet, banner still shows).';
comment on column public.profiles.nexoclip_trial_started_at is
  'Start of the 7-day NexoClip live trial (NULL = no trial). Live while now < start + 7d.';
