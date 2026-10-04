// POST /api/legal/arco — "Mis datos (derechos ARCO)" (Aviso de privacidad
// §5.2) from Mi cuenta. Signed-in only: the account's email is the identity
// (§5.2.1–2). Stores the request with its legal deadline, logs
// arco_request_received and tells the privacy contact.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { submitArco } from '@/lib/legal/legal-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  const result = await submitArco(
    session,
    {
      right: str('right'),
      description: str('description'),
      dataLocation: str('dataLocation'),
      correctValue: str('correctValue'),
    },
    b.locale === 'en' ? 'en' : 'es',
  );
  return NextResponse.json(result, { status: result.ok ? 200 : result.code === 'db' ? 502 : 422 });
}
