// Real-data telemetry for the SSE strip + activity rail.
//
// Replaces the previous mock random-walk generators with live Supabase
// queries. The /api/stream SSE endpoint calls tickStrip / tickRail on a
// timer; each call returns the current snapshot. Per-process caching
// (2s for strip, 4s for rail) keeps the load reasonable when multiple
// admins are watching the dashboard simultaneously — concurrent SSEs
// share a single round-trip instead of each issuing its own.
//
// Sparkline history (`hist`) lives in module scope and gets push/shift
// on every tick so the line chart in the metric strip has 14 points of
// real history once a few minutes have elapsed. On a fresh process the
// history is seeded with the current value so the line starts flat
// rather than empty.

import { createAdminClient } from '@/lib/supabase/admin';
import { type ActivityEvent, type EngineStateCode, type StripValue } from './types';

// Kept for compatibility — `MOCK` is read by nothing important now, but
// some doc/test code grepped for it historically. Hardwired to false so
// it's obvious in code review that the mock path is gone.
export const MOCK = false;

const HIST_LEN = 14;

// ── Strip metrics ────────────────────────────────────────────────────────
//
// Six tiles in the top metric strip. IDs remain the same shape as the old
// mock for back-compat with metric-strip.tsx (StripMetricId in types.ts);
// the SEMANTICS have changed to real-data definitions:
//
//   active   → engines.status = 'active'
//   aicalls  → COUNT(usage_events) in the last 60s where kind='llm.tokens'
//              (= per-minute rate by construction)
//   rev      → SUM(payments.amount_cents)/100 with status='approved'
//              AND created_at::date = today
//   streams  → COUNT(DISTINCT user_id) usage_events today
//              (now labeled "Usuarios hoy" — no ChalybClip live-stream
//              count available cross-system yet)
//   queue    → SUM(usage_events.amount) today
//              (now labeled "Tokens hoy" — no queue/backpressure concept
//              in the platform yet, so we repurpose the slot)
//   gpu      → COUNT(engine_subscriptions) status='active'
//              (now labeled "Suscripciones" — no real GPU infra yet)

interface StripCache {
  at: number;
  data: StripValue[];
}
let stripCache: StripCache | null = null;
const STRIP_TTL_MS = 2000;

// Sparkline history per metric. Keys match StripValue['id'].
const stripHist: Record<string, number[]> = {
  active: [],
  aicalls: [],
  rev: [],
  streams: [],
  queue: [],
  gpu: [],
};

function pushHist(id: string, value: number): number[] {
  const arr = stripHist[id] ?? [];
  arr.push(value);
  while (arr.length > HIST_LEN) arr.shift();
  // Seed the history so a fresh process doesn't render a one-point line.
  while (arr.length < HIST_LEN) arr.unshift(value);
  stripHist[id] = arr;
  return arr.slice();
}

function startOfDayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}
function sixtySecondsAgoIso(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

export async function tickStrip(): Promise<StripValue[]> {
  const now = Date.now();
  if (stripCache && now - stripCache.at < STRIP_TTL_MS) return stripCache.data;

  const admin = createAdminClient();
  const dayStart = startOfDayIso();
  const minuteAgo = sixtySecondsAgoIso();

  // Six queries in parallel. Each is cheap (COUNT with an indexed predicate
  // or a tiny aggregate). Total round-trip stays under 200ms in practice.
  const [
    enginesResult,
    callsResult,
    revenueResult,
    usersTodayResult,
    tokensTodayResult,
    subsResult,
  ] = await Promise.all([
    admin.from('engines').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'llm.tokens')
      .gte('occurred_at', minuteAgo),
    admin
      .from('payments')
      .select('amount_cents')
      .eq('status', 'approved')
      .gte('created_at', dayStart),
    admin
      .from('usage_events')
      .select('user_id')
      .gte('occurred_at', dayStart),
    admin
      .from('usage_events')
      .select('amount')
      .eq('kind', 'llm.tokens')
      .gte('occurred_at', dayStart),
    admin
      .from('engine_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
  ]);

  const engines = enginesResult.count ?? 0;
  const callsPerMin = callsResult.count ?? 0;
  const revenueCentsToday = (revenueResult.data ?? []).reduce<number>(
    (sum, row) => sum + ((row.amount_cents as number | null) ?? 0),
    0,
  );
  const revenueToday = Math.round(revenueCentsToday / 100);
  const uniqueUsersToday = new Set(
    (usersTodayResult.data ?? []).map((r) => r.user_id as string).filter(Boolean),
  ).size;
  const tokensToday = (tokensTodayResult.data ?? []).reduce<number>(
    (sum, row) => sum + ((row.amount as number | null) ?? 0),
    0,
  );
  const subscriptions = subsResult.count ?? 0;

  const data: StripValue[] = [
    { id: 'active', value: engines, hist: pushHist('active', engines) },
    { id: 'aicalls', value: callsPerMin, hist: pushHist('aicalls', callsPerMin) },
    { id: 'rev', value: revenueToday, hist: pushHist('rev', revenueToday) },
    { id: 'streams', value: uniqueUsersToday, hist: pushHist('streams', uniqueUsersToday) },
    { id: 'queue', value: tokensToday, hist: pushHist('queue', tokensToday) },
    { id: 'gpu', value: subscriptions, hist: pushHist('gpu', subscriptions) },
  ];
  stripCache = { at: now, data };
  return data;
}

// ── Activity rail (sidebar — right column) ──────────────────────────────
//
// Originally three sparkline-ish numbers + a revenue number. We keep the
// shape (jobsPerHour, queue, tokensToday, revenueToday) but back each one
// with real data:
//
//   jobsPerHour   → COUNT(usage_events) in last hour
//   queue         → COUNT(engine_subscriptions WHERE status='active')
//                   (used to be a fake queue depth; repurposed as
//                   "active subs" so the rail tile carries real info)
//   tokensToday   → SUM(usage_events.amount) today, formatted "1.2M"
//   revenueToday  → SUM(payments.amount_cents)/100 today

interface RailCache {
  at: number;
  data: {
    jobsPerHour: number;
    queue: number;
    tokensToday: string;
    revenueToday: number;
  };
}
let railCache: RailCache | null = null;
const RAIL_TTL_MS = 4000;

function formatTokensCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

export async function tickRail() {
  const now = Date.now();
  if (railCache && now - railCache.at < RAIL_TTL_MS) return railCache.data;

  const admin = createAdminClient();
  const dayStart = startOfDayIso();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [jobsResult, subsResult, tokensResult, revenueResult] = await Promise.all([
    admin
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .gte('occurred_at', hourAgo),
    admin
      .from('engine_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    admin
      .from('usage_events')
      .select('amount')
      .eq('kind', 'llm.tokens')
      .gte('occurred_at', dayStart),
    admin
      .from('payments')
      .select('amount_cents')
      .eq('status', 'approved')
      .gte('created_at', dayStart),
  ]);

  const tokensSum = (tokensResult.data ?? []).reduce<number>(
    (sum, row) => sum + ((row.amount as number | null) ?? 0),
    0,
  );
  const revenueCents = (revenueResult.data ?? []).reduce<number>(
    (sum, row) => sum + ((row.amount_cents as number | null) ?? 0),
    0,
  );

  const data = {
    jobsPerHour: jobsResult.count ?? 0,
    queue: subsResult.count ?? 0,
    tokensToday: formatTokensCompact(tokensSum),
    revenueToday: Math.round(revenueCents / 100),
  };
  railCache = { at: now, data };
  return data;
}

// ── Activity feed ───────────────────────────────────────────────────────
//
// Reads the most recent audit_events + recent usage_events to surface real
// activity (tier changes, token grants, large LLM batches). Falls back to
// a small synthetic catalog when there's nothing recent to show — better
// than an empty rail on a fresh deploy.
//
// Cursor maintained per-process so subsequent SSE ticks return the NEXT
// real event rather than the same one. Wraps around when exhausted.

const FALLBACK_ACTS: Array<[EngineStateCode, string, string, string]> = [
  ['g', 'Plataforma lista', 'Chalyb', 'cero usage hoy'],
  ['c', 'Esperando primera llamada', 'Chalyb', 'engines listos'],
];

let recentEventsCache: ActivityEvent[] = [];
let recentEventsCacheAt = 0;
let recentEventsCursor = 0;
const RECENT_TTL_MS = 10_000;

async function refreshRecentEvents(): Promise<void> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [auditResult, usageResult] = await Promise.all([
    admin
      .from('audit_events')
      .select('id, action, actor_email, target_email, metadata, created_at')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(15),
    admin
      .from('usage_events')
      .select('id, amount, kind, occurred_at, engines:engine_id(name, slug)')
      .gte('occurred_at', cutoff)
      .order('occurred_at', { ascending: false })
      .limit(15),
  ]);

  const events: ActivityEvent[] = [];

  for (const row of auditResult.data ?? []) {
    const action = (row.action as string) ?? '';
    const title = labelForAudit(action);
    if (!title) continue;
    const at = (row.created_at as string) ?? new Date().toISOString();
    events.push({
      id: `audit-${row.id}`,
      kind: action.includes('revoke') || action.includes('failed') ? 'r' : 'g',
      title,
      engine: 'Chalyb',
      meta: (row.target_email as string | null) ?? (row.actor_email as string | null) ?? '',
      time: at.slice(11, 16),
    });
  }

  for (const row of usageResult.data ?? []) {
    const engine = (row.engines as { name?: string } | null)?.name ?? 'Engine';
    const amount = (row.amount as number | null) ?? 0;
    const at = (row.occurred_at as string) ?? new Date().toISOString();
    events.push({
      id: `usage-${row.id}`,
      kind: 'p',
      title: `${amount.toLocaleString('es-MX')} tokens consumidos`,
      engine,
      meta: row.kind as string,
      time: at.slice(11, 16),
    });
  }

  // Sort merged by `time` desc (string compare is OK on HH:MM within today).
  events.sort((a, b) => b.time.localeCompare(a.time));
  recentEventsCache = events.slice(0, 20);
  recentEventsCacheAt = Date.now();
}

function labelForAudit(action: string): string | null {
  switch (action) {
    case 'tier.change':
      return 'Tier actualizado por admin';
    case 'tier.payment':
      return 'Pago confirmado — tier activado';
    case 'tier.downgrade':
      return 'Downgrade de tier';
    case 'role.change':
      return 'Rol cambiado';
    case 'selected_bot.change':
      return 'Engine en vivo cambiado';
    case 'partner.engine_assign':
      return 'Asignación de engine a partner';
    case 'tokens.grant':
      return 'Admin otorgó tokens bonus';
    case 'tokens.revoke':
      return 'Admin revocó tokens bonus';
    default:
      return null;
  }
}

let eventSeq = 0;
export async function nextActivityEvent(): Promise<ActivityEvent> {
  if (Date.now() - recentEventsCacheAt > RECENT_TTL_MS) {
    try {
      await refreshRecentEvents();
    } catch {
      // Refresh failure — keep serving stale cache so the rail keeps moving.
    }
  }
  if (recentEventsCache.length === 0) {
    // Empty platform — emit a fallback so the UI doesn't go blank.
    const a = FALLBACK_ACTS[Math.floor(Math.random() * FALLBACK_ACTS.length)]!;
    eventSeq += 1;
    return {
      id: `fb-${Date.now()}-${eventSeq}`,
      kind: a[0],
      title: a[1],
      engine: a[2],
      meta: a[3],
      time: new Date().toTimeString().slice(0, 5),
    };
  }
  // Round-robin through the cached real events so each tick shows a
  // different one — feels alive even when nothing new came in.
  const next = recentEventsCache[recentEventsCursor % recentEventsCache.length]!;
  recentEventsCursor += 1;
  return next;
}
