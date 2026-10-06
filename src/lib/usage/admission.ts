// Admission and settlement for engine jobs (server side).
// Contract: docs/engines/consumption-contract.md. Rules: ./admission-core.ts.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { TIER_CAPS } from '@/lib/billing/tiers';
import { usageMarginPercent } from '@/lib/config/settings';
import {
  checkItemCaps,
  publicLimits,
  reserveWithMargin,
  resolveLane,
  sqlCaps,
  type AdmitRequest,
  type Lane,
  type RefusalReason,
} from './admission-core';
import { getBalanceSubject, getTokenBalance, type TokenBalance } from './tokens';

export type AdmitResult =
  | { status: 404; error: string }
  | {
      status: 200;
      allowed: true;
      reservationId: string;
      lane: Lane;
      boostFeeTokens: number;
      limits: ReturnType<typeof publicLimits>;
      balance: TokenBalance;
    }
  | {
      status: 200;
      allowed: false;
      reason: RefusalReason;
      detail?: Record<string, unknown>;
      limits: ReturnType<typeof publicLimits>;
    };

async function engineIdFor(slug: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('engines').select('id').eq('slug', slug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function admitUsage(
  slug: string,
  userId: string,
  req: AdmitRequest,
): Promise<AdmitResult> {
  const [subject, engineId] = await Promise.all([getBalanceSubject(userId), engineIdFor(slug)]);
  if (!subject) return { status: 404, error: 'unknown user_id' };
  if (!engineId) return { status: 404, error: `engine not registered: ${slug}` };

  const caps = TIER_CAPS[subject.tier];
  const limits = publicLimits(caps);

  const itemRefusal = checkItemCaps(req, caps, subject.unlimited);
  if (itemRefusal) return { status: 200, allowed: false, reason: itemRefusal, limits };

  const { lane, feeTokens } = resolveLane(req, caps, subject.unlimited);
  const estTokens = reserveWithMargin(req.estTokens, await usageMarginPercent(), req.operation);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('admit_usage', {
    p_user_id: userId,
    p_engine_id: engineId,
    p_external_job_id: req.externalJobId,
    p_class: req.class,
    p_operation: req.operation,
    p_lane: lane,
    p_est_tokens: estTokens,
    p_fee_tokens: feeTokens,
    p_source_minutes: req.sourceMinutes,
    p_upload_mb: req.uploadMb,
    p_ttl_seconds: req.ttlSeconds,
    p_caps: sqlCaps(caps, subject.monthlyAllocation, subject.unlimited),
  });
  if (error) {
    // Thrown, so the route answers 5xx and the engine refuses the job:
    // an admission we couldn't check is not an admission.
    throw new Error(`admit_usage failed: ${error.message}`);
  }

  const r = (data ?? {}) as Record<string, unknown>;
  if (r.allowed !== true) {
    const { reason, ...rest } = r;
    const detail = Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'allowed'));
    return {
      status: 200,
      allowed: false,
      reason: (reason as RefusalReason | undefined) ?? 'no_tokens',
      detail,
      limits,
    };
  }

  return {
    status: 200,
    allowed: true,
    reservationId: r.reservation_id as string,
    lane,
    boostFeeTokens: feeTokens,
    limits,
    balance: await getTokenBalance(userId),
  };
}

export type SettleOutcome = 'succeeded' | 'failed' | 'cancelled' | 'heartbeat';

export async function settleUsage(
  slug: string,
  reservationId: string,
  outcome: SettleOutcome,
): Promise<{ ok: boolean; status?: string; error?: string; already?: boolean }> {
  const engineId = await engineIdFor(slug);
  if (!engineId) return { ok: false, error: `engine not registered: ${slug}` };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('settle_usage_reservation', {
    p_reservation_id: reservationId,
    p_engine_id: engineId,
    p_outcome: outcome,
  });
  if (error) throw new Error(`settle_usage_reservation failed: ${error.message}`);
  return (data ?? { ok: false }) as {
    ok: boolean;
    status?: string;
    error?: string;
    already?: boolean;
  };
}
