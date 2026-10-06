// Engine usage reporting endpoint.
//
// POST /api/engines/{slug}/usage
//   Auth: Bearer engine admin token (e.g. CHALYBCLIP_ADMIN_TOKEN).
//         The token identifies WHICH engine is reporting; the URL slug must
//         match the slug the token belongs to (defense-in-depth so a leaked
//         ChalybStream token can't write usage on ChalyClip's behalf).
//   Body: {
//     external_user_id: string,   // Chalyb user id (matches profiles.id)
//     events: [
//       {
//         provider?: 'anthropic' | 'assemblyai' | ...,   // T4 contract
//         kind: 'llm.tokens' | 'transcription.seconds' | ...,
//         amount: 1234,                                  // native units
//         cost_usd_micros?: 111000,                      // real cost ($0.111)
//         source_id: 'llmc_xyz',                         // = engine row id
//         occurred_at?: '2026-...',
//         operation?: 'variants_generate',
//         metadata?: { ... }
//       }
//     ]
//   }
//   Returns: { ok: true, inserted, skipped, balance: { remaining,
//             monthlyAllocation, bonus, monthlyUsed, periodStart } }
//
//   Limits (docs/engines/consumption-contract.md): ≤100 events, integer
//   amount/cost within bounds, occurred_at within the last 7 days. A 4xx
//   is permanent — engines dead-letter it instead of retrying.
//
//   NOTE on validation: `kind` is free-text (loose regex check below) —
//   the platform deliberately does NOT whitelist values. Engines can add
//   new meters (transcription.seconds, vision.frames, embedding.tokens,
//   ...) without a coordinated Chalyb deploy. See migration 0020.
//
// Engines call this AFTER every LLM call (or batched every N seconds). The
// returned balance lets the engine decide whether to keep spending or pause
// the user with "out of tokens".
//
// GET /api/engines/{slug}/usage/balance?external_user_id=<id>
//   Same auth. Returns the current balance without writing. Engines hit this
//   before kicking off expensive work to decide whether to bail.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkEngineBearer } from '@/lib/engines/bearer';
import { getTokenBalance, recordUsageEvents } from '@/lib/usage/tokens';
import { validateUsageEvents } from '@/lib/usage/event-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PostBody {
  external_user_id?: string;
  /** Validated by validateUsageEvents — see the contract for the shape. */
  events?: unknown;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const auth = checkEngineBearer(req, slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const userId = body.external_user_id;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'external_user_id required' }, { status: 400 });
  }

  // Resolve userId → confirm it exists. The engine should never send an
  // unknown user, but if it does we return 404 so the engine knows to
  // re-provision rather than retry silently.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: 'unknown user_id' }, { status: 404 });
  }

  const checked = validateUsageEvents(body.events, Date.now());
  if (!checked.ok) {
    return NextResponse.json(
      { error: checked.error, index: checked.index },
      { status: checked.status },
    );
  }
  if (checked.events.length === 0) {
    // No events to record — just return the current balance.
    const balance = await getTokenBalance(userId);
    return NextResponse.json({ ok: true, inserted: 0, balance });
  }

  const normalized = checked.events.map((e) => ({ ...e, engineSlug: slug, userId }));
  const result = await recordUsageEvents(normalized);
  const balance = await getTokenBalance(userId);
  return NextResponse.json({ ok: true, ...result, balance });
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
    return NextResponse.json({ error: 'external_user_id query param required' }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: 'unknown user_id' }, { status: 404 });
  }
  const balance = await getTokenBalance(userId);
  return NextResponse.json({ ok: true, balance });
}
