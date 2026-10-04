// GET /api/cron/legal — daily (vercel.json "crons"). Requires
// `Authorization: Bearer ${CRON_SECRET}`; 401 otherwise, like
// /api/cron/billing. Every step is idempotent:
//   1. the ≥30-day email before a relevant change to the Términos,
//      Suscripción or Aviso de privacidad (aceptacion-ux §8), once per user,
//      document and version (email_dispatches' unique key);
//   2. restores content whose counter-notice deadline passed with no
//      proceeding from the claimant (Uso aceptable §5.3);
//   3. purges non-compliance marks older than 72 months (Aviso §9.1).

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  runCounterNoticeRestores,
  runRetention,
  runTermsChangeNotices,
  type LegalCronReport,
} from '@/lib/legal/legal-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const now = new Date();
  const report: LegalCronReport = {
    termsChange: await runTermsChangeNotices(now).catch((e: Error) => {
      console.error('[cron/legal] terms change failed', e.message);
      return [
        { doc: '', decision: 'error', version: '', sent: 0, skipped: 0, failed: 0, late: false },
      ];
    }),
    counterNotices: await runCounterNoticeRestores(now).catch((e: Error) => {
      console.error('[cron/legal] counter-notice restores failed', e.message);
      return { restored: 0 };
    }),
    retention: await runRetention(now),
  };
  return NextResponse.json({ ok: true, ...report });
}
