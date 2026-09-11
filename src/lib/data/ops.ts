// Real-data reads for the admin command-center pages that used to render
// hardcoded mocks (analytics, api, models, queues, automations, streams,
// notifications). Same contract as engines.ts: the UI imports from here
// and never touches the Supabase client directly.
//
// CLIENT CHOICE:
//   - RLS server client where admin SELECT policies exist: usage_events,
//     payments, audit_events, token_pack_purchases, notifications, engines.
//   - Service-role client ONLY for the ChalybOBS tenant tables — those have
//     no auth policies on purpose (defense-in-depth lockdown in migration
//     0023), so the page using listObsStreams() must role-gate explicitly.
//
// ROW-CAP CAVEAT: the daily series / rollups aggregate raw usage_events
// rows client-side (same approach telemetry.ts already takes for "today").
// PostgREST caps responses at the project's max-rows setting, so once the
// platform pushes >USAGE_ROW_LIMIT events per 60 days these aggregates
// undercount and should move to a SQL RPC like compute_engine_royalties.

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const DAY_MS = 86_400_000;
const USAGE_ROW_LIMIT = 5000;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

/** UTC day bucket ('YYYY-MM-DD') for an ISO timestamp. */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Last `n` UTC day keys, oldest → newest, ending today. */
function lastDayKeys(n: number): string[] {
  const out: string[] = [];
  const today = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(today - i * DAY_MS).toISOString().slice(0, 10));
  }
  return out;
}

