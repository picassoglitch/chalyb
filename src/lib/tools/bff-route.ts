// Route-handler side of the BFF: /api/tools/{slug}/** (TOOLS-SPEC §1.2).
//
//   const GET = toolRoute('chalybcrypto', getSenales, (a, ctx) => a.coins(), { idempotent: true });
//
// Each call: session (401) → the tool included in the plan (403) → the hub
// runs it (503 + supportCode) → a current risk notice for tools that need
// one (403 RISK_ACK_REQUIRED, the screen shows the sheet again) → runTool
// (timeout, retries, breaker, normalized error). The engine never sees a
// cookie, and the client never sees an engine error.

import 'server-only';
import { NextResponse } from 'next/server';
import { getSessionUser, type SessionUser } from '@/lib/auth/session';
import { getEntitlements, type Entitlements } from '@/lib/billing/entitlement';
import { toolBySlug } from '@/config/tools';
import { hasRiskAck } from './consents';
import { hubRunsTool } from './registry';
import { reportToolError, runTool } from './bff';
import { asJsonObject, markingAdapter, statusForReason } from './bff-core';

export interface ToolRouteCtx {
  req: Request;
  session: SessionUser;
  entitlements: Entitlements;
  params: Record<string, string>;
  /** The JSON body as a plain object ({} for GET, null, arrays or junk). */
  body: Record<string, unknown>;
}

export function toolRoute<A, T>(
  slug: string,
  adapter: () => A | null,
  handler: (adapter: A, ctx: ToolRouteCtx) => Promise<T>,
  opts: { idempotent?: boolean } = {},
) {
  return async (
    req: Request,
    route?: { params?: Promise<Record<string, string>> },
  ): Promise<Response> => {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
    const entitlements = await getEntitlements(session);
    if (entitlements.tools[slug]?.state !== 'included')
      return NextResponse.json({ ok: false, code: 'NOT_INCLUDED' }, { status: 403 });
    const a = hubRunsTool(slug) ? adapter() : null;
    if (!a) {
      const error = await reportToolError(slug, session.user.id, 'unavailable', true);
      return NextResponse.json({ ok: false, error }, { status: 503 });
    }
    if (toolBySlug(slug)?.needsRiskAck && !(await hasRiskAck(session.user.id, slug)))
      return NextResponse.json({ ok: false, code: 'RISK_ACK_REQUIRED' }, { status: 403 });
    const params = (await route?.params) ?? {};
    const body =
      req.method === 'GET' || req.method === 'HEAD'
        ? {}
        : asJsonObject(await req.json().catch(() => null));
    // Only what the engine adapter throws counts against the tool's breaker
    // and health: a malformed request or a bug in this handler is not an
    // outage and must not lock everyone out.
    const res = await runTool(
      slug,
      session.user.id,
      () => handler(markingAdapter(a as object) as A, { req, session, entitlements, params, body }),
      { ...opts, adapterErrorsOnly: true },
    );
    if (res.ok) return NextResponse.json({ ok: true, data: res.data });
    return NextResponse.json(
      { ok: false, error: res.error },
      { status: statusForReason(res.error.reason) },
    );
  };
}
