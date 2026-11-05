// In-memory PostgREST, Mercado Pago GETs and Vercel Analytics behind globalThis.fetch,
// so billing code runs end to end (real supabase-js, real @vercel/analytics) under node:test.

type Row = Record<string, unknown>;

export const SUPABASE_URL = 'http://supabase.fake';
export const ANALYTICS_URL = 'http://analytics.fake/_vercel/insights/event';

export interface AnalyticsEvent {
  name: string;
  props: Record<string, unknown>;
}

export interface FakeBackend {
  tables: Record<string, Row[]>;
  /** Mercado Pago GET responses by path (e.g. /authorized_payments/1). */
  mp: Record<string, unknown>;
  events: AnalyticsEvent[];
  /** Make the analytics endpoint throw instead of answering. */
  analyticsThrows: boolean;
  /** Fail the next request matching (method, table): PostgREST error body. */
  failNext: { method: string; table: string; filter?: string }[];
  reset(): void;
}

function field(row: Row, key: string): unknown {
  return row[key];
}

function matches(row: Row, key: string, op: string): boolean {
  const v = field(row, key);
  if (op === 'is.null') return v == null;
  if (op === 'not.is.null') return v != null;
  const [kind, ...rest] = op.split('.');
  const arg = rest.join('.');
  switch (kind) {
    case 'eq':
      return String(v) === arg;
    case 'neq':
      return String(v) !== arg;
    case 'in':
      return arg.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v));
    case 'gte':
      return v != null && String(v) >= arg;
    case 'lte':
      return v != null && String(v) <= arg;
    case 'gt':
      return v != null && String(v) > arg;
    case 'lt':
      return v != null && String(v) < arg;
    default:
      throw new Error(`fake postgrest: unsupported filter ${key}=${op}`);
  }
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function filterRows(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows;
  for (const [k, v] of params) {
    if (RESERVED.has(k)) continue;
    out = out.filter((r) => matches(r, k, v));
  }
  const limit = Number(params.get('limit'));
  return limit ? out.slice(0, limit) : out;
}

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let purchaseSeq = 0;

function rpc(b: FakeBackend, name: string, args: Row): Response {
  if (name === 'grant_token_pack') {
    // Same contract as migration 0065: unique on the payment id.
    const purchases = (b.tables.token_pack_purchases ??= []);
    if (args.p_mp_payment_id && purchases.some((p) => p.mp_payment_id === args.p_mp_payment_id)) {
      return json(200, { ok: true, already_granted: true });
    }
    purchases.push({
      id: `tpp-${++purchaseSeq}`,
      user_id: args.p_user_id,
      tokens: args.p_tokens,
      mp_payment_id: args.p_mp_payment_id,
    });
    return json(200, { ok: true, already_granted: false, balance: args.p_tokens });
  }
  return json(200, null);
}

function postgrest(b: FakeBackend, url: URL, init: RequestInit): Response {
  const method = (init.method ?? 'GET').toUpperCase();
  const path = url.pathname.replace('/rest/v1/', '');
  const body = init.body ? JSON.parse(String(init.body)) : null;
  if (path.startsWith('rpc/')) return rpc(b, path.slice(4), body ?? {});
  const table = path;
  const failAt = b.failNext.findIndex(
    (f) => f.method === method && f.table === table && (!f.filter || url.search.includes(f.filter)),
  );
  if (failAt >= 0) {
    b.failNext.splice(failAt, 1);
    return json(500, { code: 'XX000', message: 'injected failure', details: null, hint: null });
  }
  const list = (b.tables[table] ??= []);
  const headers = new Headers(init.headers);
  const prefer = headers.get('prefer') ?? '';
  const single = (headers.get('accept') ?? '').includes('vnd.pgrst.object');
  const reply = (rows: Row[]) => {
    if (method !== 'GET' && !prefer.includes('return=representation')) return json(201, undefined);
    if (single) {
      return rows.length === 1
        ? json(200, rows[0])
        : json(406, { code: 'PGRST116', message: `${rows.length} rows`, details: null, hint: null });
    }
    return json(200, rows);
  };
  if (method === 'GET' || method === 'HEAD') return reply(filterRows(list, url.searchParams));
  if (method === 'POST') {
    const conflict = url.searchParams.get('on_conflict')?.split(',') ?? [];
    const out: Row[] = [];
    for (const raw of Array.isArray(body) ? body : [body]) {
      const dup = conflict.length
        ? list.find((r) => conflict.every((c) => String(r[c]) === String(raw[c])))
        : undefined;
      if (dup) {
        if (prefer.includes('ignore-duplicates')) continue;
        Object.assign(dup, raw);
        out.push(dup);
      } else {
        const row = { id: `${table}-${list.length + 1}`, created_at: new Date().toISOString(), ...raw };
        list.push(row);
        out.push(row);
      }
    }
    return reply(out);
  }
  const hit = filterRows(list, url.searchParams);
  if (method === 'PATCH') {
    for (const r of hit) Object.assign(r, body);
    return reply(hit);
  }
  if (method === 'DELETE') {
    b.tables[table] = list.filter((r) => !hit.includes(r));
    return reply(hit);
  }
  return json(405, { message: 'method not allowed' });
}

/** Installs the fake as globalThis.fetch and the env the billing code reads. */
export function installFakeBackend(): FakeBackend {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role';
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-fake-token';
  process.env.VERCEL_WEB_ANALYTICS_ENDPOINT = ANALYTICS_URL;
  process.env.VERCEL_WEB_ANALYTICS_DISABLE_LOGS = '1';
  // What Vercel's runtime provides per request: the headers @vercel/analytics needs.
  (globalThis as Record<symbol, unknown>)[Symbol.for('@vercel/request-context')] = {
    get: () => ({ headers: { 'user-agent': 'mercadopago-webhook' }, url: 'https://chalyb.test/api/mp/webhook' }),
  };

  const b: FakeBackend = {
    tables: {},
    mp: {},
    events: [],
    analyticsThrows: false,
    failNext: [],
    reset() {
      this.tables = {};
      this.mp = {};
      this.events = [];
      this.analyticsThrows = false;
      this.failNext = [];
    },
  };

  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const req = input instanceof Request ? input : null;
    const merged: RequestInit = {
      method: init.method ?? req?.method,
      headers: init.headers ?? req?.headers,
      body: init.body ?? (req ? await req.text() : undefined),
    };
    if (url.href === ANALYTICS_URL) {
      if (b.analyticsThrows) throw new Error('analytics endpoint down');
      const sent = JSON.parse(String(merged.body)) as { en: string; ed?: Record<string, unknown> };
      b.events.push({ name: sent.en, props: sent.ed ?? {} });
      return new Response('ok');
    }
    if (url.origin === SUPABASE_URL) return postgrest(b, url, merged);
    if (url.origin === 'https://api.mercadopago.com') {
      const found = b.mp[url.pathname];
      return found === undefined ? json(404, { message: 'not found' }) : json(200, found);
    }
    throw new Error(`fake backend: unexpected fetch ${url.href}`);
  }) as typeof fetch;

  return b;
}

/** Lets fire-and-forget analytics calls land before asserting. */
export async function drain(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
}