/** "hace 12 min" / "hace 3 h" / "hace 2 d" — for feed-style rows. */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'ahora';
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function formatUsdMicros(micros: number): string {
  return `$${(micros / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

// ── Shared usage_events window fetch ─────────────────────────────────────

interface UsageRow {
  occurred_at: string;
  amount: number;
  kind: string;
  engine_id: string;
  provider: string | null;
  operation: string | null;
  cost_usd_micros: number | null;
}

async function fetchUsageRows(sinceDays: number): Promise<UsageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('usage_events')
    .select('occurred_at, amount, kind, engine_id, provider, operation, cost_usd_micros')
    .gte('occurred_at', daysAgoIso(sinceDays))
    .order('occurred_at', { ascending: false })
    .limit(USAGE_ROW_LIMIT);
  if (error) {
    console.error('[ops.fetchUsageRows]', error.message);
    return [];
  }
  return (data ?? []) as UsageRow[];
}

// ── Analytics ────────────────────────────────────────────────────────────

export interface CategorySlice {
  category: string;
  tokens: number;
  costUsdMicros: number;
  pct: number; // share of tokens, 0–100
}

export interface Analytics {
  /** 30 buckets each, oldest → newest. */
  jobsDaily: number[];
  tokensDaily: number[];
  revenueDaily: number[]; // approved payments, $ per day
  jobs24h: number;
  jobs30d: number;
  tokens30d: number;
  cost30dUsdMicros: number;
  revenue30dCents: number;
  revenuePrev30dCents: number;
  categories: CategorySlice[];
}

export async function getAnalytics(): Promise<Analytics> {
  const supabase = await createClient();
  const [usage60d, paymentsResult, enginesResult, jobs24hResult] = await Promise.all([
    fetchUsageRows(60),
    supabase
      .from('payments')
      .select('created_at, amount_cents, status')
      .eq('status', 'approved')
      .gte('created_at', daysAgoIso(60))
      .limit(USAGE_ROW_LIMIT),
    supabase.from('engines').select('id, category'),
    supabase
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .gte('occurred_at', daysAgoIso(1)),
  ]);

  const days = lastDayKeys(30);
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const cutoff30dIso = daysAgoIso(30);

  const jobsDaily = days.map(() => 0);
  const tokensDaily = days.map(() => 0);
  const revenueDaily = days.map(() => 0);

  let jobs30d = 0;
  let tokens30d = 0;
  let cost30dUsdMicros = 0;
  const tokensByEngine = new Map<string, number>();
  const costByEngine = new Map<string, number>();

  for (const row of usage60d) {
    if (row.occurred_at < cutoff30dIso) continue;
    jobs30d += 1;
    cost30dUsdMicros += row.cost_usd_micros ?? 0;
    if (row.kind === 'llm.tokens') tokens30d += row.amount;
    tokensByEngine.set(row.engine_id, (tokensByEngine.get(row.engine_id) ?? 0) + row.amount);
    costByEngine.set(
      row.engine_id,
      (costByEngine.get(row.engine_id) ?? 0) + (row.cost_usd_micros ?? 0),
    );
    const idx = dayIndex.get(dayKey(row.occurred_at));
    if (idx !== undefined) {
      jobsDaily[idx] = (jobsDaily[idx] ?? 0) + 1;
      if (row.kind === 'llm.tokens') tokensDaily[idx] = (tokensDaily[idx] ?? 0) + row.amount;
    }
  }

  let revenue30dCents = 0;
  let revenuePrev30dCents = 0;
  for (const p of paymentsResult.data ?? []) {
    const cents = (p.amount_cents as number | null) ?? 0;
    const at = p.created_at as string;
    if (at >= cutoff30dIso) {
      revenue30dCents += cents;
      const idx = dayIndex.get(dayKey(at));
      if (idx !== undefined) revenueDaily[idx] = (revenueDaily[idx] ?? 0) + cents / 100;
    } else {
      revenuePrev30dCents += cents;
    }
  }

  // Tokens grouped by the owning engine's category.
  const categoryByEngine = new Map(
    (enginesResult.data ?? []).map((e) => [e.id as string, (e.category as string) ?? 'OTROS']),
  );
  const byCategory = new Map<string, { tokens: number; cost: number }>();
  for (const [engineId, tokens] of tokensByEngine) {
    const cat = categoryByEngine.get(engineId) ?? 'OTROS';
    const slot = byCategory.get(cat) ?? { tokens: 0, cost: 0 };
    slot.tokens += tokens;
    slot.cost += costByEngine.get(engineId) ?? 0;
    byCategory.set(cat, slot);
  }
  const totalTokens = [...byCategory.values()].reduce((s, c) => s + c.tokens, 0);
  const categories: CategorySlice[] = [...byCategory.entries()]
    .map(([category, c]) => ({
      category,
      tokens: c.tokens,
      costUsdMicros: c.cost,
      pct: totalTokens > 0 ? Math.round((c.tokens / totalTokens) * 100) : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  return {
    jobsDaily,
    tokensDaily,
    revenueDaily,
    jobs24h: jobs24hResult.count ?? 0,
    jobs30d,
    tokens30d,
    cost30dUsdMicros,
    revenue30dCents,
    revenuePrev30dCents,
    categories,
  };
}

// ── Provider usage (API-keys page) ───────────────────────────────────────

export interface ProviderUsage {
  provider: string;
  events30d: number;
  events24h: number;
  costUsdMicros30d: number;
}

export async function getProviderUsage(): Promise<ProviderUsage[]> {
  const rows = await fetchUsageRows(30);
  const cutoff24hIso = daysAgoIso(1);
  const byProvider = new Map<string, ProviderUsage>();
  for (const row of rows) {
    const key = row.provider ?? 'sin proveedor (legacy)';
    const slot =
      byProvider.get(key) ??
      ({ provider: key, events30d: 0, events24h: 0, costUsdMicros30d: 0 } satisfies ProviderUsage);
    slot.events30d += 1;
    if (row.occurred_at >= cutoff24hIso) slot.events24h += 1;
    slot.costUsdMicros30d += row.cost_usd_micros ?? 0;
    byProvider.set(key, slot);
  }
  return [...byProvider.values()].sort((a, b) => b.costUsdMicros30d - a.costUsdMicros30d);
}

// ── Model/meter usage (models page) ──────────────────────────────────────

export interface MeterUsage {
  kind: string;
  operation: string | null;
  events: number;
  amount: number;
  costUsdMicros: number;
}

export interface ProviderMeters {
  provider: string;
  events: number;
  costUsdMicros: number;
  meters: MeterUsage[];
}

export async function getModelUsage(): Promise<ProviderMeters[]> {
  const rows = await fetchUsageRows(30);
  const byProvider = new Map<string, Map<string, MeterUsage>>();
  for (const row of rows) {
    const provider = row.provider ?? 'sin proveedor (legacy)';
    const meterKey = `${row.kind}::${row.operation ?? ''}`;
    const meters = byProvider.get(provider) ?? new Map<string, MeterUsage>();
    const meter =
      meters.get(meterKey) ??
      ({
        kind: row.kind,
        operation: row.operation,
        events: 0,
        amount: 0,
        costUsdMicros: 0,
      } satisfies MeterUsage);
    meter.events += 1;
    meter.amount += row.amount;
    meter.costUsdMicros += row.cost_usd_micros ?? 0;
    meters.set(meterKey, meter);
    byProvider.set(provider, meters);
  }
  return [...byProvider.entries()]
    .map(([provider, meters]) => {
      const list = [...meters.values()].sort((a, b) => b.events - a.events);
      return {
        provider,
        events: list.reduce((s, m) => s + m.events, 0),
        costUsdMicros: list.reduce((s, m) => s + m.costUsdMicros, 0),
        meters: list,
      };
    })
    .sort((a, b) => b.events - a.events);
}

// ── Queue throughput (queues page) ───────────────────────────────────────

export interface EngineThroughput {
  engineId: string;
  name: string;
  icon: string;
  events24h: number;
  events1h: number;
  lastEventAt: string | null;
  kinds: string[];
}

export async function getQueueThroughput(): Promise<EngineThroughput[]> {
  const supabase = await createClient();
  const [rows, enginesResult] = await Promise.all([
    fetchUsageRows(1),
    supabase.from('engines').select('id, name, icon'),
  ]);
  const engineMeta = new Map(
    (enginesResult.data ?? []).map((e) => [
      e.id as string,
      { name: (e.name as string) ?? 'Engine', icon: (e.icon as string | null) ?? '◆' },
    ]),
  );
  const hourAgoIso = new Date(Date.now() - 3_600_000).toISOString();
  const byEngine = new Map<string, EngineThroughput>();
  for (const row of rows) {
    const meta = engineMeta.get(row.engine_id) ?? { name: 'Engine', icon: '◆' };
    const slot =
      byEngine.get(row.engine_id) ??
      ({
        engineId: row.engine_id,
        name: meta.name,
        icon: meta.icon,
        events24h: 0,
        events1h: 0,
        lastEventAt: null,
        kinds: [],
      } satisfies EngineThroughput);
    slot.events24h += 1;
    if (row.occurred_at >= hourAgoIso) slot.events1h += 1;
    if (!slot.lastEventAt || row.occurred_at > slot.lastEventAt) slot.lastEventAt = row.occurred_at;
    if (!slot.kinds.includes(row.kind)) slot.kinds.push(row.kind);
    byEngine.set(row.engine_id, slot);
  }
  return [...byEngine.values()].sort((a, b) => b.events24h - a.events24h);
}

// ── Automation flows (automations page) ──────────────────────────────────
//
// The platform's REAL automated flows — each count comes from the table
// that flow writes to. No synthetic run counts.

export interface AutomationCounts {
  payments30d: number;
  paymentsApproved30d: number;
  tokenPacks30d: number;
  welcomeGifts30d: number;
  usageEvents30d: number;
  auditEvents30d: number;
  subscriptions30d: number;
}

export async function getAutomationCounts(): Promise<AutomationCounts> {
  const supabase = await createClient();
  const cutoff = daysAgoIso(30);
  const count = (table: string, timeCol: string) =>
    supabase.from(table).select('id', { count: 'exact', head: true }).gte(timeCol, cutoff);

  const [payments, paymentsApproved, packs, gifts, usage, audit, subs] = await Promise.all([
    count('payments', 'created_at'),
    supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('created_at', cutoff),
    count('token_pack_purchases', 'created_at'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('welcome_gift_claimed_at', cutoff),
    count('usage_events', 'occurred_at'),
    count('audit_events', 'created_at'),
    count('engine_subscriptions', 'created_at'),
  ]);

  return {
    payments30d: payments.count ?? 0,
    paymentsApproved30d: paymentsApproved.count ?? 0,
    tokenPacks30d: packs.count ?? 0,
    welcomeGifts30d: gifts.count ?? 0,
    usageEvents30d: usage.count ?? 0,
    auditEvents30d: audit.count ?? 0,
    subscriptions30d: subs.count ?? 0,
  };
}

// ── ChalybOBS streams (streams page) ───────────────────────────────────────
//
// Service-role read: chalybobs_* have no auth RLS policies by design
// (migration 0023). The page MUST role-gate before calling this.

export interface ObsDestination {
  platformId: string;
  channelHandle: string;
  enabled: boolean;
  statusKind: string | null;
}

export interface ObsStream {
  tenantId: string;
  title: string;
  isLive: boolean;
  recordEnabled: boolean;
  updatedAt: string;
  ownerEmail: string | null;
  destinations: ObsDestination[];
}

export async function listObsStreams(): Promise<ObsStream[]> {
  const admin = createAdminClient();
  const [sessionsResult, destinationsResult] = await Promise.all([
    admin
      .from('chalybobs_sessions')
      .select('tenant_id, title, is_live, record_enabled, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100),
    admin
      .from('chalybobs_destinations')
      .select('tenant_id, platform_id, channel_handle, enabled, status_kind'),
  ]);
  if (sessionsResult.error) {
    console.error('[ops.listObsStreams]', sessionsResult.error.message);
    return [];
  }

  const sessions = sessionsResult.data ?? [];
  const tenantIds = sessions.map((s) => s.tenant_id as string);
  let emailByTenant = new Map<string, string | null>();
  if (tenantIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email')
      .in('id', tenantIds);
    emailByTenant = new Map(
      (profiles ?? []).map((p) => [p.id as string, (p.email as string | null) ?? null]),
    );
  }

  const destsByTenant = new Map<string, ObsDestination[]>();
  for (const d of destinationsResult.data ?? []) {
    const tenant = d.tenant_id as string;
    const list = destsByTenant.get(tenant) ?? [];
    list.push({
      platformId: d.platform_id as string,
      channelHandle: (d.channel_handle as string) ?? '',
      enabled: Boolean(d.enabled),
      statusKind: (d.status_kind as string | null) ?? null,
    });
    destsByTenant.set(tenant, list);
  }

  return sessions.map((s) => ({
    tenantId: s.tenant_id as string,
    title: (s.title as string) ?? '',
    isLive: Boolean(s.is_live),
    recordEnabled: Boolean(s.record_enabled),
    updatedAt: (s.updated_at as string) ?? '',
    ownerEmail: emailByTenant.get(s.tenant_id as string) ?? null,
    destinations: destsByTenant.get(s.tenant_id as string) ?? [],
  }));
}

// ── Notifications (notifications page) ───────────────────────────────────

export type NotificationSeverity = 'critical' | 'warning' | 'info';

export interface NotificationRow {
  id: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  href: string | null;
  source: string;
  read_at: string | null;
  created_at: string;
}

export async function listNotifications(): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, severity, title, body, href, source, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    // Friendly hint when migration 0027 hasn't run yet (same pattern as engines.ts).
    if (error.code === '42P01' || /could not find the table|schema cache/i.test(error.message)) {
      console.warn(
        '[ops.listNotifications] notifications table missing — run supabase/migrations/0027_notifications.sql.',
      );
    } else {
      console.error('[ops.listNotifications]', error.message);
    }
    return [];
  }
  return (data ?? []) as NotificationRow[];
}
