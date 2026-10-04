// One legal change notice to one person, claimed so two cron runs can't
// both send it, and recorded honestly (7a review of #49, HIGH 2):
//
//   claim     claim_notice_dispatch() (migration 0060), one statement:
//             insert 'pending' (not the column's 'sent' default); or retake a
//             'failed' or > 10-minute 'pending' row (attempts + 1); or, after
//             5 attempts or 72 hours, mark it 'undeliverable' and skip.
//             Whoever gets an id back sends; everyone else skips.
//   finish    'sent' only with the provider's message id; anything else is
//             'failed' and is retried on the next run. The evidence never
//             says sent without a provider id.

import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';

type SupabaseClient = ReturnType<typeof createAdminClient>;

export const STALE_PENDING_MS = 10 * 60_000;
/** After this many attempts, or this long since the first, a notice is
 *  'undeliverable': it stops holding the version back, and the person is
 *  never asked to accept it (they stay on the terms they have). */
export const MAX_ATTEMPTS = 5;
export const GIVE_UP_HOURS = 72;

/** What a send result becomes in email_dispatches. */
export function dispatchStatusAfterSend(res: { ok: boolean; id?: string | null }): {
  delivery_status: 'sent' | 'failed';
  provider_message_id: string | null;
} {
  return res.ok && res.id
    ? { delivery_status: 'sent', provider_message_id: res.id }
    : { delivery_status: 'failed', provider_message_id: null };
}

export async function claimNoticeDispatch(
  db: SupabaseClient,
  row: {
    userId: string;
    kind: string;
    periodKey: string;
    templateId: string;
    templateVersion: string;
  },
): Promise<string | null> {
  // One statement (claim_notice_dispatch, migration 0060): insert pending,
  // or retake a failed / stale-pending row, or give it up as
  // 'undeliverable' after MAX_ATTEMPTS or GIVE_UP_HOURS.
  const { data, error } = await db.rpc('claim_notice_dispatch', {
    p_user: row.userId,
    p_kind: row.kind,
    p_period: row.periodKey,
    p_template: row.templateId,
    p_version: row.templateVersion,
    p_max_attempts: MAX_ATTEMPTS,
    p_give_up: `${GIVE_UP_HOURS} hours`,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** A failed send counts against the person only when the provider took
 *  the request and refused the address (a 4xx other than 429). */
export function countsAsAttempt(res: { ok: boolean; transient?: boolean }): boolean {
  return res.ok || !res.transient;
}

export async function finishNoticeDispatch(
  db: SupabaseClient,
  id: string,
  res: { ok: boolean; id?: string | null; transient?: boolean },
): Promise<'sent' | 'failed'> {
  if (!countsAsAttempt(res)) {
    // Provider outage or misconfiguration: give the attempt back so it can
    // never make everyone 'undeliverable' (release_notice_attempt, 0060).
    await db.rpc('release_notice_attempt', { p_id: id });
    return 'failed';
  }
  const status = dispatchStatusAfterSend(res);
  await db.from('email_dispatches').update(status).eq('id', id).eq('delivery_status', 'pending');
  return status.delivery_status;
}
