// A tiny fake Supabase (auth + a read-only PostgREST) so the e2e suite can run
// every role locally, with no real project and no real accounts.
//
//   pnpm e2e:mock-supabase                      # listens on :59999
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:59999 \
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=local SUPABASE_SERVICE_ROLE_KEY=local \
//     pnpm build && TOOL_HUB_MODE_CHALYBCLIP=mock PORT=3123 pnpm start
//   E2E_BASE_URL=http://localhost:3123 E2E_FREE_EMAIL=free@example.com \
//   E2E_FREE_PASSWORD=mock-pass-123 … E2E_CLIPS_MODE=mock pnpm e2e
//
// Accounts: free | pro | vip | admin @example.com, any password of 6+
// characters. The access token IS the role. Writes are accepted and dropped,
// except for the tables in WRITABLE (P3 flows read back what they wrote:
// risk acks, Avisos, exchange connections), kept in memory per process.
// Test data only — nothing here is shown outside a local run.
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const NOW = Math.floor(Date.now() / 1000);
const ORG = '00000000-0000-0000-0000-000000000001';
const users = {
  free: { role: 'CLIENT', tier: 'FREE', name: 'María López' },
  pro: { role: 'CLIENT', tier: 'PRO', name: 'Pablo Ruiz', selected: 'e-crypto' },
  vip: { role: 'CLIENT', tier: 'VIP', name: 'Valeria Gómez' },
  admin: { role: 'ADMIN', tier: 'FREE', name: 'Admin Chalyb' },
  trial: { role: 'CLIENT', tier: 'PRO', name: 'Tere Prueba', trial: true },
  pro_annual: { role: 'CLIENT', tier: 'PRO', name: 'Ana Anual' },
  past_due: { role: 'CLIENT', tier: 'PRO', name: 'Pepe Pendiente' },
  cancelled: { role: 'CLIENT', tier: 'PRO', name: 'Carla Cancelada' },
};
// Screenshot-only accounts (docs/qa/plans, mockups 87 and 89), off unless
// MOCK_CAPTURE_USERS=1 so the e2e fixtures (counts, totals) stay as they are:
// a Pro Lealtad subscriber on step 2, and a grandfathered $749 Pro mensual
// renewing in 30 days, the day its price-change notice is due (NOTICE_DAYS).
const CAPTURE = process.env.MOCK_CAPTURE_USERS === '1';
if (CAPTURE) {
  users.lealtad = { role: 'CLIENT', tier: 'PRO', name: 'Lía Lealtad' };
  users.legacy = { role: 'CLIENT', tier: 'PRO', name: 'Gael Precio' };
}
const DAY = 86400000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const sub = (k, over) => ({
  id: `s-${k}`, user_id: `u-${k}`, status: 'authorized', tier: 'PRO', plan_key: 'pro_month',
  mp_preapproval_id: `pre-${k}`, external_reference: `sub|u-${k}|PRO`, amount_cents: 86884, currency: 'MXN',
  started_at: iso(-40 * DAY), trial_ends_at: null, next_charge_at: iso(20 * DAY), next_payment_date: iso(20 * DAY),
  grace_ends_at: null, access_until: null, card_brand: 'visa', card_last4: '4242', card_exp: '12/29',
  cancel_at_period_end: false, cancelled_at: null, pending_plan_key: null, pending_effective_at: null,
  reminder_delivered_at: null, charge_hold_until: null, last_charge_at: iso(-10 * DAY), consent_id: '8f3c2a1e-6b7d-4f0a-9e21-2c5d7a9b1f44',
  created_at: iso(-40 * DAY), updated_at: new Date().toISOString(), ...over,
});
const user = (k) => ({
  id: `u-${k}`, aud: 'authenticated', role: 'authenticated', email: `${k}@example.com`,
  user_metadata: { full_name: users[k].name }, app_metadata: { provider: 'email' },
  created_at: '2026-01-01T00:00:00Z',
});
const eng = (id, slug, name, status, tier = 'PRO') => ({
  id, slug, name, icon: '◆', category: 'CONTENT', type: 'tool', env: 'prod', region: 'mx', node: 'n1',
  description: '', featured: slug === 'chalybclip', status, tier_required: tier,
  external_url: status === 'active' ? 'http://localhost:59998' : null,
  integration_mode: status === 'active' ? 'external_sso_redirect' : 'internal_placeholder',
  admin_api_base: null, requires_provisioning: true, owner_user_id: null, org_id: ORG,
  partner_royalty_per_million_tokens_cents: 0, cost_per_million_tokens_cents: 0, fixed_monthly_cost_cents: 0,
  engine_health: [], engine_personas: [],
});
const tables = {
  subscriptions: [
    sub('pro', {}),
    sub('vip', { tier: 'VIP', plan_key: 'vip_month', amount_cents: 379900 }),
    // A 7-day trial on day 2; its charge notice went out (and was delivered) on day 0.
    sub('trial', { plan_key: 'pro_year', amount_cents: 997000, trial_ends_at: iso(5 * DAY), next_charge_at: iso(5 * DAY), next_payment_date: iso(5 * DAY), last_charge_at: null, started_at: iso(-2 * DAY), reminder_delivered_at: iso(-2 * DAY) }),
    sub('pro_annual', { plan_key: 'pro_year', amount_cents: 997000, next_charge_at: iso(5 * DAY), next_payment_date: iso(5 * DAY), reminder_delivered_at: iso(-2 * DAY) }),
    sub('past_due', { status: 'paused', next_charge_at: iso(-1 * DAY), next_payment_date: iso(-1 * DAY), grace_ends_at: iso(6 * DAY) }),
    sub('cancelled', { status: 'cancelled', cancel_at_period_end: true, access_until: iso(12 * DAY), cancelled_at: iso(-2 * DAY) }),
    ...(CAPTURE
      ? [
          sub('lealtad', { plan_key: 'pro_lealtad', loyalty_step: 2, amount_cents: 132900, started_at: iso(-35 * DAY), next_charge_at: iso(25 * DAY), next_payment_date: iso(25 * DAY) }),
          sub('legacy', { plan_key: 'pro_month', amount_cents: 74900, started_at: iso(-400 * DAY), next_charge_at: iso(30 * DAY), next_payment_date: iso(30 * DAY) }),
        ]
      : []),
  ],
  payments: [
    { id: 'p1', user_id: 'u-pro', tier: 'PRO', kind: 'subscription', pack_id: null, tokens_granted: null, mp_payment_id: '1001', mp_preapproval_id: 'pre-pro', amount_cents: 86884, currency: 'MXN', status: 'approved', created_at: iso(-10 * DAY) },
    { id: 'p2', user_id: 'u-past_due', tier: 'PRO', kind: 'subscription', pack_id: null, tokens_granted: null, mp_payment_id: '1002', mp_preapproval_id: 'pre-past_due', amount_cents: 86884, currency: 'MXN', status: 'rejected', created_at: iso(-1 * DAY) },
  ],
  engines: [
    eng('e-clip', 'chalybclip', 'ChalyClip', 'active'),
    eng('e-crypto', 'chalybcrypto', 'ChalyCrypto', 'active'),
    eng('e-obs', 'chalybobs', 'ChalyOBS', 'active'),
    eng('e-bot', 'chalybbot', 'ChalyBot', 'active'),
    eng('e-picks', 'chalybpicks', 'ChalyPicks', 'active'),
    eng('e-realtor', 'chalybrealtor', 'ChalyRealtor', 'active'),
    eng('e-trade', 'chalybtrade', 'ChalyTrade', 'active'),
    eng('e-stream', 'chalybstream', 'ChalyStreamManager', 'coming_soon'),
  ],
  profiles: Object.keys(users).map((k) => ({
    id: `u-${k}`, email: `${k}@example.com`, full_name: users[k].name, role: users[k].role, tier: users[k].tier,
    tier_ends_at: null, org_id: ORG, selected_engine_id: users[k].selected ?? null,
    chalybclip_trial_started_at: null, welcome_gift_claimed_at: '2026-01-01T00:00:00Z', token_bonus_balance: 0, locale: 'es',
    pro_trial_started_at: users[k].trial || k === 'cancelled' ? iso(-5 * DAY) : null, pro_trial_ends_at: null,
  })),
};

