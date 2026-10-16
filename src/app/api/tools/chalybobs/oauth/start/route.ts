// GET /api/tools/chalybobs/oauth/start?platform= — the same tab, right
// after "Conectar {plataforma}". Needs the cookie that
// oauth/consent set for this person and platform; asks the engine for the
// platform's consent page and sends the browser there.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { getEnVivo, hubRunsTool } from '@/lib/tools/registry';
import { runTool } from '@/lib/tools/bff';
import {
  OAUTH_COOKIE,
  decodePending,
  backToStudio,
  pendingMatches,
  pkceChallenge,
} from '@/lib/tools/envivo-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const platform = new URL(req.url).searchParams.get('platform') ?? '';
  const fail = (error: string) =>
    NextResponse.redirect(
      backToStudio(
        { error: `${/^(kick|twitch|youtube)$/.test(platform) ? platform : 'platform'}_${error}` },
        req.url,
      ),
      303,
    );
  const session = await getSessionUser();
  if (!session) return NextResponse.redirect(new URL('/sign-in?next=/app/en-vivo', req.url));
  const ent = await getEntitlements(session);
  const adapter = hubRunsTool('chalybobs') ? getEnVivo() : null;
  if (ent.tools.chalybobs?.state !== 'included' || !adapter) return fail('unavailable');
  const pending = decodePending((await cookies()).get(OAUTH_COOKIE)?.value);
  const now = Math.floor(Date.now() / 1000);
  if (!pendingMatches(pending, { userId: session.user.id, platform }, now))
    return fail('state_mismatch');
  const res = await runTool('chalybobs', session.user.id, (signal) =>
    adapter.oauthAuthorizeUrl(
      session.user.id,
      pending.platform,
      { state: pending.state, codeChallenge: pkceChallenge(pending.verifier) },
      signal,
    ),
  );
  if (!res.ok)
    return fail(res.error.reason === 'bad_request' ? 'not_configured' : 'exchange_failed');
  return NextResponse.redirect(new URL(res.data, req.url), 303);
}
