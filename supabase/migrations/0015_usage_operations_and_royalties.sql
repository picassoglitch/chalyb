-- Per-operation usage tracking + partner royalty schema.
--
-- Two related additions:
--
-- 1. Usage events get an `operation` text + `metadata` jsonb so engines can
--    group multiple LLM calls into a single user-visible "run" (e.g.
--    NexoClip's variant-generation pipeline fires ~8 LLM calls per stream;
--    we want the user to see ONE "Generated variants for stream X — used
--    5.2k tokens" row, not 8 separate rows).
--
-- 2. Engines get a `partner_royalty_per_million_tokens_cents` rate. The
--    engine's owner_user_id (PARTNER tier) accrues that rate × tokens
--    consumed per month. Admin reviews and "Finalizes" each period via
--    engine_royalty_payouts (one row = one payment to one partner).
--
-- Both surfaces (usage detail + royalty accruals) read directly from
-- usage_events on the hot path — no triggers, no denormalization, no
-- async backfill. Simpler to audit and easier to backfill historical
-- data if we ever need to.

-- ── 1. usage_events: operation tagging + metadata bag ────────────────────

ALTER TABLE usage_events
  -- Engine-supplied label for the user-visible group, e.g. 'variants_generate',
  -- 'transcribe', 'detect', 'trade_decision'. Free text on purpose — engines
  -- name their operations however makes sense. The UI groups events with the
  -- same (user_id, engine_id, operation, date) into a single row.
  --
  -- NULL is fine + means "ungrouped" (legacy events from before this slice;
  -- engines that haven't been updated to tag their calls; one-shot calls
  -- where grouping doesn't add value). Ungrouped events render as one row
  -- per event, same as today.
  ADD COLUMN operation TEXT,
  -- Bag of context the engine wants to attach: { stream_id: '...',
  -- clip_id: '...', estimate_tokens: 5000, est_input: '...' }. Read-side
  -- pulls specific keys for display; we don't enforce a schema so engines
  -- can evolve their context without a platform migration.
  ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS usage_events_user_operation_idx
  ON usage_events (user_id, engine_id, operation, occurred_at DESC)
  WHERE operation IS NOT NULL;

-- ── 2. engines: partner royalty rate ─────────────────────────────────────

ALTER TABLE engines
  -- Cents per 1,000,000 tokens consumed in this engine, accrued to the
  -- engine's `owner_user_id`. 0 (default) = no royalty (platform-owned
  -- engines or partner-owned engines without a revenue-share agreement
  -- yet). Set this when assigning a partner from /dashboard/team's
  -- "owner engine" select.
  --
  -- Example: 5000 → $50 MXN per 1M tokens. NexoClip burns 2.4M tokens
  -- in a month from across all users → partner accrues 2.4 × $50 = $120.
  --
  -- Stored as cents to avoid floating-point in the payout math.
  ADD COLUMN partner_royalty_per_million_tokens_cents INTEGER NOT NULL DEFAULT 0;

-- ── 3. engine_royalty_payouts ────────────────────────────────────────────

CREATE TABLE engine_royalty_payouts (
  id BIGSERIAL PRIMARY KEY,
  engine_id UUID NOT NULL REFERENCES engines(id) ON DELETE CASCADE,
  partner_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  -- First instant of the period this payout covers. Always the 1st of the
  -- month at 00:00 UTC. We keep it as TIMESTAMPTZ for join-friendly
  -- comparisons against usage_events.occurred_at.
  period_start TIMESTAMPTZ NOT NULL,
  -- Tokens consumed during this period that this payout settled. Captured
  -- at finalize time so the row is immutable even if usage_events get
  -- backfilled or corrected after the fact.
  tokens_attributed BIGINT NOT NULL,
  -- Payout amount = tokens_attributed × rate_per_million / 1_000_000.
  -- Captured here so the historical record survives engine rate changes.
  amount_cents INTEGER NOT NULL,
  -- Rate used at finalize time, snapshotted for audit. Lets us answer
  -- "why was Q4 different?" without rebuilding from engine row history.
  rate_per_million_cents_at_finalize INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  -- Free text for an external payment reference (bank tx id, MP payment id,
  -- "paid cash 2026-05-18", etc). The platform doesn't auto-pay — admin
  -- finalizes the accrual then records the payment offline.
  payment_reference TEXT,
  -- Admin notes — never user-visible.
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One payout per engine per period. Prevents double-finalize. Admin
  -- mistakes can be unwound by deleting the row (DELETE has no CASCADE
  -- back into usage_events — payouts are pure derived state).
  UNIQUE (engine_id, period_start)
);

CREATE INDEX engine_royalty_payouts_partner_idx
  ON engine_royalty_payouts (partner_user_id, period_start DESC);

CREATE INDEX engine_royalty_payouts_engine_idx
  ON engine_royalty_payouts (engine_id, period_start DESC);

-- RLS — admin-only read/write via service role. Partners read their own
-- rows; the SELECT policy lets them see payouts where they are the
-- partner_user_id. Admins use the service role and bypass RLS.

ALTER TABLE engine_royalty_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY engine_royalty_payouts_partner_select
  ON engine_royalty_payouts
  FOR SELECT
  USING (auth.uid() = partner_user_id);

COMMENT ON TABLE engine_royalty_payouts IS
  'Records of royalty payments to partner engine owners. One row per (engine, period_start). Admin creates via /dashboard/royalties → "Finalize period". Partners see their own rows on /app/usage.';
COMMENT ON COLUMN engines.partner_royalty_per_million_tokens_cents IS
  'Royalty rate accrued to engines.owner_user_id, in cents per 1,000,000 tokens consumed. 0 = no royalty.';
COMMENT ON COLUMN usage_events.operation IS
  'Engine-supplied group label so the UI can collapse N LLM calls into one user-visible "run" row.';
