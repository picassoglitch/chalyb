// POST /api/tools/chalito/sso — the hub→Chalito launch token for the signed-in
// person, for Chalito's screens inside the app (/app/chalito). Same gates as a
// launch (/auth/launch/chalito: access, provisioning, audit), but the token is
// handed to this page instead of redirecting to another site; the browser
// exchanges it at the Chalito api (/sso/exchange) for its own device session.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEngineLaunchUrl } from '@/lib/engines/launch-actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'cache-control': 'no-store' };

export async function POST() {
  const session = await getSessionUser();
  if (!session)
    return NextResponse.json(
      { ok: false, code: 'SESSION_EXPIRED' },
      { status: 401, headers: noStore },
    );

  const { data: engine } = await createAdminClient()
    .from('engines')
    .select('id')
    .eq('slug', 'chalito')
    .maybeSingle();
  if (!engine)
    return NextResponse.json({ ok: false, code: 'UNAVAILABLE' }, { status: 503, headers: noStore });

  const launch = await getEngineLaunchUrl(engine.id as string);
  if (!launch.ok)
    return NextResponse.json({ ok: false, code: launch.code }, { status: 403, headers: noStore });

  const token = new URL(launch.url).searchParams.get('token');
  if (!token)
    return NextResponse.json({ ok: false, code: 'UNAVAILABLE' }, { status: 503, headers: noStore });
  return NextResponse.json({ ok: true, token }, { headers: noStore });
}
