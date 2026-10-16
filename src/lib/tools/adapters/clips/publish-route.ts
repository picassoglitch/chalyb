// /api/tools/chalybclip/publish/** — the Publish Center's BFF (TOOLS-SPEC §1.2).
//
// Same gate as toolRoute (session → Clips in the plan → the hub runs Clips),
// then: only allowlisted operations (publish-ops.ts), the plan's
// clipConnectSocials for connecting/publishing, current Terms for anything
// that posts under the person's name, and the engine call as that person.
//
// Answers:
//   200 {ok: true, data}                    the engine's JSON
//   4xx {ok: false, error: {reason, …, message}}
//        the engine refused (validation, plan caps, state): its own Spanish
//        copy rides along in `message` so the screen can say what to fix.
//        Never counts against the tool's health.
//   5xx {ok: false, error: ToolError}       engine trouble: normalized, with a
//        support code, counted by the breaker. No engine text.

import 'server-only';
import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { termsAcceptancePending } from '@/lib/legal/reaccept-server';
import { runTool, reportToolError } from '@/lib/tools/bff';
import {
  asJsonObject,
  failureEffect,
  normalizeToolError,
  statusForReason,
} from '@/lib/tools/bff-core';
import { socialsAllowed } from '@/lib/tools/clips-bff';
import { TIER_CAPS } from '@/lib/billing/tiers';
import { recordToolConsent } from '@/lib/tools/consents';
import { hubRunsTool } from '@/lib/tools/registry';
import { getClipsEngineAdapter } from '../clips';
import { CLIPS_SLUG, seg } from './client';
import { ClipsEngineError } from './errors';
import { publishReturnUrl } from './publish';
import { PUBLISH_LONG_TIMEOUT_MS, matchPublishOp, pickQuery } from './publish-ops';

const SLUG = CLIPS_SLUG;

const DISPLAY: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'X',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  threads: 'Threads',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
  discord: 'Discord',
  telegram: 'Telegram',
};
const platformDisplayName = (p: string) => DISPLAY[p] ?? p;

type Params = { params: Promise<{ path?: string[] }> };

interface Refusal {
  status: number;
  code: string;
  refusal: string | null;
  message: string | null;
}

const REFUSAL_MARK = Symbol('publish.refusal');
type Refused = { [REFUSAL_MARK]: Refusal };

/** An engine 4xx is the person's state (bad input, plan cap, wrong state),
 *  not an outage: it comes back as a value, never through the breaker. A 401
 *  is the hub↔engine trust failing — that IS an outage. */
function asRefusal(err: unknown): Refused | null {
  if (!(err instanceof ClipsEngineError)) return null;
  if (err.status < 400 || err.status >= 500 || err.status === 401) return null;
  return {
    [REFUSAL_MARK]: {
      status: err.status,
      code: err.engineCode,
      refusal: err.refusal,
      message: err.userMessage,
    },
  };
}

function isRefused(v: unknown): v is Refused {
  return !!v && typeof v === 'object' && REFUSAL_MARK in v;
}

function refusalResponse(r: Refusal): Response {
  const { reason } = normalizeToolError(new ClipsEngineError(r.code as never, r.status));
  return NextResponse.json(
    {
      ok: false,
      error: {
        reason,
        retryable: false,
        code: r.code,
        refusal: r.refusal,
        message: r.message,
      },
    },
    { status: r.status },
  );
}

function json(status: number, body: unknown): Response {
  return NextResponse.json(body, { status });
}

/** Run a long engine call (render, backlog) with its own timeout. Errors are
 *  normalized and reported exactly like runTool's. */
async function runLong<T>(
  userId: string,
  op: (signal: AbortSignal) => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: unknown }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PUBLISH_LONG_TIMEOUT_MS);
  try {
    return { ok: true, data: await op(ctl.signal) };
  } catch (err) {
    const timedOut = ctl.signal.aborted;
    const { reason, retryable, outage, refusal } = timedOut
      ? { reason: 'timeout' as const, retryable: true, outage: true, refusal: undefined }
      : failureEffect(err, { adapterErrorsOnly: true });
    const error = await reportToolError(SLUG, userId, reason, retryable, outage, refusal);
    return { ok: false, status: timedOut ? 504 : 502, body: { ok: false, error } };
  } finally {
    clearTimeout(timer);
  }
}

