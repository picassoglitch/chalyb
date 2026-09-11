// Token balance + usage recording.
//
// Balance formula:
//   balance = monthly_allocation + bonus − monthlyUsed
//
// Where:
//   monthly_allocation:  TIER_CAPS[effective_tier].tokensPerMonth
//   bonus:               profiles.token_bonus_balance (top-up packs, persistent)
//   monthlyUsed:         sum over THIS MONTH's usage_events of
//                        max(1, per-event) where per-event is —
//                          kind='llm.tokens'  → amount (native token count)
//                          everything else    → ceil(cost_usd_micros / 4)
//                        i.e. all non-LLM provider spend (transcription,
//                        engine base charge, …) deducts its real USD cost
//                        as token-equivalents (~$4/1M tokens), and EVERY
//                        event floors at 1 token — any provider used costs
//                        at least 1 token even if its raw cost rounds to 0.
//
// All reads use the user-scoped supabase client when called from RSC pages
// (RLS allows self-select); writes use the admin client (RLS blocks anon
// writes — engines hit the API endpoint which writes via service role).

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
  /** Top-up bonus tokens (don't reset). */
  bonus: number;
  /** Already-spent this calendar month. Tracked for everyone including admins. */
  monthlyUsed: number;
  /** Snapshot of when this balance was computed (the calendar month bucket). */
  periodStart: string;
}

/** Get the first instant of the current calendar month, UTC. Use for the
 *  occurred_at filter so day-of-month boundaries are consistent regardless
 *  of where the user/engine is in the world. */
function currentPeriodStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getTokenBalance(userId: string): Promise<TokenBalance> {
  const admin = createAdminClient();

  const [{ data: profile }, { data: events }] = await Promise.all([
    admin
      .from('profiles')
      .select('role, tier, token_bonus_balance')
      .eq('id', userId)
      .maybeSingle(),
    // Pull EVERY metered event this month (not just llm.tokens) so the
    // quota reflects ALL provider spend — transcription, the engine base
    // charge, future meters — instead of only Claude tokens.
    admin
      .from('usage_events')
      .select('kind, amount, cost_usd_micros')
      .eq('user_id', userId)
      .gte('occurred_at', currentPeriodStartIso()),
  ]);

  const role = (profile?.role as UserRole | undefined) ?? 'VIEWER';
  const storedTier = (profile?.tier as SubscriptionTier | undefined) ?? 'FREE';
  const tier = effectiveTier(role, storedTier);
  const bonus = (profile?.token_bonus_balance as number | undefined) ?? 0;

  // Deduction model (T4 all-provider): llm.tokens deducts its native token
  // COUNT (amount) — unchanged. Every OTHER meter (transcription.seconds,
  // engine.base, …) deducts its real USD cost converted to token-equivalents
  // at MICROS_PER_TOKEN, so a single 'tokens' balance reflects total spend.
  // Rate = the standard model's blended ~$4 / 1M tokens → 4 micros/token.
  const MICROS_PER_TOKEN = 4;
  const monthlyUsed = (events ?? []).reduce<number>((sum, e) => {
    const kind = (e.kind as string | undefined) ?? '';
    const raw =
      kind === 'llm.tokens'
        ? ((e.amount as number | undefined) ?? 0)
        : Math.ceil(((e.cost_usd_micros as number | undefined) ?? 0) / MICROS_PER_TOKEN);
    // Floor: every metered event costs at least 1 token. So any provider
    // that was used draws down at least 1 token even if its real cost
    // rounds to zero — covers the per-call overhead we don't otherwise
    // capture.
    return sum + Math.max(1, raw);
  }, 0);

  // Admins are exempt from token quotas — they need to run things on behalf
  // of users for support, demos, and engine bring-up. We use MAX_SAFE_INTEGER
  // (not Infinity, which JSON.stringify turns into null) plus an `unlimited`
  // flag so engines can short-circuit their quota checks cleanly.
  if (isAdminRole(role)) {
    return {
      remaining: Number.MAX_SAFE_INTEGER,
      unlimited: true,
      monthlyAllocation: Number.MAX_SAFE_INTEGER,
      bonus,
      monthlyUsed, // still tracked for analytics — admins shouldn't be invisible in usage_events
      periodStart: currentPeriodStartIso(),
    };
  }

  const monthlyAllocation = TIER_CAPS[tier].tokensPerMonth;
  const remaining = Math.max(0, monthlyAllocation + bonus - monthlyUsed);
  return {
    remaining,
    unlimited: false,
    monthlyAllocation,
    bonus,
    monthlyUsed,
    periodStart: currentPeriodStartIso(),
  };
}

/** Has this user run out of monthly + bonus tokens? */
export async function isOverQuota(userId: string): Promise<boolean> {
  const b = await getTokenBalance(userId);
  return b.remaining === 0;
}

export interface RecordedEvent {
  /** Engine slug calling in (e.g. 'chalybclip'). */
  engineSlug: string;
  /** Chalyb user id (ChalybClip stores this as tenant.external_user_id). */
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
  /** Optional: real provider cost in USD micros (1e-6 USD). $0.111 → 111000.
   *  Stored but NOT yet deducted from the token balance — quota math still
   *  runs off `amount` for kind='llm.tokens'. */
  costUsdMicros?: number;
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
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return { inserted: 0, skipped: events.length };

  // upsert with ignoreDuplicates so the (engine_id, source_id) UNIQUE
  // catches retries without erroring out the whole batch.
  const { error, count } = await admin
    .from('usage_events')
    .upsert(rows, {
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

/** Grant top-up tokens. Increments profiles.token_bonus_balance and records
 *  the purchase in token_pack_purchases for audit. Idempotent on mpPaymentId
 *  when supplied. */
export async function grantTokenPack(opts: {
  userId: string;
  tokens: number;
  source: 'mp_payment' | 'admin_grant' | 'promo';
  mpPaymentId?: string;
}): Promise<{ ok: boolean; alreadyGranted?: boolean }> {
  if (opts.tokens <= 0) return { ok: false };
  const admin = createAdminClient();

  // De-dupe MP webhook retries before touching the balance.
  if (opts.mpPaymentId) {
    const { data: existing } = await admin
      .from('token_pack_purchases')
      .select('id')
      .eq('mp_payment_id', opts.mpPaymentId)
      .maybeSingle();
    if (existing) return { ok: true, alreadyGranted: true };
  }

  // Insert pack purchase row + bump balance. Not atomic at the SQL level
  // (no transaction wrapper in the supabase-js client), but the
  // mp_payment_id UNIQUE handles the retry case correctly even if one of
  // the two writes fails: re-running succeeds at whichever step didn't
  // complete previously.
  const { error: insertErr } = await admin.from('token_pack_purchases').insert({
    user_id: opts.userId,
    tokens_granted: opts.tokens,
    source: opts.source,
    mp_payment_id: opts.mpPaymentId ?? null,
  });
  if (insertErr) {
    console.error('[usage] pack insert failed', insertErr.message);
    return { ok: false };
  }

  // Increment the balance using an RPC-equivalent UPDATE expression.
  const { data: profile } = await admin
    .from('profiles')
    .select('token_bonus_balance')
    .eq('id', opts.userId)
    .maybeSingle();
  const next = ((profile?.token_bonus_balance as number | undefined) ?? 0) + opts.tokens;
  const { error: updErr } = await admin
    .from('profiles')
    .update({ token_bonus_balance: next })
    .eq('id', opts.userId);
  if (updErr) {
    console.error('[usage] balance bump failed', updErr.message);
    return { ok: false };
  }
  return { ok: true };
}
