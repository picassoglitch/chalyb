// POST /api/tools/chalybobs/stream-key — "Mostrar" the stream key (§6.3,
// §6.4). The key never reaches the browser before this call, and this call
// needs the person to prove it's them: their password again, or a sign-in in
// the last 5 minutes (for people who sign in with a link or Google). The key
// is never logged and the response is never cached.

import { NextResponse } from 'next/server';
import { asJsonObject } from '@/lib/tools/bff-core';
import { createClient } from '@supabase/supabase-js';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { getEnVivo, hubRunsTool } from '@/lib/tools/registry';
import { runTool } from '@/lib/tools/bff';
import { statusForReason } from '@/lib/tools/bff-core';
import { LIVE_PLATFORMS, type LivePlatform } from '@/lib/tools/adapters/tools';
import { recentSignIn } from '@/lib/tools/envivo-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

async function passwordMatches(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || !password) return false;
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const ent = await getEntitlements(session);
  const adapter = hubRunsTool('chalybobs') ? getEnVivo() : null;
  if (ent.tools.chalybobs?.state !== 'included' || !adapter)
    return NextResponse.json({ ok: false, code: 'NOT_INCLUDED' }, { status: 403 });
  const body = asJsonObject(await req.json().catch(() => null)) as {
    platform?: string;
    password?: string;
  };
  const platform = String(body.platform ?? '') as LivePlatform;
  if (!LIVE_PLATFORMS.includes(platform))
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  const proven =
    recentSignIn(session.user.last_sign_in_at, Date.now()) ||
    (!!session.user.email &&
      (await passwordMatches(session.user.email, String(body.password ?? ''))));
  if (!proven)
    return NextResponse.json(
      { ok: false, code: 'REAUTH_REQUIRED' },
      { status: 403, headers: NO_STORE },
    );
  const res = await runTool('chalybobs', session.user.id, () =>
    adapter.streamKey(session.user.id, platform),
  );
  if (!res.ok)
    return NextResponse.json(
      { ok: false, error: res.error },
      { status: statusForReason(res.error.reason) },
    );
  return NextResponse.json({ ok: true, data: { key: res.data } }, { headers: NO_STORE });
}
