// POST /api/legal/takedown — copyright notice (Uso aceptable §5.1; art. 114
// Octies LFDA), from the public form at /derechos-de-autor. No sign-in: the
// claimant usually has no account. 422 lists the missing minimum fields;
// the optional ones never block the notice.

import { NextResponse } from 'next/server';
import { submitTakedown } from '@/lib/legal/legal-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (Number(req.headers.get('content-length') ?? 0) > 64_000) {
    return NextResponse.json({ ok: false, code: 'tooLong' }, { status: 413 });
  }
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // Honeypot: people never fill a field they can't see.
  if (typeof b.website === 'string' && b.website.trim())
    return NextResponse.json({ ok: true, id: null });
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  const result = await submitTakedown({
    claimantName: str('claimantName'),
    claimantContact: str('claimantContact'),
    contentIdentification: str('contentIdentification'),
    rightStatement: str('rightStatement'),
    contentLocation: str('contentLocation'),
    workDescription: str('workDescription'),
    ownershipEvidence: str('ownershipEvidence'),
    declaredTruthful: b.declaredTruthful === true,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : result.code === 'db' ? 502 : 422 });
}
