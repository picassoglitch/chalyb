// One legal change notice to one person, claimed so two cron runs can't
// both send it, and recorded honestly (7a review of #49, HIGH 2):
//
//   claim     insert email_dispatches with delivery_status 'pending' (not the
//             column's 'sent' default). If the row exists, take it over only
//             through a conditional UPDATE when it is 'failed' or a 'pending'
//             older than 10 minutes (an interrupted run). Whoever gets a row
//             back sends; everyone else skips.
//   finish    'sent' only with the provider's message id; anything else is
//             'failed' and is retried on the next run. The evidence never
//             says sent without a provider id.

import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';

type SupabaseClient = ReturnType<typeof createAdminClient>;

export const STALE_PENDING_MS = 10 * 60_000;

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
  now = new Date(),
): Promise<string | null> {
  const { data, error } = await db
    .from('email_dispatches')
    .insert({
      user_id: row.userId,
      kind: row.kind,
      period_key: row.periodKey,
      template_id: row.templateId,
      template_version: row.templateVersion,
      delivery_status: 'pending',
      sent_at: now.toISOString(),
    })
    .select('id')
    .maybeSingle();
  if (!error) return (data?.id as string | undefined) ?? null;
  if (error.code !== '23505') throw new Error(error.message);
  const stale = new Date(now.getTime() - STALE_PENDING_MS).toISOString();
  const { data: retaken } = await db
    .from('email_dispatches')
    .update({ delivery_status: 'pending', sent_at: now.toISOString(), provider_message_id: null })
    .eq('user_id', row.userId)
    .eq('kind', row.kind)
    .eq('period_key', row.periodKey)
    .or(`delivery_status.eq.failed,and(delivery_status.eq.pending,sent_at.lt.${stale})`)
    .select('id')
    .maybeSingle();
  return (retaken?.id as string | undefined) ?? null;
}

export async function finishNoticeDispatch(
  db: SupabaseClient,
  id: string,
  res: { ok: boolean; id?: string | null },
): Promise<'sent' | 'failed'> {
  const status = dispatchStatusAfterSend(res);
  await db.from('email_dispatches').update(status).eq('id', id).eq('delivery_status', 'pending');
  return status.delivery_status;
}
