// POST /api/tools/consent — the risk notice, the AI likeness step and
// autopublish (P3-3). 422
// without the box ticked; the texts stored are the ones the page showed,
// rendered again here from the same messages.

import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth/session';
import { RISK_TOOLS } from '@/lib/tools/routes';
import { engineDisplayName } from '@/lib/engines/display-names';
import { recordToolConsent, riskVersion } from '@/lib/tools/consents';
import { getEntitlements } from '@/lib/billing/entitlement';
import { TIER_CAPS } from '@/lib/billing/tiers';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { decideAutopublish } from '@/lib/tools/autopublish';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.checked !== true)
    return NextResponse.json({ ok: false, code: 'CONSENT_REQUIRED' }, { status: 422 });
  // Every path below re-reads the plan and capabilities: the client's word
  // is only the checkbox.
  const locale = body.locale === 'en' ? 'en' : 'es';
  const t = await getTranslations({ locale, namespace: 'consents' });

  if (body.kind === 'risk') {
    const slug = String(body.slug ?? '');
    if (!RISK_TOOLS.has(slug))
      return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
    const event = await recordToolConsent(session, {
      type: 'risk_ack_accepted',
      surface: 'risk_modal',
      checkboxText: t('risk.check'),
      buttonLabel: t('risk.cta'),
      details: { tool: slug, version: riskVersion(), tool_name: engineDisplayName(slug) },
      locale,
      // aceptacion-ux §6, word for word as the sheet showed it (BUILD-SPEC §10.3).
      disclosureText: t.markup('risk.body', {
        herramienta: engineDisplayName(slug),
        b: (c) => c,
      }),
    });
    return NextResponse.json({ ok: true, consentId: event.consent_id });
  }
  if (body.kind === 'likeness') {
    const feature = String(body.feature ?? '').slice(0, 64);
    if (!feature) return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
    const event = await recordToolConsent(session, {
      type: 'voice_likeness_consent',
      surface: 'likeness_step',
      checkboxText: t('likeness.check'),
      buttonLabel: t('likeness.cta'),
      details: { feature },
      locale,
    });
    return NextResponse.json({ ok: true, consentId: event.consent_id });
  }
  if (body.kind === 'autopublish') {
    const account = String(body.account ?? '').slice(0, 120);
    const ent = await getEntitlements(session);
    const decision = decideAutopublish({
      supportsConnect: getClipsAdapter()?.capabilities().supportsConnect ?? false,
      account,
      capAllows: TIER_CAPS[ent.plan].clipAutoPublish,
      checked: body.checked,
    });
    if (!decision.ok)
      return NextResponse.json(
        { ok: false, code: decision.reason.toUpperCase() },
        { status: decision.reason === 'consent_required' ? 422 : 403 },
      );
    const event = await recordToolConsent(session, {
      type: 'autopublish_enabled',
      surface: 'clips_autopublish',
      checkboxText: t.markup('autopublish.check', { cuenta: account, b: (c) => c }),
      buttonLabel: t('autopublish.cta'),
      details: { tool: 'chalybclip', account },
      locale,
    });
    return NextResponse.json({ ok: true, consentId: event.consent_id });
  }
  return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
}
