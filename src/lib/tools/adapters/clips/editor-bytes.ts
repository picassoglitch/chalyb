// Stable hub URLs for a clip's media (media, thumbnail, download) — what
// ClipDetail.previewUrl/thumbUrl/downloadUrl point at. They don't carry
// bytes: each answers a redirect to a fresh short-lived signed engine link
// (ChalyClip api/hub_media.py), so video never goes through the hub (Vercel
// caps function bodies). Same gates as toolRoute: session → plan → hub
// runs Clips → breaker/timeout.

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
import { CLIP_ID_RE, parseQuality } from './editor-types';

const noStore = { 'cache-control': 'private, no-store' };

export async function clipMediaRedirect(
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
  const api = editorApi(adapter.engine(session.user.id));
  const res = await runTool(
    CLIPS_SLUG,
    session.user.id,
    async (signal): Promise<string | null> => {
      if (what === 'download') {
        const s = await api.renderStatus(clipId, quality, signal);
        return s.state === 'ready' ? api.mediaUrl(s.download) : null;
      }
      const p = await api.load(clipId, signal);
      return api.mediaUrl(what === 'media' ? p.media?.preview : p.media?.thumbnail);
    },
    { idempotent: true, adapterErrorsOnly: true },
  );
  if (!res.ok)
    return NextResponse.json(
      { ok: false, error: res.error },
      { status: statusForReason(res.error.reason) },
    );
  if (res.data) return NextResponse.redirect(res.data, { status: 302, headers: noStore });
  if (what === 'download') {
    // Not rendered yet: the editor starts the export and waits with the person.
    const en = (req.headers.get('referer') ?? '').includes('/en/');
    const back = `${en ? '/en' : ''}/app/clips/${encodeURIComponent(clipId)}?export=${quality}`;
    return NextResponse.redirect(new URL(back, url.origin), { status: 303, headers: noStore });
  }
  return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 });
}
