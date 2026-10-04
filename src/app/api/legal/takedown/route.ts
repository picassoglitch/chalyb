// POST /api/legal/takedown — copyright notice (Uso aceptable §5.1; art. 114
// Octies LFDA), from the public form at /derechos-de-autor. No sign-in: the
// claimant usually has no account. 422 lists the missing minimum fields;
// the optional ones never block the notice. Byte cap, rate limits and the
// evidence live in src/lib/legal/takedown-http.ts (7a MED 6).

import { NextResponse } from 'next/server';
import { submitTakedown } from '@/lib/legal/legal-server';
import { handleTakedownPost } from '@/lib/legal/takedown-http';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Fallback per instance, only when the durable counter can't answer (as the
// contact form): losing the notice channel would be worse than a briefly
// per-instance limit.
const memory = new Map<string, number[]>();
function rateInMemory(key: string, windowSeconds: number, max: number): boolean {
  const now = Date.now();
  const hist = (memory.get(key) ?? []).filter((t) => now - t < windowSeconds * 1000);
  if (hist.length >= max) return false;
  hist.push(now);
  memory.set(key, hist);
  return true;
}

/** Durable limit shared by every instance; check_contact_rate_limit hashes
 *  the key (a namespaced IP or contact), so neither is stored in the clear. */
async function rateLimit(key: string, windowSeconds: number, max: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc('check_contact_rate_limit', {
      p_ip: key,
      p_window_seconds: windowSeconds,
      p_max_attempts: max,
    });
    if (error) throw new Error(error.message);
    return ((data ?? {}) as { allowed?: boolean }).allowed !== false;
  } catch (err) {
    console.warn(
      '[takedown] durable rate limit unavailable:',
      err instanceof Error ? err.message : String(err),
    );
    return rateInMemory(key, windowSeconds, max);
  }
}

export async function POST(req: Request) {
  const { status, body } = await handleTakedownPost(req, { rateLimit, submit: submitTakedown });
  return NextResponse.json(body, { status });
}
