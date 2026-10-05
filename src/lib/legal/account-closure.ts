// Closing an account from Mi cuenta (Términos y Condiciones §13.1; Paquetes
// §5.2), server side. The closure itself is an ARCO cancellation request
// (Aviso de privacidad §5), handled by the privacy team within its legal
// deadline; a plan that still charges is cancelled first through the same
// path as Mi plan → Cancelar, so nothing is charged while the request runs.

import 'server-only';
import { getTranslations } from 'next-intl/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SessionUser } from '@/lib/auth/session';
import { loadBilling } from '@/lib/billing/subscription-store';
import { cancelForUser } from '@/lib/billing/billing-actions';
import { formatFechaLarga } from '@/lib/billing/format';
import { getTokenBalance } from '@/lib/usage/tokens';
import { submitArco } from './legal-server';
import {
  closurePlan,
  closureRefusal,
  closureRequestText,
  type ClosurePlan,
  type ClosureRefusal,
} from './account-closure-core';

/**
 * Extra (pack) credits not used yet, or null when they can't be read.
 *
 * Interim: today packs land in one bucket (profiles.token_bonus_balance) and
 * the plan's monthly credits are spent first, so the unused extras are what
 * is left of that bucket. TODO(packs 0061): swap the body for
 *   const s = await getPackSummary(userId); return s.available + s.held;
 * (src/lib/usage/packs.ts, claude/token-packs-terms) once it lands.
 */
export async function unusedPackCredits(userId: string): Promise<number | null> {
  try {
    const b = await getTokenBalance(userId);
    return b.unlimited ? b.bonus : Math.max(0, Math.min(b.bonus, b.remaining));
  } catch (err) {
    console.error('[closure] pack credits unreadable', err);
    return null;
  }
}

export interface ClosureSummary {
  credits: number | null;
  plan: ClosurePlan;
  /** An ARCO cancellation request still waiting for its answer. */
  open: { receivedAt: string; respondBy: string } | null;
}

async function openClosureRequest(userId: string) {
  const { data } = await createAdminClient()
    .from('arco_requests')
    .select('received_at, respond_by')
    .eq('user_id', userId)
    .eq('right_kind', 'cancellation')
    .is('responded_at', null)
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? { receivedAt: data.received_at as string, respondBy: data.respond_by as string }
    : null;
}

export async function closureSummary(userId: string): Promise<ClosureSummary> {
  const [credits, billing, open] = await Promise.all([
    unusedPackCredits(userId),
    loadBilling(userId),
    openClosureRequest(userId),
  ]);
  return { credits, plan: closurePlan(billing.primary), open };
}

/** The warning exactly as the screen shows it (stored as evidence). */
export async function closureWarningText(
  credits: number,
  plan: ClosurePlan,
  locale: string,
): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'closeAccount' });
  const fecha = (iso: string | null) => (iso ? formatFechaLarga(iso, locale) : '');
  const lines = [
    credits > 0 ? t('credits.some', { n: credits }) : t('credits.none'),
    plan.kind === 'charging'
      ? plan.until
        ? t('plan.charging', { fecha: fecha(plan.until) })
        : t('plan.chargingNoDate')
      : plan.kind === 'ending'
        ? t('plan.ending')
        : t('plan.none'),
    t('after'),
  ];
  return lines.join('\n');
}

export type CloseResult =
  | { ok: true; respondBy: string }
  | { ok: false; code: ClosureRefusal | 'mp_error' | 'rateLimited' | 'db' | 'send' };

export async function closeAccount(
  session: SessionUser,
  input: { creditsShown: unknown; confirmed: unknown; locale: string },
): Promise<CloseResult> {
  const userId = session.user.id;
  const { credits, plan, open } = await closureSummary(userId);
  const refusal = closureRefusal({
    creditsNow: credits,
    creditsShown: input.creditsShown,
    confirmed: input.confirmed,
    openRequest: !!open,
  });
  if (refusal) return { ok: false, code: refusal };
  const shown = credits as number;

  // No more charges while the request runs: cancel first, and stop here if
  // Mercado Pago refuses (a retry finds it cancelled and goes on).
  let cancelFolio: string | null = null;
  if (plan.kind === 'charging') {
    const t = await getTranslations({ locale: input.locale, namespace: 'closeAccount' });
    const cancel = await cancelForUser(
      {
        id: userId,
        email: session.user.email ?? null,
        fullName: (session.user.user_metadata?.full_name as string | undefined) ?? null,
      },
      {
        offerShown: false,
        locale: input.locale,
        surface: 'account_closure',
        buttonLabel: t('cta'),
      },
    );
    if (!cancel.ok && cancel.code === 'MP_ERROR') return { ok: false, code: 'mp_error' };
    if (cancel.ok) cancelFolio = cancel.folio;
  }

  const t = await getTranslations({ locale: input.locale, namespace: 'closeAccount' });
  const res = await submitArco(
    session,
    {
      right: 'cancellation',
      description: closureRequestText({ credits: shown, plan, cancelFolio }),
    },
    input.locale,
    {
      surface: 'account_closure',
      disclosureText: await closureWarningText(shown, plan, input.locale),
      checkboxText: t('check'),
      buttonLabel: t('cta'),
      details: {
        pack_credits_unused: shown,
        plan: plan.kind,
        cancel_folio: cancelFolio,
      },
    },
  );
  if (!res.ok)
    return { ok: false, code: res.code === 'rateLimited' || res.code === 'db' ? res.code : 'send' };
  return { ok: true, respondBy: res.respondBy };
}
