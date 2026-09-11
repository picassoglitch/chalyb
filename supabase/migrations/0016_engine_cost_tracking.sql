-- Engine operational cost tracking.
--
-- The platform pays providers (Claude/Anthropic API, Modal, Vercel slice,
-- Railway slice, etc.) and we want the admin per-engine detail page to
-- show net margin: revenue − (variable cost + fixed infra + partner royalty).
--
-- Two new columns on engines:
--
--   cost_per_million_tokens_cents
--     What WE pay providers per 1M tokens consumed by this engine.
--     For an LLM-heavy engine (NexoClip): the blended Claude rate.
--     Reference: Claude Sonnet 4.5 averages ~$9 USD per 1M tokens
--     (mix of input + output across our prompt sizes) which is roughly
--     180 MXN/1M ≈ 18,000 cents/1M.
--
--     Default 0 so the admin sets it explicitly — we'd rather show
--     "$0 cost · 100% margin" until the operator types a real number
--     than make up a fake rate.
--
--   fixed_monthly_cost_cents
--     Costs that don't scale with token usage: Modal baseline, dedicated
--     GPU node, allocated Vercel/Railway slice, anything we'd pay even
--     if zero users ran the engine this month. Admin enters their best
--     amortization from the latest provider bill.
--
-- Both fields are admin-editable inline from /dashboard/engines (same
-- pattern as partner_royalty_per_million_tokens_cents). The per-engine
-- detail page reads them + multiplies/adds against live usage to render
-- the cost+margin section.
--
-- We DON'T auto-import provider bills here. Anthropic + Modal both have
-- billing APIs but wiring those would add real complexity for what's
-- still a "type the number from your dashboard" volume. Revisit when
-- the engine count crosses ~10 or when manual entry feels wrong.

ALTER TABLE engines
  ADD COLUMN cost_per_million_tokens_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN fixed_monthly_cost_cents INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN engines.cost_per_million_tokens_cents IS
  'What the platform pays providers (Claude, etc.) per 1M tokens consumed by this engine. Cents MXN. 0 = admin has not set rate yet (cost not tracked).';
COMMENT ON COLUMN engines.fixed_monthly_cost_cents IS
  'Monthly infra cost that does not scale with usage (Modal baseline, allocated Vercel/Railway slice, dedicated nodes). Cents MXN. 0 = admin has not set rate yet.';
