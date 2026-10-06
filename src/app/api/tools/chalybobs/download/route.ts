// GET /api/tools/chalybobs/download?os=windows|mac — the En vivo program,
// from our own domain in the same tab (Content-Disposition: attachment;
// TOOLS-SPEC §0.1, §6.1).

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { getEnVivo, hubRunsTool } from '@/lib/tools/registry';
import { runTool } from '@/lib/tools/bff';
import { statusForReason } from '@/lib/tools/bff-core';

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
  // Through the BFF: timeout, breaker and a support code like any tool call.
  const res = await runTool(
    'chalybobs',
    session.user.id,
    (signal) => adapter.download(os, signal),
    {
      idempotent: true,
    },
  );
  if (!res.ok)
    return NextResponse.json(
      { ok: false, error: res.error },
      { status: statusForReason(res.error.reason) },
    );
  const file = res.data;
  if (!file) return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 });
  if ('url' in file) return NextResponse.redirect(new URL(file.url, req.url), 302);
  return new NextResponse(file.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.filename.replace(/[^\w.-]/g, '_')}"`,
      'Cache-Control': 'no-store',
    },
  });
}
