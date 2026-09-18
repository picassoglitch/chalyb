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
import { getMoneyToday } from '@/lib/billing/money-data';
import { zonedStartOfDay } from '@/lib/billing/money';
import { type ActivityEvent, type StripValue } from './types';

// Kept for compatibility — `MOCK` is read by nothing important now, but
// some doc/test code grepped for it historically. Hardwired to false so
// it's obvious in code review that the mock path is gone.
export const MOCK = false;

const HIST_LEN = 14;

// ── Strip metrics ────────────────────────────────────────────────────────
//
// THREE tiles. The strip used to carry six, four of which the activity rail
// repeated two hundred pixels away — same number, twice, on the same screen.
// What is left is what an operator glances at:
//
//   rev      → getMoneyToday() — THE shared money helper
//              (lib/billing/money-data.ts): settled payments since midnight
//              in America/Mexico_City, USD folded in at the manual FX rate.
//              Identical to the figure on Dinero, by construction.
//   users    → COUNT(DISTINCT user_id) in usage_events today
//   engines  → engines.status = 'active'; the strip renders it over the
//              catalogue total it is given
//
// The per-minute AI-call rate, the token total and the subscription count
// moved to (or stayed in) the activity rail, which is where the detail lives.

interface StripCache {
  at: number;
  data: StripValue[];
}
let stripCache: StripCache | null = null;
const STRIP_TTL_MS = 2000;

// Sparkline history per metric. Keys match StripValue['id'].
const stripHist: Record<string, number[]> = {
  rev: [],
  users: [],
  engines: [],
};

/**
 * Append a reading and return the history so far.
 *
 * It used to back-fill the array to 14 points with the current value on the
 * first tick, so a brand-new process drew a confident flat line under a
 * number nobody had measured twice. Now the history is only what was
 * actually observed, and the strip draws nothing until there are at least
 * two real points to draw.
 */
function pushHist(id: string, value: number): number[] {
  const arr = stripHist[id] ?? [];
  arr.push(value);
  while (arr.length > HIST_LEN) arr.shift();
  stripHist[id] = arr;
  return arr.slice();
}

// "Hoy" is Mexico City's today, not UTC's — see lib/billing/money.ts. Using
// UTC midnight here is what put a 7pm-local payment on tomorrow's tally and
// made the strip disagree with the P&L.
function startOfDayIso(): string {
  return zonedStartOfDay(new Date()).toISOString();
}

export async function tickStrip(): Promise<StripValue[]> {
  const now = Date.now();
  if (stripCache && now - stripCache.at < STRIP_TTL_MS) return stripCache.data;

  const admin = createAdminClient();
  const dayStart = startOfDayIso();

  const [enginesResult, moneyToday, usersTodayResult] = await Promise.all([
    admin.from('engines').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    // THE money helper — same window, same status filter and same exchange
    // rate as Dinero and the revenue sub-view. This tile used to run its own
    // query against a UTC day, which is how "Ingresos hoy $10" sat next to
    // "Lo que ganaste hoy $0" on the same screen.
    getMoneyToday(),
    admin.from('usage_events').select('user_id').gte('occurred_at', dayStart),
  ]);

  const engines = enginesResult.count ?? 0;
  const revenueToday = Math.round(moneyToday.totalMxnCents / 100);
  const uniqueUsersToday = new Set(
    (usersTodayResult.data ?? []).map((r) => r.user_id as string).filter(Boolean),
  ).size;

  const data: StripValue[] = [
    { id: 'rev', value: revenueToday, hist: pushHist('rev', revenueToday) },
    { id: 'users', value: uniqueUsersToday, hist: pushHist('users', uniqueUsersToday) },
    { id: 'engines', value: engines, hist: pushHist('engines', engines) },
  ];
  stripCache = { at: now, data };
  return data;
}

// ── Activity rail (sidebar — right column) ──────────────────────────────
//
// The rail is the DETAIL, the strip is the headline. It used to repeat
// "Ingresos hoy" and "Tokens hoy" from the strip verbatim, so the same two
// numbers appeared twice on one screen — and if the two queries ever
// disagreed, the operator got to choose which one to believe. The rail now
// carries only what the strip does not:
//
//   jobsPerHour           → COUNT(usage_events) in the last hour
//   activeSubscriptions   → COUNT(engine_subscriptions WHERE status='active')
//   tokensToday           → SUM(usage_events.amount) today, formatted "1.2M"

interface RailCache {
  at: number;
  data: {
    jobsPerHour: number;
    activeSubscriptions: number;
    tokensToday: string;
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

  const [jobsResult, subsResult, tokensResult] = await Promise.all([
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
  ]);

  const tokensSum = (tokensResult.data ?? []).reduce<number>(
    (sum, row) => sum + ((row.amount as number | null) ?? 0),
    0,
  );

  const data = {
    jobsPerHour: jobsResult.count ?? 0,
    activeSubscriptions: subsResult.count ?? 0,
    tokensToday: formatTokensCompact(tokensSum),
  };
  railCache = { at: now, data };
  return data;
}

// ── Activity feed ───────────────────────────────────────────────────────
//
// Reads the most recent audit_events + recent usage_events to surface real
// activity (tier changes, token grants, large LLM batches).
//
// It used to invent events when there was nothing to show — "Plataforma
// lista", "Esperando primera llamada", picked at random and timestamped
// `now` — so a platform with zero traffic still had a rail scrolling as if
// something were happening. An empty rail that says it is empty is the more
// useful screen. nextActivityEvent() returns null in that case and the SSE
// endpoint sends nothing.
//
// Cursor maintained per-process so subsequent SSE ticks return the NEXT
// real event rather than the same one. Wraps around when exhausted.

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
      // Was `row.kind` verbatim — "llm.tokens", "storage.mb". Raw event keys
      // are for the detail view, not for the default one.
      meta: labelForUsageKind(row.kind as string),
      time: at.slice(11, 16),
    });
  }

  // Sort merged by `time` desc (string compare is OK on HH:MM within today).
  events.sort((a, b) => b.time.localeCompare(a.time));
  recentEventsCache = events.slice(0, 20);
  recentEventsCacheAt = Date.now();
}

/** usage_events.kind → something a person reads. '' hides the chip rather
 *  than printing a key nobody outside this repo can parse. */
function labelForUsageKind(kind: string): string {
  switch (kind) {
    case 'llm.tokens':
      return 'consumo de IA';
    case 'storage.mb':
      return 'almacenamiento';
    case 'publish.count':
      return 'publicación';
    default:
      return '';
  }
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
    case 'team.invite':
      return 'Invitación al equipo enviada';
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

/** The next real event to show, or null when there is nothing. Null means
 *  the rail stays on its empty state — see the note above. */
export async function nextActivityEvent(): Promise<ActivityEvent | null> {
  if (Date.now() - recentEventsCacheAt > RECENT_TTL_MS) {
    try {
      await refreshRecentEvents();
    } catch {
      // Refresh failure — keep serving stale cache so the rail keeps moving.
    }
  }
  if (recentEventsCache.length === 0) return null;
  // Round-robin through the cached real events so each tick shows a
  // different one — feels alive even when nothing new came in.
  const next = recentEventsCache[recentEventsCursor % recentEventsCache.length]!;
  recentEventsCursor += 1;
  return next;
}
