// Anthropic Admin API integration — derives the platform's blended LLM
// cost rate from the last 30 days of real Anthropic billing data, so the
// admin doesn't have to manually maintain engines.cost_per_million_tokens_cents
// against published price tiers.
//
// Auth: requires ANTHROPIC_ADMIN_KEY (Organization Admin API key — distinct
// from per-workspace API keys used for actual model calls). Set in Vercel
// env. The org-level key has read access to /v1/organizations/* endpoints.
//
// Math:
//   blended_cost_per_1M_cents
//     = (sum cost_report cents over window / sum usage_report tokens over window) × 1_000_000
//
// Currency: Anthropic reports cost in USD cents. We convert to MXN at a
// configurable rate (env ANTHROPIC_USD_TO_MXN, default 18.0). Cents stay
// integer the whole way through.
//
// Per-engine attribution: Anthropic billing is org-wide, not per-engine.
// To split, you'd run each engine through its own Anthropic workspace
// and filter the report by workspace_id. For now we apply the blended
// org rate to every engine the admin clicks "Sync" on — better than
// nothing and matches the operator's mental model ("what's my real
// Claude cost?"). When the engine count crosses ~3 and per-engine bills
// matter, plumb workspace_id through here.

import 'server-only';

interface AnthropicCostReportRow {
  /** ISO date like '2026-05-19'. */
  date: string;
  /** Cost in micro-cents USD (Anthropic's normalized unit per docs). */
  micro_cents?: number;
  /** Alternate field name some Anthropic responses use; we coerce both. */
  cost_cents?: number;
  workspace_id?: string;
}

interface AnthropicUsageReportRow {
  date: string;
  uncached_input_tokens?: number;
  cached_input_tokens?: number;
  cache_creation_input_tokens?: number;
  output_tokens?: number;
  workspace_id?: string;
}

export interface AnthropicSyncResult {
  ok: boolean;
  error?: string;
  /** Days included in the window. */
  daysCounted?: number;
  /** Org-wide tokens in the window. */
  totalTokens?: number;
  /** Org-wide cost in MXN cents over the window. */
  totalCostMxnCents?: number;
  /** Computed cents-per-million blended rate. */
  ratePerMillionCents?: number;
  /** USD-to-MXN conversion factor we used. */
  usdToMxn?: number;
  /** Anthropic raw cost in USD cents (pre-conversion) for the operator's
   *  cross-check against their Anthropic dashboard. */
  rawUsdCents?: number;
}

const ANTHROPIC_API = 'https://api.anthropic.com';
const ANTHROPIC_API_VERSION = '2023-06-01';
const DEFAULT_USD_TO_MXN = 18.0;
const DEFAULT_WINDOW_DAYS = 30;

function isoDaysAgo(days: number): string {
  const t = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

async function callAnthropic(path: string, params: Record<string, string>): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
}> {
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) {
    return { ok: false, status: 0, body: null, error: 'ANTHROPIC_ADMIN_KEY not configured' };
  }
  const qs = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await fetch(`${ANTHROPIC_API}${path}?${qs}`, {
      method: 'GET',
      headers: {
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      // Don't cache — billing data updates continuously.
      cache: 'no-store',
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: `network: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = await res.text().catch(() => '');
  }
  if (!res.ok) {
    const detail =
      typeof body === 'object' && body && 'error' in body
        ? JSON.stringify((body as { error: unknown }).error).slice(0, 200)
        : String(body).slice(0, 200);
    return {
      ok: false,
      status: res.status,
      body,
      error: `Anthropic ${res.status}: ${detail}`,
    };
  }
  return { ok: true, status: res.status, body };
}

/** Compute the blended cost rate from the last N days of Anthropic
 *  billing data. Does NOT write anywhere — caller decides whether to
 *  push the rate into engines.cost_per_million_tokens_cents. */
export async function computeAnthropicBlendedRate(
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<AnthropicSyncResult> {
  const usdToMxn = Number(process.env.ANTHROPIC_USD_TO_MXN ?? DEFAULT_USD_TO_MXN);
  if (!Number.isFinite(usdToMxn) || usdToMxn <= 0) {
    return { ok: false, error: 'ANTHROPIC_USD_TO_MXN invalid' };
  }

  const startsAt = isoDaysAgo(windowDays);
  const endsAt = isoDaysAgo(0);
  // Two parallel reports. Anthropic returns daily aggregates; we sum.
  const [costRes, usageRes] = await Promise.all([
    callAnthropic('/v1/organizations/cost_report', {
      starts_at: startsAt,
      ends_at: endsAt,
    }),
    callAnthropic('/v1/organizations/usage_report/messages', {
      starts_at: startsAt,
      ends_at: endsAt,
    }),
  ]);

  if (!costRes.ok) return { ok: false, error: costRes.error };
  if (!usageRes.ok) return { ok: false, error: usageRes.error };

  // Anthropic's shape varies slightly between docs versions; we accept
  // both { data: [...] } and { results: [...] }. Defensive parsing here
  // because the API has been moving as the admin product matures.
  const costRows = extractRows<AnthropicCostReportRow>(costRes.body);
  const usageRows = extractRows<AnthropicUsageReportRow>(usageRes.body);

  let totalUsdMicroCents = 0;
  for (const r of costRows) {
    if (typeof r.micro_cents === 'number') totalUsdMicroCents += r.micro_cents;
    else if (typeof r.cost_cents === 'number') totalUsdMicroCents += r.cost_cents * 10_000;
  }
  const totalUsdCents = totalUsdMicroCents / 10_000; // micro-cents → cents

  let totalTokens = 0;
  for (const r of usageRows) {
    totalTokens +=
      (r.uncached_input_tokens ?? 0) +
      (r.cached_input_tokens ?? 0) +
      (r.cache_creation_input_tokens ?? 0) +
      (r.output_tokens ?? 0);
  }

  if (totalTokens <= 0) {
    return {
      ok: false,
      error:
        'Anthropic devolvió 0 tokens en el período — sin uso real, no se puede calcular rate',
      daysCounted: windowDays,
      totalTokens: 0,
      rawUsdCents: Math.round(totalUsdCents),
      usdToMxn,
    };
  }

  const totalMxnCents = Math.round(totalUsdCents * usdToMxn);
  const ratePerMillionCents = Math.round(
    (totalMxnCents / totalTokens) * 1_000_000,
  );

  return {
    ok: true,
    daysCounted: windowDays,
    totalTokens,
    totalCostMxnCents: totalMxnCents,
    ratePerMillionCents,
    usdToMxn,
    rawUsdCents: Math.round(totalUsdCents),
  };
}

function extractRows<T>(body: unknown): T[] {
  if (!body || typeof body !== 'object') return [];
  const obj = body as Record<string, unknown>;
  if (Array.isArray(obj.data)) return obj.data as T[];
  if (Array.isArray(obj.results)) return obj.results as T[];
  if (Array.isArray(obj.usage)) return obj.usage as T[];
  return [];
}