tables.consent_events = [];
tables.exchange_connections = [];
// Pro has one billing notice (kept until its charge date) and one unread
// clips notice; the e2e marks them read and checks the billing one stays.
tables.user_notifications = [
  { id: 'n-pro-1', user_id: 'u-pro', kind: 'renew', title: 'Tu plan se renueva en 7 días', body: 'El 21 de octubre de 2026 se cobrarán $868.84 MXN.', href: '/app/billing', keep_until: iso(20 * DAY), dedupe_key: 'renew7:pre-pro', read_at: null, created_at: iso(-1 * 3600000) },
  { id: 'n-pro-2', user_id: 'u-pro', kind: 'liveEnded', title: 'Tu transmisión terminó', body: 'Duró 42 min. ¿Hacemos clips?', href: '/app/clips', keep_until: null, dedupe_key: 'live:seed', read_at: null, created_at: iso(-3 * DAY) },
];
// Owner panel (P5) fixtures: one unread idea and one billing request, a
// bounced notice for past_due, tool usage by a paying user (so hiding
// Inmuebles asks first), and a free person the e2e can gift a month to
// without touching the role accounts.
tables.partner_inquiries = [
  { id: 'i-1', name: 'Lucía', email: 'lucia@example.com', message: 'Una herramienta para agendar citas', pane: 'idea', read_at_admin: null, created_at: iso(-2 * DAY) },
  { id: 'i-2', name: 'Pepe Pendiente', email: 'past_due@example.com', message: '[cobro] Me cobraron dos veces\n\nRevisen por favor', pane: 'client', read_at_admin: null, created_at: iso(-1 * DAY) },
];
tables.email_dispatches = [
  { id: 'd-1', user_id: 'u-past_due', kind: 'renew_7d', period_key: 'renew7:pre-past_due', template_id: 'billing.renew_7d', template_version: '1', sent_at: iso(-3 * DAY), delivery_status: 'bounced', bounced_at: iso(-3 * DAY) },
];
tables.cancellation_events = [
  { folio_cancelacion: 'C-MOCK01', user_id: 'u-cancelled', subscription_id: 's-cancelled', requested_at: iso(-2 * DAY), access_until: iso(12 * DAY), consent_id: null, email_message_id: null },
];
tables.usage_events = [
  { id: 'ue-1', user_id: 'u-pro', engine_id: 'e-realtor', kind: 'llm.tokens', amount: 1200, source_id: 'mock-1', occurred_at: iso(-3 * DAY), created_at: iso(-3 * DAY) },
];
tables.audit_events = [];
tables.app_settings = [];
tables.notifications = [];
tables.profiles.push({
  id: 'u-gift', email: 'gina@example.com', full_name: 'Gina Regalo', role: 'CLIENT', tier: 'FREE', tier_ends_at: null, org_id: ORG,
  selected_engine_id: null, chalybclip_trial_started_at: null, welcome_gift_claimed_at: null, token_bonus_balance: 0, locale: 'es',
  pro_trial_started_at: null, pro_trial_ends_at: null, created_at: iso(-9 * DAY),
});
const WRITABLE = new Set([
  'consent_events', 'exchange_connections', 'user_notifications',
  'audit_events', 'app_settings', 'engines', 'profiles',
]);

