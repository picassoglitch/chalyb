// POST /api/billing/trial — start the free Pro month (or, if the account
// already used it, the paid plan) from a card token (SCR-15).
//
// 422 without `consentChecked: true`. The rule lives here, not only in the
// button: a direct POST without consent creates nothing.

import { NextResponse } from 'next/server';
import { billingToggleEnabled } from '@/lib/config/settings';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { paidCheckoutEnabled, vipYearEnabled } from '@/lib/config/flags';
import { startSubscription } from '@/lib/billing/start-subscription';
import { PLAN_KEYS, planOnSale, statusForStartError } from '@/lib/billing/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }
  if (body.consentChecked !== true) {
    return NextResponse.json({ ok: false, code: 'CONSENT_REQUIRED' }, { status: 422 });
  }
  // The trial and the paid checkout share this route; the trial itself is
  // decided in startSubscription (TRIAL_FLOW_ENABLED + unused trial).
  if (!paidCheckoutEnabled())
    return NextResponse.json({ ok: false, code: 'NOT_AVAILABLE' }, { status: 404 });
  if (isAdminRole(session.role))
    return NextResponse.json({ ok: false, code: 'ADMIN' }, { status: 403 });
  const planKey = String(body.planKey ?? '');
  // Mensual only while the owner offers it (P5-6).
  if (planKey === 'pro_month' && !(await billingToggleEnabled())) {
    return NextResponse.json({ ok: false, code: 'NOT_AVAILABLE' }, { status: 409 });
  }
  if (!planOnSale(planKey, vipYearEnabled())) {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }

  const result = await startSubscription({
    session,
    planKey: planKey as (typeof PLAN_KEYS)[number],
    cardTokenId: String(body.cardTokenId ?? ''),
    consentChecked: true,
    declaredProvince: typeof body.province === 'string' ? body.province : null,
    clientTimezone: typeof body.timezone === 'string' ? body.timezone : null,
    locale: body.locale === 'en' ? 'en' : 'es',
  });
  if (!result.ok) return NextResponse.json(result, { status: statusForStartError(result.code) });
  return NextResponse.json(result);
}
