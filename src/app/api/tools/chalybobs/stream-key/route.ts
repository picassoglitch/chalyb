// POST /api/tools/chalybobs/stream-key — "Mostrar" the stream key (§6.3,
// §6.4). The key never reaches the browser before this call, and this call
// needs the person to prove it's them: their password again, or THIS session
// signed in within the last 5 minutes (people who use a link or Google).
// Password checks are limited to 5 per user per 15 minutes; every check and
// every reveal is audited. The key is never logged or cached.

import { NextResponse } from 'next/server';
import { asJsonObject } from '@/lib/tools/bff-core';
import { createClient } from '@supabase/supabase-js';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { getEnVivo, hubRunsTool } from '@/lib/tools/registry';
import { runTool } from '@/lib/tools/bff';
import { statusForReason } from '@/lib/tools/bff-core';
import { LIVE_PLATFORMS, type LivePlatform } from '@/lib/tools/adapters/tools';
import {
  recentSignIn,
  REVEAL_WINDOW_MS,
  revealAttemptAllowed,
  sessionAuthTimeMs,
} from '@/lib/tools/envivo-core';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';

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
  // Don't leave a live session behind: sign this temporary one out (only
  // it, never the person's other devices).
  if (!error) await client.auth.signOut({ scope: 'local' }).catch(() => {});
  return !error;
}

/** Password checks this user made in the current window. */
async function recentAttempts(userId: string): Promise<number> {
  const since = new Date(Date.now() - REVEAL_WINDOW_MS).toISOString();
  const { count } = await createAdminClient()
    .from('audit_events')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'tool.key_reauth')
    .eq('target_user_id', userId)
    .gte('created_at', since);
  return count ?? 0;
}

/** When the session making this request signed in (its JWT's amr / iat). */
async function thisSessionAuthTime(): Promise<number | null> {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getSession();
  return sessionAuthTimeMs(data.session?.access_token);
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
  const userId = session.user.id;
  let via: 'recent_session' | 'password' | null = recentSignIn(
    await thisSessionAuthTime(),
    Date.now(),
  )
    ? 'recent_session'
    : null;
  if (!via && session.user.email && typeof body.password === 'string' && body.password) {
    if (!revealAttemptAllowed(await recentAttempts(userId)))
      return NextResponse.json(
        { ok: false, code: 'RATE_LIMITED' },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(REVEAL_WINDOW_MS / 1000) } },
      );
    const ok = await passwordMatches(session.user.email, body.password);
    await logAudit({
      action: 'tool.key_reauth',
      actorId: userId,
      targetUserId: userId,
      metadata: { tool: 'chalybobs', ok },
    });
    if (ok) via = 'password';
  }
  if (!via)
    return NextResponse.json(
      { ok: false, code: 'REAUTH_REQUIRED' },
      { status: 403, headers: NO_STORE },
    );
  const res = await runTool('chalybobs', session.user.id, (signal) =>
    adapter.streamKey(session.user.id, platform, signal),
  );
  if (!res.ok)
    return NextResponse.json(
      { ok: false, error: res.error },
      { status: statusForReason(res.error.reason) },
    );
  await logAudit({
    action: 'tool.key_reveal',
    actorId: userId,
    targetUserId: userId,
    metadata: { tool: 'chalybobs', platform, via },
  });
  return NextResponse.json({ ok: true, data: { key: res.data } }, { headers: NO_STORE });
}
