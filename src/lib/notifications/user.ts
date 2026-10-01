// Customer notices (Avisos, SCR-26) — public.user_notifications. One row per
// event; `dedupeKey` keeps a producer from writing the same notice twice.
// Billing notices carry keep_until (their charge date): they can't be
// deleted before it.

import 'server-only';
import { getTranslations } from 'next-intl/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type UserNoticeKind = 'clipsReady' | 'trial7' | 'renew' | 'pastDue' | 'liveEnded' | 'signal';

export async function addUserNotice(input: {
  userId: string;
  kind: UserNoticeKind;
  title: string;
  body?: string;
  href?: string;
  dedupeKey: string;
  keepUntil?: string | null;
}): Promise<void> {
  const { error } = await createAdminClient()
    .from('user_notifications')
    .upsert(
      {
        user_id: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        dedupe_key: input.dedupeKey,
        keep_until: input.keepUntil ?? null,
      },
      { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
    );
  if (error) console.error('[notices] could not add', input.kind, error.message);
}

export async function unreadCount(userId: string): Promise<number> {
  const { count } = await createAdminClient()
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  return count ?? 0;
}

/** Title and body from messages (notif.<kind>), for producers that run
 *  outside a request (cron, webhooks): Spanish, like the billing emails. */
export async function noticeText(
  kind: Exclude<UserNoticeKind, 'signal'>,
  vars: Record<string, string | number> = {},
  locale = 'es',
): Promise<{ title: string; body: string }> {
  const t = await getTranslations({ locale, namespace: `notif.${kind}` });
  return { title: t('title'), body: t('body', vars) };
}
