// POST /api/admin/legal — the owner panel's legal actions (Dueño → Legal).
// Admins only. One body shape: { kind: 'arco' | 'takedown', id, action, … }.
//   arco:     answer { outcome } · extend
//   takedown: remove { targetEmail } · reject { reason } · counter { text } ·
//             uphold (the claimant showed a proceeding in time)

import { NextResponse } from 'next/server';
import { adminName, adminSession } from '@/lib/admin/guard';
import {
  answerArco,
  extendArco,
  recordCounterNotice,
  rejectTakedown,
  removeTakedown,
  upholdTakedown,
} from '@/lib/legal/legal-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OUTCOMES = ['granted', 'partially_granted', 'denied', 'incomplete'] as const;

export async function POST(req: Request) {
  const actor = await adminSession();
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.id === 'string' && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : null;
  if (!id) return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  let ok = false;
  let extra: Record<string, unknown> = {};
  if (b.kind === 'arco') {
    if (b.action === 'answer' && (OUTCOMES as readonly string[]).includes(str('outcome'))) {
      ok = await answerArco(id, str('outcome') as (typeof OUTCOMES)[number], actor.user.id);
    } else if (b.action === 'extend') {
      ok = await extendArco(id, actor.user.id);
    }
  } else if (b.kind === 'takedown') {
    if (b.action === 'remove') {
      const r = await removeTakedown(id, str('targetEmail'), {
        id: actor.user.id,
        name: adminName(actor),
      });
      ok = r.ok;
      extra = r.ok ? { repeat: r.repeat } : { code: r.code };
    } else if (b.action === 'reject') {
      ok = await rejectTakedown(id, str('reason'), actor.user.id);
    } else if (b.action === 'counter') {
      ok = await recordCounterNotice(id, str('text'), actor.user.id);
    } else if (b.action === 'uphold') {
      ok = await upholdTakedown(id, actor.user.id);
    }
  }
  return NextResponse.json({ ok, ...extra }, { status: ok ? 200 : 409 });
}
