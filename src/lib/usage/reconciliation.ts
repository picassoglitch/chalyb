// Monthly reconciliation: the Anthropic cost our engines recorded vs. what
// Anthropic billed (Usage & Cost Admin API, needs ANTHROPIC_ADMIN_KEY).
// A positive gap means usage we paid for but didn't charge users.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  reconcileByModel,
  sumCostReport,
  utcMonth,
  type CostReportPage,
  type ReconRow,
} from './reconciliation-core';

const API = 'https://api.anthropic.com/v1/organizations/cost_report';

export type AnthropicRecon =
  | { ok: false; error: 'no_key' | 'api' | 'db'; detail?: string }
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

async function fetchCostReport(start: Date, end: Date, key: string): Promise<CostReportPage[]> {
  const pages: CostReportPage[] = [];
  let page: string | null = null;
  for (let i = 0; i < 10; i++) {
    const qs = new URLSearchParams({
      starting_at: start.toISOString(),
      ending_at: end.toISOString(),
      bucket_width: '1d',
      limit: '31',
    });
    qs.append('group_by[]', 'description');
    qs.append('group_by[]', 'workspace_id');
    if (page) qs.set('page', page);
    const res = await fetch(`${API}?${qs}`, {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'user-agent': 'Chalyb/1.0 (https://www.chalyb.com)' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as CostReportPage;
    pages.push(body);
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return pages;
}

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
    return { ok: false, error: 'api', detail: e instanceof Error ? e.message : String(e) };
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
