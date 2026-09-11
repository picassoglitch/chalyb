-- =====================================================================
-- Nexo AI — usage_events gets `provider` + `cost_usd_micros` columns,
-- and the kind CHECK is dropped so engines can declare new kinds
-- without a coordinated deploy.
--
-- WHY (NexoClip's T4 contract change):
--   Old event shape (still accepted):
--     { kind: 'llm.tokens', amount: <tokens>,
--       source_id, occurred_at, operation, metadata }
--   New event shape:
--     { provider: 'anthropic' | 'assemblyai' | ...,
--       kind: 'llm.tokens' | 'transcription.seconds' | ...,
--       amount: <native units>,
--       cost_usd_micros: <real provider cost in USD micros>,
--       source_id, occurred_at, operation }
--
--   `provider` lets us roll up spend per Claude/OpenAI/AssemblyAI.
--   `cost_usd_micros` is the real provider cost (1e-6 USD) — $0.111 of
--   Claude usage arrives as 111000. We store it but DON'T yet deduct
--   off it; the balance math in src/lib/usage/tokens.ts still sums
--   `amount` for kind='llm.tokens'. Re-denominating tier quotas off
--   cost_usd_micros is a follow-up product decision (touches TIER_CAPS
--   units and the /app/usage UI).
--
-- WHY DROP THE KIND CHECK:
--   The old constraint was `kind in ('llm.tokens','storage.mb','publish.count')`.
--   That rejects transcription.seconds and any future kind (vision.frames,
--   embedding.tokens, ...), forcing a Nexo AI deploy every time an engine
--   adds a meter. Removing the CHECK lets engines lead. The NOT NULL stays
--   so we still reject empty/missing kinds at the DB layer; format
--   enforcement lives in the API route as a regex.
--
-- WHAT THIS DOESN'T CHANGE:
--   - kind is still NOT NULL TEXT.
--   - The (engine_id, source_id) UNIQUE keeps retries idempotent.
--   - The compute_engine_royalties / compute_platform_token_stats RPCs
--     keep filtering on kind='llm.tokens'. New kinds are inserted but
--     don't show up in those aggregates (correct — royalties + the
--     platform-stats token totals are LLM-scoped today).
--
-- Idempotent: re-runnable.
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ── 1. Drop the kind whitelist ─────────────────────────────────────────
-- Inline CHECKs get auto-named `<table>_<column>_check`. The IF EXISTS
-- guards against re-runs and against environments where the constraint
-- was already removed by hand.
ALTER TABLE public.usage_events
  DROP CONSTRAINT IF EXISTS usage_events_kind_check;

-- ── 2. provider TEXT (nullable) ────────────────────────────────────────
-- Underlying provider that incurred the cost. NULL for legacy events
-- that pre-date the T4 contract and for platform-only kinds where
-- there's no third-party provider (storage.mb, publish.count).
ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS provider TEXT;

-- ── 3. cost_usd_micros BIGINT (nullable, non-negative when present) ────
-- Real provider cost in USD micros (1e-6 USD). $0.111 → 111000.
-- BIGINT because a single Claude run can push tens of thousands of
-- micros and we sum across a month — INTEGER would only buy us ~$2.1k
-- of headroom per row's running sum, which is fine but BIGINT future-proofs
-- the column for high-volume engines.
ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS cost_usd_micros BIGINT
    CHECK (cost_usd_micros IS NULL OR cost_usd_micros >= 0);

COMMENT ON COLUMN public.usage_events.provider IS
  'Underlying provider that incurred the cost (anthropic, openai, assemblyai, ...). NULL for legacy events or platform-only kinds.';
COMMENT ON COLUMN public.usage_events.cost_usd_micros IS
  'Real provider cost in USD micros (1e-6 USD). E.g. $0.111 = 111000. NULL when the engine did not report cost.';

COMMIT;
