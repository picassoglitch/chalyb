// Token balance + usage recording.
//
// Balance formula (Términos de los Paquetes §4.2–4.3):
//   remaining = max(0, monthly_allocation − monthlyUsed) + bonus − reserved
//
// Where:
//   monthly_allocation:  TIER_CAPS[effective_tier].tokensPerMonth
//   bonus:               unused credits in the user's active packs. Usage above
//                        the month's allocation is drawn from packs, oldest
//                        first, once, when the event is written (migration
//                        0061, token_pack_draws), so this already reflects it.
//   held:                unused credits of a disputed pack (§8.2): not spendable.
//   monthlyUsed:         sum of usage_events.billable_tokens this calendar
//                        month (UTC). Set per event when it is written
//                        (migration 0046): real provider cost plus the
//                        platform margin (app_settings.usage_margin_percent,
//                        default 50%), at 4 micros per token, never below 1.
//   reserved:            what open admitted jobs still hold (their estimate
//                        minus what they've reported) plus pending boost fees.
//
// Summed in Postgres by usage_balance(): the old JS sum read rows over
// PostgREST, which pages at 1000, so a busy user's usage was under-counted.
// Writes use the admin client (RLS blocks anon writes — engines hit the API
// endpoint which writes via service role).

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { TIER_CAPS, effectiveTier, isAdminRole } from '@/lib/billing/tiers';
import type { SubscriptionTier, UserRole } from '@/lib/auth/session';

export interface TokenBalance {
  /** Tokens still spendable this calendar month. Set to MAX_SAFE_INTEGER for
   *  admins — engines should check `unlimited` first instead of treating
   *  this as a real number. */
  remaining: number;
  /** True when the user is exempt from quotas (admin role). When true,
   *  engines MUST skip their out-of-tokens checks. We still track usage in
   *  usage_events for analytics, just don't enforce a ceiling. */
  unlimited: boolean;
  /** Monthly tier allocation (resets 1st of month). MAX_SAFE_INTEGER for admins. */
  monthlyAllocation: number;
  /** Unused credits in active packs (never reset, never expire). */
  bonus: number;
  /** Unused credits of disputed packs, set aside until the dispute ends. */
  held: number;
  /** Already-spent this calendar month. Tracked for everyone including admins. */
  monthlyUsed: number;
  /** Held by jobs that were admitted and haven't finished. */
  reserved: number;
  /** Snapshot of when this balance was computed (the calendar month bucket). */
  periodStart: string;
}

export interface BalanceSubject {
  role: UserRole;
  tier: SubscriptionTier;
  unlimited: boolean;
  monthlyAllocation: number;
}

/** Who the user is for quota purposes: role overrides tier, admins are
 *  unlimited. Shared by getTokenBalance and the admission route. */
export async function getBalanceSubject(userId: string): Promise<BalanceSubject | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, tier')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return null;
  const role = (profile.role as UserRole | undefined) ?? 'VIEWER';
  const tier = effectiveTier(role, (profile.tier as SubscriptionTier | undefined) ?? 'FREE');
  const unlimited = isAdminRole(role);
  return {
    role,
    tier,
    unlimited,
    monthlyAllocation: unlimited ? Number.MAX_SAFE_INTEGER : TIER_CAPS[tier].tokensPerMonth,
  };
}

/** Pure: the balance from the subject and usage_balance()'s sums. */
export function composeBalance(
  subject: Pick<BalanceSubject, 'unlimited' | 'monthlyAllocation'>,
  sums: { used: number; reserved: number; bonus: number; held?: number; periodStart: string },
): TokenBalance {
  // Admins are exempt from token quotas — they need to run things on behalf
  // of users for support, demos, and engine bring-up. We use MAX_SAFE_INTEGER
  // (not Infinity, which JSON.stringify turns into null) plus an `unlimited`
  // flag so engines can short-circuit their quota checks cleanly. Usage is
  // still tracked — admins shouldn't be invisible in usage_events.
  if (subject.unlimited) {
    return {
      remaining: Number.MAX_SAFE_INTEGER,
      unlimited: true,
      monthlyAllocation: Number.MAX_SAFE_INTEGER,
      bonus: sums.bonus,
      held: sums.held ?? 0,
      monthlyUsed: sums.used,
      reserved: sums.reserved,
      periodStart: sums.periodStart,
    };
  }
  // The plan's credits first; pack credits only once those are gone (usage
  // above the allocation has already come off `bonus`, so it isn't counted twice).
  return {
    remaining: Math.max(
      0,
      Math.max(0, subject.monthlyAllocation - sums.used) + sums.bonus - sums.reserved,
    ),
    unlimited: false,
    monthlyAllocation: subject.monthlyAllocation,
    bonus: sums.bonus,
    held: sums.held ?? 0,
    monthlyUsed: sums.used,
    reserved: sums.reserved,
    periodStart: sums.periodStart,
  };
}

