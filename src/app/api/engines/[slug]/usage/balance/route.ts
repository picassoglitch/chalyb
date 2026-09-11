// GET /api/engines/{slug}/usage/balance?external_user_id=<id>
//
// Read-only balance lookup for engines. Same bearer-auth pattern as POST
// /api/engines/{slug}/usage — the token identifies which engine is asking,
// the slug in the URL must match the slug the token belongs to.
//
// Engines hit this:
//   1. On chip-click refresh, when their local cache is empty (e.g. user
//      just signed in via SSO and hasn't run any LLM calls yet).
//   2. Before kicking off expensive work to decide whether to bail with
//      an "out of tokens" message.
//   3. From their own diag pages.
//
// The companion POST endpoint at ../route.ts already returns balance
// after writing events; this GET surface is the "no writes, just tell me
// what's left" variant. Documented in the POST file's header comment;
// previously the documentation existed but the route didn't, so engines
// calling it would hit Vercel's HTML 404 and silently no-op.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTokenBalance } from '@/lib/usage/tokens';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Mirror of ENGINE_BEARER_ENV in ../route.ts. Kept duplicated here rather
// than imported because: (a) Next.js route files don't co-locate cleanly
// for shared exports; (b) the list is tiny and changes rarely; (c) using
// a shared `lib/engines/bearer.ts` helper is fine if it grows past 3
// engines but premature today.
const ENGINE_BEARER_ENV: Record<string, string> = {
  chalybclip: 'CHALYBCLIP_ADMIN_TOKEN',
  // chalybstream: 'CHALYBSTREAM_ADMIN_TOKEN',   // when it ships
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function checkEngineBearer(
  req: Request,
  slug: string,
): { ok: true } | { ok: false; status: number; error: string } {
  const envName = ENGINE_BEARER_ENV[slug];
  if (!envName) {
    return { ok: false, status: 404, error: `unknown engine: ${slug}` };
  }
  const expected = process.env[envName];
  if (!expected) {
    return { ok: false, status: 503, error: `${envName} not configured` };
  }
  const header = req.headers.get('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return { ok: false, status: 401, error: 'missing bearer token' };
  }
  const presented = header.slice('bearer '.length).trim();
  if (!constantTimeEqual(presented, expected)) {
    return { ok: false, status: 403, error: 'invalid bearer token' };
  }
  return { ok: true };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const auth = checkEngineBearer(req, slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get('external_user_id');
  if (!userId) {
    return NextResponse.json(
      { error: 'external_user_id query param required' },
      { status: 400 },
    );
  }

  // Confirm the user exists so engines get a clear 404 (not zero balance)
  // when their `external_user_id` is stale. Stale-id case usually means
  // the engine's tenant has an external_user_id that doesn't match any
  // Supabase auth user — re-link from /dashboard/team fixes it.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: 'unknown user_id', external_user_id: userId },
      { status: 404 },
    );
  }

  const balance = await getTokenBalance(userId);
  return NextResponse.json({ ok: true, balance });
}
