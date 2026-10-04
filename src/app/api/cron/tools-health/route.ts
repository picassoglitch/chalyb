// GET /api/cron/tools-health — one health check per tool (TOOLS-SPEC §1.2,
// F10). Meant to run every 60 s from an external scheduler (Vercel Hobby
// crons are daily only, so it is NOT in vercel.json; OPS item in the PR).
// Requires `Authorization: Bearer ${CRON_SECRET}`; 401 otherwise.
//
// A tool the hub doesn't run (TOOL_HUB_MODE_<SLUG>=off) is skipped: there is
// nothing to check and its screens already say it didn't open. A tool that
// fails or answers after the timeout is down; after 5 minutes down the owner
// is alerted once and the "ya nos avisaron" pill turns on.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { TOOLS } from '@/config/tools';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { getEnVivo, getSenales, hubRunsTool } from '@/lib/tools/registry';
import { recordToolHealth } from '@/lib/tools/status';
import { TOOL_TIMEOUT_MS } from '@/lib/tools/bff-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** The cheapest read each adapter has, standing in for GET /health until
 *  the engines publish one (OPS-13). */
const PROBES: Record<string, () => (() => Promise<unknown>) | null> = {
  chalybclip: () => {
    const a = getClipsAdapter();
    return a ? async () => a.capabilities() : null;
  },
  chalybcrypto: () => {
    const a = getSenales();
    return a ? () => a.coins() : null;
  },
  chalybobs: () => {
    const a = getEnVivo();
    return a ? async () => a.capabilities() : null;
  },
};

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const results: Record<string, string> = {};
  for (const tool of TOOLS) {
    const probe = hubRunsTool(tool.slug) ? (PROBES[tool.slug]?.() ?? null) : null;
    if (!probe) {
      results[tool.slug] = 'skipped';
      continue;
    }
    const started = Date.now();
    let ok = true;
    let reason: string | null = null;
    try {
      await Promise.race([
        probe(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TOOL_TIMEOUT_MS)),
      ]);
    } catch (err) {
      ok = false;
      reason = err instanceof Error && err.message === 'timeout' ? 'timeout' : 'unknown';
    }
    const next = await recordToolHealth(tool.slug, { ok, latencyMs: Date.now() - started, reason });
    results[tool.slug] = next.state;
  }
  return NextResponse.json({ ok: true, results });
}