export async function getTokenBalance(userId: string): Promise<TokenBalance> {
  const admin = createAdminClient();
  const [subject, { data, error }] = await Promise.all([
    getBalanceSubject(userId),
    admin.rpc('usage_balance', { p_user_id: userId }),
  ]);
  if (error) {
    // Fail closed: an unknown balance is not a full one.
    console.error('[usage] usage_balance failed', error.message);
    throw new Error(`usage_balance failed: ${error.message}`);
  }
  const r = (data ?? {}) as {
    used?: number;
    reserved?: number;
    bonus?: number;
    held?: number;
    period_start?: string;
  };
  return composeBalance(
    subject ?? { unlimited: false, monthlyAllocation: TIER_CAPS.FREE.tokensPerMonth },
    {
      used: Number(r.used ?? 0),
      reserved: Number(r.reserved ?? 0),
      bonus: Number(r.bonus ?? 0),
      held: Number(r.held ?? 0),
      periodStart: r.period_start ? new Date(r.period_start).toISOString() : '',
    },
  );
}

/** Has this user run out of plan + pack credits? */
export async function isOverQuota(userId: string): Promise<boolean> {
  const b = await getTokenBalance(userId);
  return b.remaining === 0;
}

export interface RecordedEvent {
  /** Engine slug calling in (e.g. 'chalybclip'). */
  engineSlug: string;
  /** Chalyb user id (ChalyClip stores this as tenant.external_user_id). */
  userId: string;
  /** Free-text kind discriminator. Common values: 'llm.tokens',
   *  'transcription.seconds', 'storage.mb', 'publish.count'. The platform
   *  does NOT whitelist values here — see migration 0020 for the rationale.
   *  Format is enforced at the API layer. */
  kind: string;
  /** Native unit count for `kind`: tokens, seconds, megabytes, etc. */
  amount: number;
  /** Engine's own id for the event — required for idempotent retries. */
  sourceId: string;
  /** Engine's clock for when it happened. Falls back to "now" if missing. */
  occurredAt?: string;
  /** Optional operation tag (e.g. 'variants_generate', 'transcribe'). The UI
   *  groups events with the same operation+date into a single "run" row. */
  operation?: string;
  /** Optional engine context bag — { stream_id, clip_id, est_tokens, … }.
   *  Read-side pulls specific keys for display. */
  metadata?: Record<string, unknown>;
  /** Optional: underlying provider that incurred the cost
   *  ('anthropic' | 'openai' | 'assemblyai' | ...). Stored for per-provider
   *  rollups; engines are free to add new values without a Chalyb deploy. */
  provider?: string;
  /** Real provider cost in USD micros (1e-6 USD). $0.111 → 111000. This is
   *  what the balance is charged (billable_tokens = ceil(cost / 4)). */
  costUsdMicros?: number;
  /** The admitted job this event belongs to (usage_reservations.id). */
  reservationId?: string;
}

/** Insert (or no-op if duplicate) a batch of usage events. The (engine_id,
 *  source_id) UNIQUE constraint makes retries safe. */
