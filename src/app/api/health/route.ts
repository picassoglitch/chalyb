import { NextResponse } from 'next/server';
import { getPublicFleet } from '@/lib/data/public-engines';

// GET /api/health — what the public footer's "Estado" link opens.
//
// Reports the hub itself plus the kit's real readiness (how many engines can
// actually be opened today), read through the same test the app uses. This is
// the number every marketing claim must agree with: if it says 0 ready, no
// public page may say an engine is live.

export const dynamic = 'force-dynamic';

export async function GET() {
  const fleet = await getPublicFleet();
  return NextResponse.json(
    {
      status: 'ok',
      service: 'chalyb',
      checkedAt: new Date().toISOString(),
      kit: {
        catalogReachable: fleet.fromCatalog,
        ready: fleet.ready,
        upcoming: fleet.upcoming,
        engines: fleet.engines.map((e) => ({ slug: e.slug, name: e.name, ready: e.ready })),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
