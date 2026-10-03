// "Generar paquete de evidencia" (WS-8 · R-5): the dispute PDF for Mercado
// Pago. Admins only; the sha256 is stored and logged as
// chargeback_evidence_submitted. Never cached.

import { NextResponse } from 'next/server';
import { adminName, adminSession } from '@/lib/admin/guard';
import { buildEvidencePackage } from '@/lib/billing/disputes-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await adminSession();
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const pack = await buildEvidencePackage(id, adminName(actor));
  if (!pack) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return new NextResponse(Buffer.from(pack.pdf), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${pack.filename.replace(/[^\w.-]/g, '_')}"`,
      'cache-control': 'no-store',
      'x-evidence-sha256': pack.sha256,
    },
  });
}
