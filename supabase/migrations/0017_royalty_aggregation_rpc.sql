-- =====================================================================
-- Nexo AI — Move royalty + platform-stats aggregation to Postgres.
--
-- WHY THIS EXISTS:
--   The Supabase project (t4g.nano) was returning Cloudflare 522s with
--   origin_time ~19s. Cause: src/lib/usage/platform-stats.ts pulled EVERY
--   usage_events row matching `kind=llm.tokens` (no time bound) over
--   PostgREST and aggregated in Node.
--
-- WHAT THIS MIGRATION DOES:
--   1. Two SECURITY DEFINER RPCs that aggregate server-side.
--   2. Three partial indexes scoped to the hot WHERE clauses.
--   3. Per-function statement_timeout for safety.
--
-- HOW TO APPLY:
--
--   Just paste the WHOLE file into Supabase SQL Editor and run.
--   Total runtime should be <5 seconds.
--
--   We deliberately DON'T use CREATE INDEX CONCURRENTLY because Supabase
--   SQL Editor wraps every script (even single statements) in a
--   transaction, and CONCURRENTLY can't run inside a tx. Instead we use
--   regular CREATE INDEX with `SET LOCAL lock_timeout = '5s'` so the
--   migration fails fast (within 5s) if a long write is blocking it,
--   rather than hanging on the gateway. If that happens, run the
--   "BEFORE YOU RUN" steps below and retry.
--
-- BEFORE YOU RUN (recommended on a busy nano):
--   1. Dashboard → Project Settings → General → Restart project. This
--      kills hung connections and gives a ~10s window of zero writes
--      while engines reconnect and resume pushing usage events.
--   2. As soon as the project is green again (~30s), paste this file
--      and click Run. The CREATE INDEX statements will catch the quiet
--      window before write traffic resumes.
--
-- IF YOU GET "lock timeout" or "canceling statement due to lock_timeout":
--   A writer is holding a SHARE lock on usage_events for too long. Find it:
--     SELECT pid, query, state, age(now(), query_start) AS dur
--     FROM pg_stat_activity
--     WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%'
--     ORDER BY dur DESC LIMIT 10;
--   Cancel the worst with `SELECT pg_cancel_backend(<pid>);` and re-run
--   this migration.
-- =====================================================================

BEGIN;

-- Fail fast if any operation here waits more than 5s for a lock. Better
-- to bail and retry than to time out at the Cloudflare gateway.
SET LOCAL lock_timeout = '5s';

-- And cap any single statement at 30s so a long EXPLAIN-like step can't
-- run forever (the indexes are partial and small, so this should be
-- comfortably enough on a nano even with all data scanned).
SET LOCAL statement_timeout = '30s';


-- ── 1. Partial index: usage_events (occurred_at) WHERE kind='llm.tokens'
-- Speeds up the all_time / month / week scans in compute_platform_token_stats.
-- Smaller than the existing usage_events_engine_idx (0013) because it only
-- includes rows with kind='llm.tokens'.
CREATE INDEX IF NOT EXISTS usage_events_kind_llm_partial_idx
  ON public.usage_events (occurred_at)
  WHERE kind = 'llm.tokens';


-- ── 2. Partial index: usage_events (engine_id, occurred_at) WHERE kind='llm.tokens'
-- Speeds up the per-engine aggregation in compute_engine_royalties.
CREATE INDEX IF NOT EXISTS usage_events_engine_kind_partial_idx
  ON public.usage_events (engine_id, occurred_at)
  WHERE kind = 'llm.tokens';


-- ── 3. Partial index: engines (owner_user_id) WHERE royalty rate > 0
-- The royalty engine filter was doing a seq scan + runtime filter.
-- This partial is tiny (one row per active partner-eligible engine).
CREATE INDEX IF NOT EXISTS engines_partner_royalty_partial_idx
  ON public.engines (owner_user_id)
  WHERE partner_royalty_per_million_tokens_cents > 0
    AND owner_user_id IS NOT NULL;