export function publishHandler(method: 'GET' | 'POST') {
  return async (req: Request, route: Params): Promise<Response> => {
    const session = await getSessionUser();
    if (!session) return json(401, { ok: false, code: 'SESSION_EXPIRED' });
    const entitlements = await getEntitlements(session);
    if (entitlements.tools[SLUG]?.state !== 'included')
      return json(403, { ok: false, code: 'NOT_INCLUDED' });
    const adapter = hubRunsTool(SLUG) ? getClipsEngineAdapter() : null;
    const userId = session.user.id;
    if (!adapter) {
      const error = await reportToolError(SLUG, userId, 'unavailable', true);
      return json(503, { ok: false, error });
    }

    const segs = (await route.params).path ?? [];

    // Thumbnails: bytes (or the bucket's signed redirect), not JSON.
    if (method === 'GET' && segs.length === 3 && segs[0] === 'clips' && segs[2] === 'thumbnail')
      return thumbnail(adapter.engine(userId), segs[1]!);

    const matched = matchPublishOp(method, segs);
    if (!matched) return json(404, { ok: false, error: { reason: 'not_found', retryable: false } });
    const { op, enginePath } = matched;

    if (op.socials && !socialsAllowed(entitlements.plan))
      return json(403, { ok: false, error: { reason: 'needs_plan', retryable: false } });
    if (op.publishes && (await termsAcceptancePending(userId)))
      return json(403, {
        ok: false,
        error: { reason: 'forbidden', retryable: false, refusal: 'terms_pending' },
      });

    const url = new URL(req.url);
    const query = method === 'GET' ? pickQuery(op, url.searchParams) : undefined;
    let body: Record<string, unknown> | undefined;
    let consent: (() => Promise<unknown>) | null = null;
    if (method === 'POST') {
      body = asJsonObject(await req.json().catch(() => null));
      const locale = body.locale === 'en' ? 'en' : 'es';
      if (op.pattern === 'connect') {
        // The OAuth window must come back to THIS app; the client never
        // picks the URL (the engine also refuses any other origin).
        const platform = typeof body.platform === 'string' ? body.platform : '';
        body = {
          platform,
          return_url: publishReturnUrl(locale, typeof body.next === 'string' ? body.next : null),
        };
        // aceptacion-ux §7: the connect sheet's text, recorded once the
        // engine hands out the OAuth URL (same as /api/tools/chalybclip/connect).
        consent = async () => {
          const t = await getTranslations({ locale, namespace: 'consents.connect' });
          const name = platformDisplayName(platform);
          await recordToolConsent(session, {
            type: 'social_connect',
            surface: 'clips_publish_connect',
            checkboxText: '',
            buttonLabel: t('cta', { plataforma: name }),
            details: { tool: SLUG, platform },
            locale,
            disclosureText: t.markup('body', { plataforma: name, b: (c) => c }),
          });
        };
      } else if (op.pattern === 'autopublish/save' && body.enabled === true) {
        // Auto-publish is VIP (TIER_CAPS.clipAutoPublish; the engine refuses
        // it below its top tier too).
        if (!TIER_CAPS[entitlements.plan]?.clipAutoPublish)
          return json(403, {
            ok: false,
            error: { reason: 'needs_plan', retryable: false, refusal: 'paywall_autopilot' },
          });
        // Turning auto-publish ON needs the responsibility box (aceptacion-ux
        // §7) and current Terms (§8); saving other knobs while it's already on
        // doesn't ask again.
        const current = await adapter
          .engine(userId)
          .get<{ settings?: { enabled?: boolean } }>('/publish/autopublish.json')
          .catch(() => null);
        if (!current?.settings?.enabled) {
          if (await termsAcceptancePending(userId))
            return json(403, {
              ok: false,
              error: { reason: 'forbidden', retryable: false, refusal: 'terms_pending' },
            });
          if (body.consent !== true)
            return json(422, {
              ok: false,
              error: { reason: 'bad_request', retryable: false, refusal: 'consent_required' },
            });
          const targets = Array.isArray(body.targets)
            ? body.targets.filter((x): x is string => typeof x === 'string').slice(0, 20)
            : [];
          consent = async () => {
            const t = await getTranslations({ locale, namespace: 'consents' });
            const tp = await getTranslations({ locale, namespace: 'clipsPublish.autopilot' });
            const cuenta = targets.length
              ? targets.map(platformDisplayName).join(', ')
              : tp('allNetworks');
            await recordToolConsent(session, {
              type: 'autopublish_enabled',
              surface: 'clips_publish_autopilot',
              checkboxText: t.markup('autopublish.check', { cuenta, b: (c) => c }),
              buttonLabel: tp('save'),
              details: { tool: SLUG, account: cuenta },
              locale,
            });
          };
        }
      }
      delete body.consent;
      delete body.locale;
    }

    const call = (signal: AbortSignal) =>
      adapter
        .engine(userId)
        .request<unknown>(method, enginePath, { query, body, signal })
        .catch((err: unknown) => {
          const refused = asRefusal(err);
          if (refused) return refused;
          throw err;
        });

    const res = op.long
      ? await runLong(userId, call)
      : await runTool(SLUG, userId, call, {
          idempotent: method === 'GET',
          adapterErrorsOnly: true,
        });
    if (!res.ok)
      return 'status' in res
        ? json(res.status, res.body)
        : json(statusForReason(res.error.reason), { ok: false, error: res.error });
    if (isRefused(res.data)) return refusalResponse(res.data[REFUSAL_MARK]);
    if (consent) await consent();
    return json(200, { ok: true, data: res.data });
  };
}

async function thumbnail(
  engine: ReturnType<NonNullable<ReturnType<typeof getClipsEngineAdapter>>['engine']>,
  clipId: string,
): Promise<Response> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(clipId))
    return new Response(null, { status: 404 });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10_000);
  try {
    const res = await engine.request<Response>('GET', `/publish/clips/${seg(clipId)}/thumbnail`, {
      raw: true,
      signal: ctl.signal,
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location && /^https:\/\//.test(location))
      return new Response(null, {
        status: 302,
        headers: { Location: location, 'Cache-Control': 'private, max-age=300' },
      });
    const type = res.headers.get('content-type') ?? '';
    if (res.status !== 200 || !type.startsWith('image/'))
      return new Response(null, { status: 404 });
    return new Response(res.body, {
      status: 200,
      headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300' },
    });
  } catch {
    return new Response(null, { status: 404 });
  } finally {
    clearTimeout(timer);
  }
}
