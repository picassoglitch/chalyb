// The one query behind every "dinero hoy" on the admin side.
//
// Everything that shows what came in today — the top metric strip, the AI
// rail, /dashboard/revenue, the P&L on /dashboard/billing — reads through
// here. Same window, same status filter, same exchange rate, so the numbers
// on two cards of the same screen cannot disagree any more.
//
// Reads with the service-role client because the strip runs from the SSE
// endpoint where there is no user-scoped session to read `payments` with.
// The pages above it are already behind the admin role gate in
// (dashboard)/dashboard/layout.tsx.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  EMPTY_MONEY,
  PLATFORM_TIMEZONE,
  SETTLED_PAYMENT_STATUSES,
  summariseMoney,
  zonedDayKey,
  zonedStartOfDay,
  zonedStartOfMonth,
  type MoneyRow,
  type MoneySummary,
} from './money';

export interface MoneyWindow extends MoneySummary {
  /** Inclusive start of the window, as an ISO instant. */
  fromIso: string;
  /** The timezone the window was cut on — surfaces quote it so the operator
   *  knows whose midnight this is. */
  timezone: string;
  /** The local day this window starts on, e.g. "2026-09-18". */
  dayKey: string;
  /** True when the query itself failed. The figures are then zero AND
   *  meaningless: render "sin datos", never "$0". */
  failed: boolean;
}

function emptyWindow(from: Date, failed: boolean): MoneyWindow {
  return {
    ...EMPTY_MONEY,
    fromIso: from.toISOString(),
    timezone: PLATFORM_TIMEZONE,
    dayKey: zonedDayKey(from),
    failed,
  };
}

async function loadSince(from: Date): Promise<MoneyWindow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('payments')
    .select('amount_cents, currency, status')
    .in('status', SETTLED_PAYMENT_STATUSES as unknown as string[])
    .gte('created_at', from.toISOString());

  if (error) {
    console.error('[money] payments query failed', error.message);
    return emptyWindow(from, true);
  }

  return {
    ...summariseMoney((data ?? []) as MoneyRow[]),
    fromIso: from.toISOString(),
    timezone: PLATFORM_TIMEZONE,
    dayKey: zonedDayKey(from),
    failed: false,
  };
}

/** Money that landed since midnight in PLATFORM_TIMEZONE. */
export async function getMoneyToday(now: Date = new Date()): Promise<MoneyWindow> {
  return loadSince(zonedStartOfDay(now));
}

/** Money that landed since the 1st, in PLATFORM_TIMEZONE. */
export async function getMoneyThisMonth(now: Date = new Date()): Promise<MoneyWindow> {
  return loadSince(zonedStartOfMonth(now));
}

export interface PayingCustomers {
  /** Distinct users on a paid plan this month (one-off or recurring). */
  planUserIds: string[];
  pro: number;
  vip: number;
  /** Distinct users who bought tokens this month. A pack buyer is a paying
   *  customer too — the old query dropped them because it read `tier`, which
   *  for a pack row is the buyer's CURRENT tier (often FREE). */
  packUserIds: string[];
  failed: boolean;
}

const EMPTY_CUSTOMERS: PayingCustomers = {
  planUserIds: [],
  pro: 0,
  vip: 0,
  packUserIds: [],
  failed: false,
};

/** Who paid us this month, split by what they bought. */
export async function getPayingCustomersThisMonth(
  now: Date = new Date(),
): Promise<PayingCustomers> {
  const from = zonedStartOfMonth(now);
  const admin = createAdminClient();

  // `kind` arrived in migration 0039. Fall back to the pre-0039 shape rather
  // than reporting zero customers on a database that has not been migrated.
  let rows: Array<{ user_id: string; tier: string; kind?: string | null }> = [];
  const full = await admin
    .from('payments')
    .select('user_id, tier, kind')
    .in('status', SETTLED_PAYMENT_STATUSES as unknown as string[])
    .gte('created_at', from.toISOString());
  if (full.error) {
    console.warn(
      '[money] paying-customers full select failed, retrying legacy:',
      full.error.message,
    );
    const legacy = await admin
      .from('payments')
      .select('user_id, tier')
      .in('status', SETTLED_PAYMENT_STATUSES as unknown as string[])
      .gte('created_at', from.toISOString());
    if (legacy.error) {
      console.error('[money] paying-customers query failed', legacy.error.message);
      return { ...EMPTY_CUSTOMERS, failed: true };
    }
    rows = (legacy.data ?? []) as typeof rows;
  } else {
    rows = (full.data ?? []) as typeof rows;
  }

  const planTier = new Map<string, 'PRO' | 'VIP'>();
  const packUsers = new Set<string>();
  for (const row of rows) {
    const kind = row.kind ?? 'plan';
    if (kind === 'pack') {
      packUsers.add(row.user_id);
      continue;
    }
    if (row.tier === 'PRO' || row.tier === 'VIP') planTier.set(row.user_id, row.tier);
  }

  const tiers = Array.from(planTier.values());
  return {
    planUserIds: Array.from(planTier.keys()),
    pro: tiers.filter((t) => t === 'PRO').length,
    vip: tiers.filter((t) => t === 'VIP').length,
    packUserIds: Array.from(packUsers),
    failed: false,
  };
}
