// Reading the `payments` ledger, for the two surfaces that show receipts:
// a subscriber's own history (/app/billing) and the operator's list
// (/dashboard/billing). Same columns, same fallback, same failure reporting,
// so the two can't describe the same charge differently.
//
// Row visibility is Postgres's job, not this module's: migration 0008 gives
// `authenticated` SELECT on their own rows and admins SELECT on all of them,
// and this reads through the user-scoped client so those policies apply.
// Passing `userId` narrows further; it does not grant anything.

import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type PaymentKind = 'plan' | 'subscription' | 'pack';

export interface PaymentLedgerRow {
  id: string;
  user_id: string;
  tier: 'FREE' | 'PRO' | 'PARTNER' | 'VIP';
  /** null on rows read before migration 0039 was applied — callers infer. */
  kind: PaymentKind | null;
  pack_id: string | null;
  tokens_granted: number | null;
  mp_payment_id: string;
  mp_preapproval_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface PaymentsResult {
  rows: PaymentLedgerRow[];
  /**
   * Why the list may be incomplete, or null when the read was clean.
   *
   * This exists because both pages used to destructure `{ data }` and throw
   * the error away: an RLS refusal or a missing column rendered as an empty
   * list under copy that promised the list was live. A read that failed and
   * a user with no payments are NOT the same thing, and the UI has to be
   * able to tell them apart.
   */
  failure: string | null;
}

const FULL_COLUMNS =
  'id, user_id, tier, kind, pack_id, tokens_granted, mp_payment_id, mp_preapproval_id, amount_cents, currency, status, created_at';
/** The shape before migration 0039. Selected as a fallback so an un-applied
 *  migration degrades to "rows without a product label" rather than a blank
 *  page that looks like "you never paid us". */
const LEGACY_COLUMNS =
  'id, user_id, tier, mp_payment_id, amount_cents, currency, status, created_at';

/** Fill in the columns migration 0039 added, for rows read from a database
 *  that does not have them yet. */
function withDefaults(row: Record<string, unknown>): PaymentLedgerRow {
  const r = row as unknown as PaymentLedgerRow;
  return {
    ...r,
    kind: r.kind ?? null,
    pack_id: r.pack_id ?? null,
    tokens_granted: r.tokens_granted ?? null,
    mp_preapproval_id: r.mp_preapproval_id ?? null,
  };
}

export async function loadPayments(opts: {
  /** Restrict to one user. Omit for the operator list. */
  userId?: string;
  limit?: number;
  /** Prefix for console logs, e.g. '/app/billing'. */
  logTag: string;
}): Promise<PaymentsResult> {
  const limit = opts.limit ?? 50;

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error(`[${opts.logTag}] createClient threw:`, err);
    return { rows: [], failure: 'No pudimos conectar con la base de datos.' };
  }

  const run = (columns: string) => {
    const q = supabase
      .from('payments')
      .select(columns)
      .order('created_at', { ascending: false })
      .limit(limit);
    return opts.userId ? q.eq('user_id', opts.userId) : q;
  };

  try {
    const first = await run(FULL_COLUMNS);
    if (!first.error) {
      return {
        rows: ((first.data ?? []) as unknown as Record<string, unknown>[]).map(withDefaults),
        failure: null,
      };
    }
    // 42703 = column does not exist → migration 0039 has not run here yet.
    console.warn(`[${opts.logTag}] full select failed, retrying legacy:`, first.error.message);
    const legacy = await run(LEGACY_COLUMNS);
    if (legacy.error) {
      console.error(`[${opts.logTag}] payments query failed:`, legacy.error.message);
      return { rows: [], failure: legacy.error.message };
    }
    return {
      rows: ((legacy.data ?? []) as unknown as Record<string, unknown>[]).map(withDefaults),
      failure: null,
    };
  } catch (err) {
    console.error(`[${opts.logTag}] payments query threw:`, err);
    return { rows: [], failure: 'La consulta de pagos falló.' };
  }
}

/** What a ledger row bought. `kind` is authoritative; the fallbacks keep rows
 *  written before migration 0039 readable. */
export function paymentKind(row: PaymentLedgerRow): PaymentKind {
  if (row.kind) return row.kind;
  if (row.mp_preapproval_id) return 'subscription';
  if (row.pack_id) return 'pack';
  return 'plan';
}
