// Reconciliation math: what engines recorded vs. what the provider billed.
// Pure, so it's testable without the network.

/** One result row of Anthropic's cost report (group_by description +
 *  workspace_id). `amount` is a decimal string in cents: "123.45" = $1.23. */
export interface CostReportResult {
  amount: string;
  currency?: string;
  model?: string | null;
  workspace_id?: string | null;
  cost_type?: string | null;
}

export interface CostReportPage {
  data: Array<{ starting_at: string; ending_at: string; results: CostReportResult[] }>;
  has_more?: boolean;
  next_page?: string | null;
}

/** Cents (decimal string) → USD micros. 1 cent = 10,000 micros. */
export function centsToMicros(amount: string): number {
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n * 10_000) : 0;
}

export interface ProviderTotals {
  totalMicros: number;
  byModel: Map<string, number>;
  byWorkspace: Map<string, number>;
}

export function sumCostReport(pages: CostReportPage[]): ProviderTotals {
  const out: ProviderTotals = { totalMicros: 0, byModel: new Map(), byWorkspace: new Map() };
  for (const page of pages) {
    for (const bucket of page.data ?? []) {
      for (const r of bucket.results ?? []) {
        if (r.currency && r.currency !== 'USD') continue;
        const micros = centsToMicros(r.amount);
        out.totalMicros += micros;
        const model = r.model ?? (r.cost_type && r.cost_type !== 'tokens' ? r.cost_type : '—');
        out.byModel.set(model, (out.byModel.get(model) ?? 0) + micros);
        const ws = r.workspace_id ?? 'default';
        out.byWorkspace.set(ws, (out.byWorkspace.get(ws) ?? 0) + micros);
      }
    }
  }
  return out;
}

/** Recorded model ids can carry a dated suffix; the report uses family ids. */
export function normalizeModel(model: string): string {
  return model.trim().toLowerCase().replace(/-\d{8}$/, '');
}

export interface ReconRow {
  model: string;
  recordedMicros: number;
  billedMicros: number;
  /** billed − recorded, as a share of billed. Positive = we under-recorded
   *  (users were under-charged); negative = we over-recorded. null when
   *  nothing was billed. */
  gapPct: number | null;
}

export function reconcileByModel(
  recorded: Map<string, number>,
  billed: Map<string, number>,
): ReconRow[] {
  const models = new Set<string>();
  const rec = new Map<string, number>();
  const bil = new Map<string, number>();
  for (const [m, v] of recorded) {
    const k = normalizeModel(m);
    rec.set(k, (rec.get(k) ?? 0) + v);
    models.add(k);
  }
  for (const [m, v] of billed) {
    const k = normalizeModel(m);
    bil.set(k, (bil.get(k) ?? 0) + v);
    models.add(k);
  }
  return [...models]
    .map((model) => {
      const r = rec.get(model) ?? 0;
      const b = bil.get(model) ?? 0;
      return { model, recordedMicros: r, billedMicros: b, gapPct: b > 0 ? ((b - r) / b) * 100 : null };
    })
    .sort((a, b) => b.billedMicros + b.recordedMicros - (a.billedMicros + a.recordedMicros));
}

/** [start, end) of a calendar month in UTC, `offset` months from `now`. */
export function utcMonth(now: Date, offset = 0): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return { start, end };
}
