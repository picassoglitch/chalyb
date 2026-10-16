// GET /api/tools/chalybobs/preview/{token}/{...path} — the live preview
// (HLS), streamed through the hub so the browser never talks to the engine
// and never sees a stream key.
//
// The token is the engine's PREVIEW credential (envivo-token.ts): 30 min,
// good only for this person's own preview. The hub checks it here (so junk
// never reaches the engine) and forwards it as the Bearer; the engine looks
// up the stream key and proxies its private relay. No session lookup per
// segment: the page that minted the token already passed the full gate.

import { engineBase, engineSecret } from '@/lib/tools/adapters/envivo-engine';
import { PREVIEW_AUD, safePreviewPath, verifyEngineToken } from '@/lib/tools/envivo-token';
import { toolHubMode } from '@/lib/config/flags';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };
const PASS = ['content-type', 'content-length'];

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string; path: string[] }> },
): Promise<Response> {
  if (toolHubMode('chalybobs') !== 'a')
    return Response.json({ error: 'unavailable' }, { status: 404, headers: NO_STORE });
  const { token, path } = await ctx.params;
  const secret = engineSecret();
  const claims = secret ? verifyEngineToken(decodeURIComponent(token), PREVIEW_AUD, secret) : null;
  if (!claims) return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  const sub = safePreviewPath(path);
  if (!sub) return Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });

  let upstream: Response;
  try {
    upstream = await fetch(`${await engineBase()}/api/hub/v1/preview/${sub}`, {
      headers: {
        Authorization: `Bearer ${decodeURIComponent(token)}`,
        Accept: req.headers.get('accept') ?? '*/*',
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // No publisher yet / engine unreachable: the player keeps retrying.
    return Response.json({ error: 'upstream' }, { status: 404, headers: NO_STORE });
  }
  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 401 ? 401 : upstream.status === 503 ? 503 : 404;
    return Response.json({ error: 'upstream' }, { status, headers: NO_STORE });
  }
  const headers = new Headers(NO_STORE);
  for (const h of PASS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: 200, headers });
}
