// Monthly reconciliation: the Anthropic cost our engines recorded vs. what
// Anthropic billed (Usage & Cost Admin API, needs ANTHROPIC_ADMIN_KEY).
// A positive gap means usage we paid for but didn't charge users.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  CostReportError,
  fetchCostReport,
  reconcileByModel,
  sumCostReport,
  utcMonth,
  type CostReportPage,
  type ReconRow,
} from './reconciliation-core';

export type AnthropicRecon =
  | { ok: false; error: 'no_key' | 'auth' | 'timeout' | 'api' | 'db'; detail?: string }
  | {
      ok: true;
      start: string;
      end: string;
      billedMicros: number;
      recordedMicros: number;
      rows: ReconRow[];
      /** Billed per Anthropic workspace — other apps on the same org show
       *  up here as cost we didn't record. */
      byWorkspace: Array<{ workspace: string; micros: number }>;
    };

export async function reconcileAnthropic(now = new Date(), monthOffset = 0): Promise<AnthropicRecon> {
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) return { ok: false, error: 'no_key' };
  const { start, end: monthEnd } = utcMonth(now, monthOffset);
  const end = monthEnd > now ? now : monthEnd;

  let pages: CostReportPage[];
  try {
    pages = await fetchCostReport(start, end, key);
  } catch (e) {
    console.error('[recon] cost report failed', e instanceof Error ? e.message : e);
    const kind = e instanceof CostReportError ? e.kind : 'api';
    return { ok: false, error: kind, detail: e instanceof Error ? e.message : String(e) };
  }
  const billed = sumCostReport(pages);

  const { data, error } = await createAdminClient().rpc('usage_cost_by_model', {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });
  if (error) return { ok: false, error: 'db', detail: error.message };
  const recorded = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ provider: string; model: string; cost_usd_micros: number }>) {
    if (r.provider !== 'anthropic') continue;
    recorded.set(r.model, (recorded.get(r.model) ?? 0) + Number(r.cost_usd_micros));
  }

  return {
    ok: true,
    start: start.toISOString(),
    end: end.toISOString(),
    billedMicros: billed.totalMicros,
    recordedMicros: [...recorded.values()].reduce((a, b) => a + b, 0),
    rows: reconcileByModel(recorded, billed.byModel),
    byWorkspace: [...billed.byWorkspace].map(([workspace, micros]) => ({ workspace, micros })).sort((a, b) => b.micros - a.micros),
  };
}