export async function recordUsageEvents(
  events: RecordedEvent[],
): Promise<{ inserted: number; skipped: number }> {
  if (events.length === 0) return { inserted: 0, skipped: 0 };
  const admin = createAdminClient();

  // Resolve engine slugs → engine_ids in one round-trip.
  const uniqueSlugs = Array.from(new Set(events.map((e) => e.engineSlug)));
  const { data: engineRows } = await admin
    .from('engines')
    .select('id, slug')
    .in('slug', uniqueSlugs);
  const slugToId = new Map<string, string>(
    (engineRows ?? []).map((r) => [r.slug as string, r.id as string]),
  );

  // A reservation_id only counts against the job it names when that job is
  // this user's on this engine; anything else is dropped rather than let it
  // shrink another job's hold.
  const reservationIds = Array.from(
    new Set(events.map((e) => e.reservationId).filter((id): id is string => !!id)),
  );
  const ownedReservations = new Set<string>();
  if (reservationIds.length > 0) {
    const { data: resRows } = await admin
      .from('usage_reservations')
      .select('id, user_id, engine_id')
      .in('id', reservationIds);
    for (const r of resRows ?? []) {
      ownedReservations.add(`${r.id}:${r.user_id}:${r.engine_id}`);
    }
  }

  // Build the insert rows. Drop events for unknown slugs (shouldn't happen,
  // but defensive against typos in the engine's outbound payload).
  const rows = events
    .map((e) => {
      const engineId = slugToId.get(e.engineSlug);
      if (!engineId) return null;
      return {
        user_id: e.userId,
        engine_id: engineId,
        kind: e.kind,
        amount: e.amount,
        source_id: e.sourceId,
        occurred_at: e.occurredAt ?? new Date().toISOString(),
        // Operation + metadata are optional from the engine side. When
        // present they drive the per-run grouping on /app/usage. Empty
        // metadata defaults to {} on the DB side (column default).
        operation: e.operation ?? null,
        metadata: e.metadata ?? null,
        // T4 contract: provider + real provider cost in USD micros.
        // Both nullable in the schema (migration 0020) so engines that
        // haven't migrated yet keep working.
        provider: e.provider ?? null,
        cost_usd_micros: e.costUsdMicros ?? null,
        reservation_id:
          e.reservationId && ownedReservations.has(`${e.reservationId}:${e.userId}:${engineId}`)
            ? e.reservationId
            : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return { inserted: 0, skipped: events.length };

  // Each event's share above the month's allocation is drawn from packs as it
  // is written (migration 0061), measured against the allocation on file.
  // Record it first; if we can't, don't write usage that would draw against a
  // stale or missing number — the engine retries.
  for (const userId of new Set(rows.map((r) => r.user_id))) {
    const subject = await getBalanceSubject(userId);
    if (!subject) continue;
    const { error: allocErr } = await admin.rpc('set_usage_allocation', {
      p_user_id: userId,
      p_allocation: subject.monthlyAllocation,
    });
    if (allocErr) {
      console.error('[usage] set_usage_allocation failed', allocErr.message);
      throw new Error(`usage allocation failed: ${allocErr.message}`);
    }
  }

  // upsert with ignoreDuplicates so the (engine_id, source_id) UNIQUE
  // catches retries without erroring out the whole batch.
  const { error, count } = await admin.from('usage_events').upsert(rows, {
    onConflict: 'engine_id,source_id',
    ignoreDuplicates: true,
    count: 'exact',
  });

  if (error) {
    console.error('[usage] insert failed', error.message);
    throw new Error(`usage insert failed: ${error.message}`);
  }
  const inserted = count ?? 0;
  return { inserted, skipped: rows.length - inserted };
}

/** Grant a pack: a new token_pack_purchases row with all its credits unused
 *  (profiles.token_bonus_balance mirrors active + held packs).
 *
 *  Both writes happen inside the grant_token_pack() SQL function (migration
 *  0033) so they land in one transaction: the previous version read the
 *  balance, added to it and wrote it back from JS, which loses a grant
 *  whenever two run at once — an MP retry arriving while the first delivery is
 *  still in flight is exactly that. Idempotent on mpPaymentId. */
export async function grantTokenPack(opts: {
  userId: string;
  tokens: number;
  source: 'mp_payment' | 'admin_grant' | 'promo';
  mpPaymentId?: string;
}): Promise<{ ok: boolean; alreadyGranted?: boolean }> {
  if (opts.tokens <= 0) return { ok: false };
  const admin = createAdminClient();

  const { data, error } = await admin.rpc('grant_token_pack', {
    p_user_id: opts.userId,
    p_tokens: opts.tokens,
    p_source: opts.source,
    p_mp_payment_id: opts.mpPaymentId ?? null,
  });

  if (error) {
    console.error('[usage] grant_token_pack failed', error.message);
    return { ok: false };
  }

  const result = (data ?? {}) as { ok?: boolean; already_granted?: boolean };
  return { ok: result.ok !== false, alreadyGranted: result.already_granted ?? false };
}

/** Remove the UNUSED credits of the pack a reversed payment bought (refund,
 *  or a dispute the buyer won): Paquetes §7.2, §8.3. Used credits and other
 *  packs are untouched (clawback_token_pack, migration 0061). Idempotent per
 *  mpPaymentId; refuses when no purchase is on file for that payment. */
export async function clawbackTokenPack(opts: {
  mpPaymentId: string;
  reason: 'refunded' | 'charged_back';
}): Promise<
  | { ok: true; alreadyClawedBack: true }
  | {
      ok: true;
      alreadyClawedBack: false;
      userId: string;
      tokensGranted: number;
      tokensRemoved: number;
      previousBalance: number;
      balance: number;
    }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('clawback_token_pack', {
    p_mp_payment_id: opts.mpPaymentId,
    p_reason: opts.reason,
  });
  if (error) {
    console.error('[usage] clawback_token_pack failed', error.message);
    return { ok: false, error: error.message };
  }
  const r = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    already_clawed_back?: boolean;
    user_id?: string;
    tokens_granted?: number;
    tokens_removed?: number;
    previous_balance?: number;
    balance?: number;
  };
  if (r.ok === false) return { ok: false, error: r.error ?? 'unknown' };
  if (r.already_clawed_back) return { ok: true, alreadyClawedBack: true };
  return {
    ok: true,
    alreadyClawedBack: false,
    userId: r.user_id ?? '',
    tokensGranted: Number(r.tokens_granted ?? 0),
    tokensRemoved: Number(r.tokens_removed ?? 0),
    previousBalance: Number(r.previous_balance ?? 0),
    balance: Number(r.balance ?? 0),
  };
}