-- ── 4. Documented no-op: (engine_id, period_start) on engine_royalty_payouts
-- Already exists from 0015 (engine_royalty_payouts_engine_idx); IF NOT EXISTS
-- makes this a no-op for documentation purposes.
CREATE INDEX IF NOT EXISTS engine_royalty_payouts_engine_period_idx
  ON public.engine_royalty_payouts (engine_id, period_start);


-- ── 5. compute_engine_royalties RPC ────────────────────────────────────
-- One round-trip replaces: 1 engines query + 1 usage_events fetch + JS sum.
CREATE OR REPLACE FUNCTION public.compute_engine_royalties(
  p_period_start timestamptz,
  p_period_end timestamptz
)
RETURNS TABLE (
  engine_id uuid,
  partner_user_id uuid,
  tokens_attributed bigint,
  amount_cents bigint,
  rate_per_million_cents integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '8s'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS engine_id,
    e.owner_user_id AS partner_user_id,
    COALESCE(SUM(u.amount), 0)::bigint AS tokens_attributed,
    FLOOR(
      COALESCE(SUM(u.amount), 0) * e.partner_royalty_per_million_tokens_cents / 1000000.0
    )::bigint AS amount_cents,
    e.partner_royalty_per_million_tokens_cents AS rate_per_million_cents
  FROM public.engines e
  LEFT JOIN public.usage_events u
    ON u.engine_id = e.id
    AND u.kind = 'llm.tokens'
    AND u.occurred_at >= p_period_start
    AND u.occurred_at <  p_period_end
  WHERE e.partner_royalty_per_million_tokens_cents > 0
    AND e.owner_user_id IS NOT NULL
  GROUP BY e.id, e.owner_user_id, e.partner_royalty_per_million_tokens_cents;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_engine_royalties(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_engine_royalties(timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.compute_engine_royalties(timestamptz, timestamptz) IS
  'Aggregate per-engine royalty accruals server-side for a [start, end) period. Replaces JS-side aggregation in src/lib/usage/royalties.ts that was causing 522s on nano.';


-- ── 6. compute_platform_token_stats RPC ─────────────────────────────────
-- Returns 3 scalar rows (all_time, month, week) + N per_engine rows in
-- a single round-trip. The "scope" discriminator routes rows in Node.
CREATE OR REPLACE FUNCTION public.compute_platform_token_stats(
  p_period_start timestamptz,
  p_week_start timestamptz
)
RETURNS TABLE (
  scope text,
  engine_id uuid,
  engine_slug text,
  engine_name text,
  tokens bigint,
  active_users bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '8s'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'all_time'::text,
    NULL::uuid, NULL::text, NULL::text,
    COALESCE(SUM(amount), 0)::bigint,
    COUNT(DISTINCT user_id)::bigint
  FROM public.usage_events
  WHERE kind = 'llm.tokens'

  UNION ALL

  SELECT
    'month'::text,
    NULL::uuid, NULL::text, NULL::text,
    COALESCE(SUM(amount), 0)::bigint,
    COUNT(DISTINCT user_id)::bigint
  FROM public.usage_events
  WHERE kind = 'llm.tokens'
    AND occurred_at >= p_period_start

  UNION ALL

  SELECT
    'week'::text,
    NULL::uuid, NULL::text, NULL::text,
    COALESCE(SUM(amount), 0)::bigint,
    COUNT(DISTINCT user_id)::bigint
  FROM public.usage_events
  WHERE kind = 'llm.tokens'
    AND occurred_at >= p_week_start

  UNION ALL

  SELECT
    'per_engine'::text,
    u.engine_id,
    e.slug,
    e.name,
    COALESCE(SUM(u.amount), 0)::bigint,
    COUNT(DISTINCT u.user_id)::bigint
  FROM public.usage_events u
  JOIN public.engines e ON e.id = u.engine_id
  WHERE u.kind = 'llm.tokens'
    AND u.occurred_at >= p_period_start
  GROUP BY u.engine_id, e.slug, e.name;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_platform_token_stats(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_platform_token_stats(timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.compute_platform_token_stats(timestamptz, timestamptz) IS
  'All-time + month + week + per-engine token totals in a single round-trip. Replaces the unbounded usage_events fetch in src/lib/usage/platform-stats.ts.';

COMMIT;
