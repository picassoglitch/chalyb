// GET /api/tools/chalybobs/download?os=windows|mac — the En vivo program,
// from our own domain in the same tab (Content-Disposition: attachment;
// TOOLS-SPEC §0.1, §6.1).

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { getEnVivo, hubRunsTool } from '@/lib/tools/registry';
import { reportToolError } from '@/lib/tools/bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const ent = await getEntitlements(session);
  const adapter = hubRunsTool('chalybobs') ? getEnVivo() : null;
  if (ent.tools.chalybobs?.state !== 'included' || !adapter)
    return NextResponse.json({ ok: false, code: 'NOT_INCLUDED' }, { status: 403 });
  const os = new URL(req.url).searchParams.get('os') === 'mac' ? 'mac' : 'windows';
  const file = await adapter.download(os).catch(() => null);
  if (!file) {
    const error = await reportToolError('chalybobs', session.user.id, 'unavailable', true);
    return NextResponse.json({ ok: false, error }, { status: 503 });
  }
  if ('url' in file) return NextResponse.redirect(new URL(file.url, req.url), 302);
  return new NextResponse(file.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.filename.replace(/[^\w.-]/g, '_')}"`,
      'Cache-Control': 'no-store',
    },
  });
}
