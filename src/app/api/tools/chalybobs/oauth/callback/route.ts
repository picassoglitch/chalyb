// GET /api/tools/chalybobs/oauth/callback?platform=&code=&state=&error= —
// where the engine's registered OAuth callback forwards a hub-started
// sign-in. Finishes only for the browser that started it (state must equal
// the httpOnly cookie oauth/consent set, for this signed-in person); then
// the engine exchanges the code server to server for this person's tenant.
// Ends on Transmitir with ?connected= / ?connect_error=.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { getEnVivo, hubRunsTool } from '@/lib/tools/registry';
import { runTool } from '@/lib/tools/bff';
import { isOAuthPlatform } from '@/lib/tools/envivo-platforms';
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  decodePending,
  backToStudio,
  pendingMatches,
  type OAuthOutcome,
} from '@/lib/tools/envivo-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const platform = q.get('platform') ?? '';
  const label = isOAuthPlatform(platform) ? platform : 'platform';
  const jar = await cookies();
  const pending = decodePending(jar.get(OAUTH_COOKIE)?.value);

  const finish = (o: OAuthOutcome) => {
    const res = NextResponse.redirect(backToStudio(o, req.url), 303);
    // One-shot: a used or failed sign-in can never be replayed.
    res.cookies.set({ name: OAUTH_COOKIE, value: '', path: OAUTH_COOKIE_PATH, maxAge: 0 });
    return res;
  };

  const session = await getSessionUser();
  if (!session) return finish({ error: `${label}_state_mismatch` });
  const now = Math.floor(Date.now() / 1000);
  if (!pendingMatches(pending, { userId: session.user.id, platform, state: q.get('state') }, now))
    return finish({ error: `${label}_state_mismatch` });
  // The person pressed "Cancel" on the platform's page.
  if (q.get('error')) return finish({ error: `${pending.platform}_denied` });
  const code = q.get('code');
  if (!code || code.length > 2048) return finish({ error: `${pending.platform}_state_mismatch` });

  const ent = await getEntitlements(session);
  const adapter = hubRunsTool('chalybobs') ? getEnVivo() : null;
  if (ent.tools.chalybobs?.state !== 'included' || !adapter)
    return finish({ error: `${pending.platform}_unavailable` });
  const res = await runTool('chalybobs', session.user.id, (signal) =>
    adapter.oauthComplete(
      session.user.id,
      pending.platform,
      { code, codeVerifier: pending.verifier },
      signal,
    ),
  );
  return finish(
    res.ok ? { connected: pending.platform } : { error: `${pending.platform}_exchange_failed` },
  );
}
