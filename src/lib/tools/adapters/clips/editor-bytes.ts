// Byte routes of the clip editor (media, thumbnail, download): the BFF
// streams them from the engine so the browser never talks to it. Same gates
// as toolRoute (session → plan → hub runs Clips → breaker/timeout), but the
// answer is the engine's bytes, Range-aware, not JSON.

import 'server-only';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { reportToolError, runTool } from '@/lib/tools/bff';
import { statusForReason } from '@/lib/tools/bff-core';
import { hubRunsTool } from '@/lib/tools/registry';
import { CLIPS_SLUG } from './client';
import { editorApi } from './editor-api';
import { CLIP_ID_RE, parseQuality, safeRedirect } from './editor-types';

const PASS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'content-disposition',
  'etag',
  'last-modified',
];

function pipe(up: Response, cache: string): Response {
  const headers = new Headers();
  for (const h of PASS) {
    const v = up.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('cache-control', cache);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(up.body, { status: up.status, headers });
}

export async function clipBytes(
  req: Request,
  clipId: string,
  what: 'media' | 'thumbnail' | 'download',
): Promise<Response> {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const entitlements = await getEntitlements(session);
  if (entitlements.tools[CLIPS_SLUG]?.state !== 'included')
    return NextResponse.json({ ok: false, code: 'NOT_INCLUDED' }, { status: 403 });
  const adapter = hubRunsTool(CLIPS_SLUG) ? getClipsEngineAdapter() : null;
  if (!adapter) {
    const error = await reportToolError(CLIPS_SLUG, session.user.id, 'unavailable', true);
    return NextResponse.json({ ok: false, error }, { status: 503 });
  }
  if (!CLIP_ID_RE.test(clipId))
    return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 });

  const url = new URL(req.url);
  const quality = parseQuality(url.searchParams.get('quality'));
  const range = what === 'thumbnail' ? null : req.headers.get('range');
  const api = editorApi(adapter.engine(session.user.id));
  const res = await runTool(
    CLIPS_SLUG,
    session.user.id,
    async (signal) => {
      const up = await api.bytes(clipId, what, { range, quality, signal });
      if (up.status < 300 || up.status >= 400) return up;
      // The engine hands media off to its bucket when the local copy is
      // gone: follow it here, so the browser still only talks to us.
      const to = safeRedirect(up.headers.get('location'));
      if (!to) throw Object.assign(new Error('bad media redirect'), { code: 'ENGINE_ERROR' });
      return fetch(to, { headers: range ? { Range: range } : {}, signal, cache: 'no-store' });
    },
    { idempotent: true, adapterErrorsOnly: true },
  );
  if (!res.ok) {
    // A download that isn't rendered yet (or failed): back to the editor,
    // which starts the export and waits with the person.
    if (what === 'download' && res.error.reason === 'bad_request') {
      const en = (req.headers.get('referer') ?? '').includes('/en/');
      const back = `${en ? '/en' : ''}/app/clips/${encodeURIComponent(clipId)}?export=${quality}`;
      return NextResponse.redirect(new URL(back, url.origin), 303);
    }
    return NextResponse.json(
      { ok: false, error: res.error },
      { status: statusForReason(res.error.reason) },
    );
  }
  const up = res.data;
  if (!up.ok && up.status !== 206) {
    await up.body?.cancel().catch(() => {});
    return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 });
  }
  return pipe(up, what === 'thumbnail' ? 'private, max-age=300' : 'private, no-store');
}
