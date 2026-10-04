// POST /api/admin/legal — the owner panel's legal actions (Dueño → Legal).
// Admins only. One body shape: { kind: 'arco' | 'takedown', id, action, … }.
//   arco:     answer { outcome } · extend
//   takedown: lookup { targetEmail } → the uploader's jobs with their
//               normalized sources · preview { sourceUrl } → normalized ·
//             remove { targetEmail, sourceUrl } · reject { reason } ·
//             counter { text } · uphold (the claimant showed a proceeding)
//   block:    lift { fingerprint } (no id)

import { NextResponse } from 'next/server';
import { adminName, adminSession } from '@/lib/admin/guard';
import {
  answerArco,
  extendArco,
  liftBlock,
  lookupTakedownTarget,
  previewSource,
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
  // Blocks are keyed by their fingerprint (sha256 hex), not a uuid.
  if (b.kind === 'block' && b.action === 'lift') {
    const fp =
      typeof b.fingerprint === 'string' && /^[0-9a-f]{64}$/.test(b.fingerprint)
        ? b.fingerprint
        : null;
    if (!fp) return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
    const lifted = await liftBlock(fp, actor.user.id);
    return NextResponse.json({ ok: lifted }, { status: lifted ? 200 : 409 });
  }
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
    if (b.action === 'lookup') {
      const r = await lookupTakedownTarget(str('targetEmail'));
      ok = r.ok;
      extra = r.ok ? { jobs: r.jobs } : { code: r.code };
    } else if (b.action === 'preview') {
      const normalized = previewSource(str('sourceUrl'));
      ok = normalized !== null;
      extra = { normalized };
    } else if (b.action === 'remove') {
      const r = await removeTakedown(
        id,
        { targetEmail: str('targetEmail'), sourceUrl: str('sourceUrl') },
        { id: actor.user.id, name: adminName(actor) },
      );
      ok = r.ok;
      extra = r.ok
        ? { repeat: r.repeat, hidden: r.hidden, normalized: r.normalized }
        : { code: r.code };
    } else if (b.action === 'reject') {
      ok = str('reason').trim() ? await rejectTakedown(id, str('reason'), actor.user.id) : false;
      if (!ok) extra = { code: str('reason').trim() ? 'state' : 'reason' };
    } else if (b.action === 'counter') {
      ok = await recordCounterNotice(id, str('text'), actor.user.id);
    } else if (b.action === 'uphold') {
      ok = await upholdTakedown(id, actor.user.id);
    }
  }
  return NextResponse.json({ ok, ...extra }, { status: ok ? 200 : 409 });
}
