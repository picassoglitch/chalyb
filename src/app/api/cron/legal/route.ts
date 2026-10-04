// GET /api/cron/legal — daily (vercel.json "crons"). Requires
// `Authorization: Bearer ${CRON_SECRET}`; 401 otherwise, like
// /api/cron/billing. Every step is idempotent:
//   1. restores content whose counter-notice deadline passed with no
//      proceeding from the claimant (Uso aceptable §5.3);
//   2. purges non-compliance marks 72 months after the incident (Aviso
//      §9.1); `?dry=1` only counts; then resends ARCO answers whose email
//      failed (gives up after 5 tries / 72 h);
//   3. the ≥30-day email before a relevant change to the Términos,
//      Suscripción or Aviso de privacidad (aceptacion-ux §8): a capped,
//      throttled batch that stops before maxDuration; one document failing
//      doesn't stop the others.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  NOTICE_BATCH,
  runArcoAnswerRetries,
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
  const dryRun = new URL(req.url).searchParams.get('dry') === '1';
  // Cheap, bounded steps first, so a long notice batch can never starve
  // them (7a review of #49, MEDIUM 9). Then the notices, capped and
  // stopping well before maxDuration; what's left goes out tomorrow.
  const counterNotices = await runCounterNoticeRestores(now).catch((e: Error) => {
    console.error('[cron/legal] counter-notice restores failed', e.message);
    return { restored: 0 };
  });
  const retention = await runRetention(now, dryRun).catch((e: Error) => {
    console.error('[cron/legal] retention failed', e.message);
    return null;
  });
  const arcoAnswers = await runArcoAnswerRetries().catch((e: Error) => {
    console.error('[cron/legal] ARCO answer retries failed', e.message);
    return { resent: 0, failed: 0 };
  });
  const termsChange = await runTermsChangeNotices(now, {
    deadline: Date.now() + (maxDuration - 60) * 1000,
    maxSends: NOTICE_BATCH,
  });
  const report: LegalCronReport = { termsChange, counterNotices, arcoAnswers, retention };
  return NextResponse.json({ ok: true, ...report });
}
