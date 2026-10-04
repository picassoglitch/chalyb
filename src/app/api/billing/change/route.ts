// POST /api/billing/change — change plan, switch the trial's plan, upgrade
// to VIP, or reactivate (SCR-30). Needs the card again (single-use tokens)
// and the recurring-charge checkbox: 422 without it.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { termsAcceptancePending } from '@/lib/legal/reaccept-server';
import { isAdminRole } from '@/lib/billing/tiers';
import { changePlan } from '@/lib/billing/billing-actions';
import { PLAN_KEYS, planOnSale, statusForStartError } from '@/lib/billing/api';
import {
  paidCheckoutEnabled,
  vipYearEnabled,
  lealtadEnabled,
  lealtadOpenToNewCustomers,
} from '@/lib/config/flags';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.consentChecked !== true) {
    return NextResponse.json({ ok: false, code: 'CONSENT_REQUIRED' }, { status: 422 });
  }
  // Plan changes create charges: only with paid checkout live (V-1).
  if (!paidCheckoutEnabled())
    return NextResponse.json({ ok: false, code: 'NOT_AVAILABLE' }, { status: 404 });
  if (isAdminRole(session.role))
    return NextResponse.json({ ok: false, code: 'ADMIN' }, { status: 403 });
  // aceptacion-ux §8: no new charge under Terms the person hasn't accepted.
  if (await termsAcceptancePending(session.user.id))
    return NextResponse.json({ ok: false, code: 'TERMS_PENDING' }, { status: 409 });
  const planKey = String(body.planKey ?? '');
  if (!planOnSale(planKey, vipYearEnabled(), lealtadEnabled() && lealtadOpenToNewCustomers())) {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }
  const result = await changePlan({
    session,
    planKey: planKey as (typeof PLAN_KEYS)[number],
    cardTokenId: String(body.cardTokenId ?? ''),
    consentChecked: true,
    locale: body.locale === 'en' ? 'en' : 'es',
    clientTimezone: typeof body.timezone === 'string' ? body.timezone : null,
  });
  if (!result.ok) return NextResponse.json(result, { status: statusForStartError(result.code) });
  return NextResponse.json(result);
}