const field = (r, k) => {
  const j = /^(\w+)->>(\w+)$/.exec(k);
  return j ? r[j[1]]?.[j[2]] : r[k];
};

function filterRows(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const m = /^eq\.(.*)$/.exec(v);
    if (m) out = out.filter((r) => String(field(r, k)) === m[1]);
    if (v === 'is.null') out = out.filter((r) => field(r, k) == null);
    if (v === 'not.is.null') out = out.filter((r) => field(r, k) != null);
    const cmp = /^(gte|gt|lte|lt|neq)\.(.*)$/.exec(v);
    if (cmp) {
      const [, op, want] = cmp;
      out = out.filter((r) => {
        const got = String(field(r, k) ?? '');
        if (op === 'neq') return got !== want;
        const c = got.localeCompare(want);
        return op === 'gte' ? c >= 0 : op === 'gt' ? c > 0 : op === 'lte' ? c <= 0 : c < 0;
      });
    }
    const like = /^ilike\.(.*)$/.exec(v);
    if (like) {
      const re = new RegExp(`^${like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*')}$`, 'is');
      out = out.filter((r) => re.test(String(field(r, k) ?? '')));
    }
    const inm = /^in\.\((.*)\)$/.exec(v);
    if (inm) { const set = inm[1].split(',').map((s) => s.replace(/"/g, '')); out = out.filter((r) => set.includes(String(r[k]))); }
  }
  return out;
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const cors = {
    'access-control-allow-origin': req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
    'access-control-expose-headers': 'content-range',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...cors, ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  if (url.pathname === '/auth/v1/user') {
    return users[token] ? send(200, user(token)) : send(401, { msg: 'invalid token' });
  }
  if (url.pathname === '/auth/v1/token') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const k = parsed.email ? parsed.email.split('@')[0] : parsed.refresh_token;
      if (!users[k]) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      send(200, { access_token: k, refresh_token: k, token_type: 'bearer', expires_in: 360000, expires_at: NOW + 360000, user: user(k) });
    });
    return;
  }
  if (url.pathname.startsWith('/auth/v1/')) return send(200, {});
  // usage_balance (prod migration 0046): this month's metered use, the
  // bonus and the period start, like the SQL function.
  if (url.pathname === '/rest/v1/rpc/usage_balance') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
    let uid = '';
    try {
      uid = JSON.parse(raw || '{}').p_user_id ?? '';
    } catch {
      /* no body */
    }
    const n = new Date();
    const period = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)).toISOString();
    const used = tables.usage_events
      .filter((e) => e.user_id === uid && e.occurred_at >= period)
      .reduce((a, e) => a + Number(e.billable_tokens ?? e.amount ?? 0), 0);
    const bonus = tables.profiles.find((p) => p.id === uid)?.token_bonus_balance ?? 0;
    send(200, { used, reserved: 0, bonus, held: 0, period_start: period });
    });
    return;
  }
  if (url.pathname.startsWith('/rest/v1/rpc/')) return send(200, null);
  const table = url.pathname.replace('/rest/v1/', '');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (!WRITABLE.has(table)) return send(201, []);
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => write(req, url, table, body ? JSON.parse(body) : null, send));
    return;
  }
  let rows = filterRows(tables[table] ?? [], url.searchParams);
  const order = url.searchParams.get('order');
  if (order) {
    const [col, dir] = order.split('.');
    rows = [...rows].sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (dir === 'desc' ? -1 : 1));
  }
  const limit = Number(url.searchParams.get('limit'));
  if (limit) rows = rows.slice(0, limit);
  const single = (req.headers.accept ?? '').includes('vnd.pgrst.object');
  const headers = { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` };
  if (req.method === 'HEAD') return send(200, undefined, headers);
  if (single) return rows[0] ? send(200, rows[0], headers) : send(406, { code: 'PGRST116', message: 'no rows' });
  send(200, rows, headers);
}).listen(Number(process.env.MOCK_SUPABASE_PORT ?? 59999), () => console.log(`mock supabase on :${process.env.MOCK_SUPABASE_PORT ?? 59999}`));


function write(req, url, table, body, send) {
  const prefer = req.headers.prefer ?? '';
  const single = (req.headers.accept ?? '').includes('vnd.pgrst.object');
  const reply = (rows) =>
    prefer.includes('return=representation') ? send(single ? 200 : 201, single ? rows[0] ?? null : rows) : send(201, undefined);
  const list = tables[table];
  if (req.method === 'POST') {
    const conflict = url.searchParams.get('on_conflict')?.split(',') ?? [];
    const out = [];
    for (const raw of Array.isArray(body) ? body : [body]) {
      const row = { id: randomUUID(), created_at: new Date().toISOString(), inserted_at: new Date().toISOString(), ...raw };
      const dup = conflict.length ? list.find((r) => conflict.every((c) => String(r[c]) === String(row[c]))) : null;
      if (dup) {
        if (prefer.includes('ignore-duplicates')) continue;
        Object.assign(dup, raw);
        out.push(dup);
      } else {
        list.push(row);
        out.push(row);
      }
    }
    return reply(out);
  }
  const hit = filterRows(list, url.searchParams);
  if (req.method === 'PATCH') {
    for (const r of hit) Object.assign(r, body);
    return reply(hit);
  }
  if (req.method === 'DELETE') {
    tables[table] = list.filter((r) => !hit.includes(r));
    return reply(hit);
  }
  send(405, { message: 'method not allowed' });
}
