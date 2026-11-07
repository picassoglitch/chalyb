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

const COST_REPORT_URL = 'https://api.anthropic.com/v1/organizations/cost_report';

export type CostReportFailure = 'auth' | 'timeout' | 'api';

export class CostReportError extends Error {
  constructor(
    readonly kind: CostReportFailure,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CostReportError';
  }
}

/** Every page of the month's cost report. The whole report (all pages) is
 *  bounded by `timeoutMs` so a stuck Anthropic call can't hang the admin page. */
export async function fetchCostReport(
  start: Date,
  end: Date,
  key: string,
  opts: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<CostReportPage[]> {
  const doFetch = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const pages: CostReportPage[] = [];
  let page: string | null = null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
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
      let body: CostReportPage;
      try {
        const res = await doFetch(`${COST_REPORT_URL}?${qs}`, {
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'user-agent': 'Chalyb/1.0 (https://www.chalyb.com)',
          },
          cache: 'no-store',
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const detail = anthropicErrorText(await res.text().catch(() => ''), key);
          const kind = res.status === 401 || res.status === 403 ? 'auth' : 'api';
          throw new CostReportError(kind, `Anthropic ${res.status}: ${detail}`, res.status);
        }
        body = (await res.json()) as CostReportPage;
      } catch (e) {
        if (e instanceof CostReportError) throw e;
        if (ctrl.signal.aborted) {
          throw new CostReportError('timeout', `Anthropic no respondió en ${timeoutMs / 1000}s`);
        }
        if (e instanceof SyntaxError)
          throw new CostReportError('api', 'Anthropic devolvió una respuesta inválida');
        throw new CostReportError('api', redactSecrets(`red: ${e instanceof Error ? e.message : String(e)}`, key));
      }
      pages.push(body);
      if (!body.has_more || !body.next_page) break;
      page = body.next_page;
    }
  } finally {
    clearTimeout(timer);
  }
  return pages;
}

const REDACTED = '[redactado]';

/** Removes the supplied key and anything shaped like an Anthropic key, so an
 *  upstream error that echoes it never reaches logs or the admin UI. */
export function redactSecrets(text: string, key?: string): string {
  const out = key && key.length >= 8 ? text.split(key).join(REDACTED) : text;
  return out.replace(/sk-ant-[A-Za-z0-9_-]+/g, REDACTED);
}

/** Anthropic's `{"error":{"message":…}}`, redacted and truncated. A body that
 *  isn't that shape (proxy page, HTML) is never surfaced raw. */
export function anthropicErrorText(text: string, key?: string): string {
  let m: unknown;
  try {
    m = (JSON.parse(text) as { error?: { message?: unknown } } | null)?.error?.message;
  } catch {
    m = undefined;
  }
  return typeof m === 'string' ? redactSecrets(m, key).slice(0, 200) : 'respuesta sin detalle legible';
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
