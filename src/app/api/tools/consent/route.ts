// POST /api/tools/consent — the risk notice and the AI likeness step. 422
// without the box ticked; the texts stored are the ones the page showed,
// rendered again here from the same messages.

import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth/session';
import { RISK_TOOLS } from '@/lib/tools/routes';
import { engineDisplayName } from '@/lib/engines/display-names';
import { recordToolConsent, riskVersion } from '@/lib/tools/consents';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.checked !== true)
    return NextResponse.json({ ok: false, code: 'CONSENT_REQUIRED' }, { status: 422 });
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
  return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
}
