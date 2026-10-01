'use server';

// En vivo controls (SCR-22). Each one re-checks access on the server.

import { getLocale } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { addUserNotice, noticeText } from '@/lib/notifications/user';
import { getEnVivo, hubRunsTool } from './registry';
import type { LiveStatus } from './adapters/tools';

type Action = { kind: 'start' } | { kind: 'stop' } | { kind: 'scene'; id: string } | { kind: 'toggle'; what: 'mic' | 'cam' | 'clipsAfter' };

export async function liveAction(action: Action): Promise<LiveStatus | null> {
  const session = await getSessionUser();
  if (!session) return null;
  const ent = await getEntitlements(session);
  const adapter = hubRunsTool('chalybobs') ? getEnVivo() : null;
  if (ent.tools.chalybobs?.state !== 'included' || !adapter) return null;
  const u = session.user.id;
  if (action.kind === 'start') return adapter.start(u);
  if (action.kind === 'scene') return adapter.setScene(u, action.id);
  if (action.kind === 'toggle') return adapter.toggle(u, action.what);
  const before = await adapter.status(u);
  const after = await adapter.stop(u);
  if (before.liveSince) {
    const mins = Math.max(1, Math.round((Date.now() - Date.parse(before.liveSince)) / 60_000));
    await addUserNotice({
      userId: u,
      kind: 'liveEnded',
      ...(await noticeText('liveEnded', { duracion: `${mins} min` }, await getLocale())),
      href: '/app/clips',
      dedupeKey: `live:${before.liveSince}`,
    });
  }
  return after;
}
