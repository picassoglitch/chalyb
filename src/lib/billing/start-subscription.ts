// Creating a subscription from a card token, with its consent evidence
// (rebuild P2-3, P2-4, P2-9; SCR-15). One path for:
//
//   trial    the free month (Pro anual only): first charge when it ends
//   paid     Pro mensual, VIP, or the trial was already used: first charge today
//   change   a plan change (Mensual ↔ Anual, VIP, back to Pro): first charge
//            on the effective date, the old subscription stops charging now
//
// THE MERCADO PAGO APPROACH (documented for the PR): the SDK only supports
// `free_trial` on preapproval PLANS; the card-token preapproval this app
// already uses takes `auto_recurring.start_date` — the date of the first
// charge. So the free month is a preapproval authorised today whose first
// charge is the trial end. No custom charge job.
//
// The consent rule lives HERE, on the server: without `consentChecked: true`
// nothing is created (the route answers 422), whatever the page did.

import 'server-only';
import { createHash } from 'node:crypto';
import { getTranslations } from 'next-intl/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { planHasTrial, planPrice, type PlanKey, CURRENCY } from '@/config/pricing';
import { getMercadoPago, getAppUrl, isCheckoutReady, mpGet } from '@/lib/payments/mercadopago';
import {
  normalizePreapprovalStatus,
  subscriptionReference,
} from '@/lib/payments/subscription-reference';
import { cancelPreapproval, syncSubscription } from '@/lib/payments/subscription-sync';
import { track } from '@/lib/analytics/track';
import { legalDocuments } from '@/lib/legal/documents';
import type { SessionUser } from '@/lib/auth/session';
import { trialDates, type TrialDates } from './trial-dates';
import {
  consentSentence,
  disclosureParagraphs,
  evidenceText,
  stripMarkup,
  type Translate,
} from './billing-copy';
import { recordConsent, requestContext, UI_VERSION } from './consent';
import { dispatchBillingEmail } from './notices';
import { formatFechaLarga, formatMXN } from './format';
import { paidPlansBlocked } from './quebec';
import { loadBilling } from './subscription-store';

export type StartMode = 'trial' | 'paid' | 'change';

export interface StartInput {
  session: SessionUser;
  planKey: PlanKey;
  cardTokenId: string;
  consentChecked: boolean;
  /** Where the user declared they live (P2-11), e.g. "QC". */
  declaredProvince?: string | null;
  clientTimezone?: string | null;
  locale: string;
  /** A plan change (records plan_changed, never opens a trial). */
  intent?: 'change';
  /** For a change: when the new plan starts charging (omit = today). */
  effectiveAt?: Date;
}

export type StartError =
  | 'CONSENT_REQUIRED'
  | 'NOT_CONFIGURED'
  | 'ADMIN'
  | 'QUEBEC'
  | 'CARD_TRIAL_USED'
  | 'TRIAL_ANNUAL_ONLY'
  | 'BAD_TOKEN'
  | 'DECLINED'
  | 'MP_ERROR';

export type StartResult =
  | { ok: true; consentId: string; mode: StartMode; preapprovalId: string }
  | { ok: false; code: StartError };

interface CardToken {
  first_six_digits?: string;
  last_four_digits?: string;
  expiration_month?: number;
  expiration_year?: number;
  cardholder?: { identification?: { type?: string; number?: string } };
  payment_method_id?: string;
}

/** A stable, irreversible fingerprint of the card: never card data itself. */
function fingerprint(card: CardToken): string | null {
  if (!card.first_six_digits || !card.last_four_digits || !card.expiration_year) return null;
  return createHash('sha256')
    .update(
      [
        card.first_six_digits,
        card.last_four_digits,
        card.expiration_month,
        card.expiration_year,
        card.cardholder?.identification?.number ?? '',
      ].join('|'),
    )
    .digest('hex');
}

const PLAN_NAMES: Record<PlanKey, string> = {
  pro_year: 'Pro anual',
  pro_month: 'Pro mensual',
  vip_month: 'VIP',
};

export async function startSubscription(input: StartInput): Promise<StartResult> {
  if (input.consentChecked !== true) return { ok: false, code: 'CONSENT_REQUIRED' };
  if (!isCheckoutReady()) return { ok: false, code: 'NOT_CONFIGURED' };
  const token = input.cardTokenId?.trim();
  if (!token || token.length > 128) return { ok: false, code: 'BAD_TOKEN' };
  if (paidPlansBlocked({ declared: input.declaredProvince })) return { ok: false, code: 'QUEBEC' };

  const { session } = input;
  const userId = session.user.id;
  const email = session.user.email;
  if (!email) return { ok: false, code: 'MP_ERROR' };

  const admin = createAdminClient();
  const billing = await loadBilling(userId);
  // The free month comes only with Pro anual; Mensual is charged today.
  const wantsTrial = planHasTrial(input.planKey) && !billing.trialUsed && input.intent !== 'change';
  const mode: StartMode = input.intent === 'change' ? 'change' : wantsTrial ? 'trial' : 'paid';
  const firstChargeLater = mode === 'trial' || (mode === 'change' && !!input.effectiveAt);

  // The card: last 4 for the evidence and Mi plan, a fingerprint for the
  // one-trial-per-card rule. Reading the token does not consume it.
  let card: CardToken = {};
  try {
    card = await mpGet<CardToken>(`/v1/card_tokens/${encodeURIComponent(token)}`);
  } catch (err) {
    console.warn('[billing/start] card token lookup failed; continuing without card details', err);
  }
  const fp = fingerprint(card);
  if (mode === 'trial' && fp) {
    const { data: seen } = await admin
      .from('payment_method_fingerprints')
      .select('user_id')
      .eq('hash', fp)
      .maybeSingle();
    if (seen && seen.user_id !== userId) return { ok: false, code: 'CARD_TRIAL_USED' };
  }

  const now = new Date();
  const price = planPrice(input.planKey);
  const dates: TrialDates =
    mode === 'trial'
      ? trialDates(now)
      : { startsAt: now, trialEndsAt: now, chargeAt: input.effectiveAt ?? now, reminderAt: now };

  // The texts the user saw, rendered again here exactly as the page renders
  // them, with the dates of THIS request.
  const tb = await getTranslations({ locale: input.locale, namespace: 'billing' });
  const t: Translate = (key, values) =>
    tb.markup(
      key as never,
      {
        ...(values ?? {}),
        b: (c: string) => `<b>${c}</b>`,
        terms: (c: string) => `<terms>${c}</terms>`,
      } as never,
    );
  const disclosure = { planKey: input.planKey, dates, cardLast4: null, locale: input.locale };
  const disclosureText =
    mode === 'trial' ? evidenceText(disclosureParagraphs(t, disclosure)) : null;
  const checkboxText = mode === 'trial' ? stripMarkup(consentSentence(t, disclosure)) : null;
  const tPay = await getTranslations({ locale: input.locale, namespace: 'checkout' });
  const buttonLabel = mode === 'trial' ? tPay('pay.cta') : tPay('paid.cta');

  // ── Mercado Pago ───────────────────────────────────────────────────
  const tier = price.tier;
  const reference = subscriptionReference(userId, tier);
  let preapprovalId: string;
  let status: string;
  try {
    const { preapproval } = getMercadoPago();
    const created = await preapproval.create({
      body: {
        reason: `Chalyb ${PLAN_NAMES[input.planKey]}`,
        external_reference: reference,
        payer_email: email,
        card_token_id: token,
        auto_recurring: {
          frequency: price.interval === 'year' ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: price.totalCents / 100,
          currency_id: CURRENCY,
          // The first charge: the trial end, the change date, or now.
          ...(firstChargeLater ? { start_date: dates.chargeAt.toISOString() } : {}),
        },
        back_url: `${getAppUrl()}/app/billing`,
        status: 'authorized',
      },
    });
    if (!created.id) return { ok: false, code: 'MP_ERROR' };
    preapprovalId = created.id;
    status = normalizePreapprovalStatus(created.status);
  } catch (err) {
    console.error('[billing/start] preapproval.create failed', err);
    return { ok: false, code: 'DECLINED' };
  }
  if (status !== 'authorized' && status !== 'pending') return { ok: false, code: 'DECLINED' };

  // ── Evidence, then our copy ────────────────────────────────────────
  // A subscription without its consent evidence must not survive: if the
  // event can't be stored, the preapproval is cancelled before anything is
  // charged (the trial's first charge is a month away; a paid start's first
  // charge is refunded by the cancel path's reversal handling).
  const ctx = await requestContext();
  let consent;
  try {
    consent = await recordConsent({
      event_type:
        mode === 'trial'
          ? 'trial_started'
          : mode === 'change'
            ? 'plan_changed'
            : 'subscription_started',
      user_id: userId,
      account_email: email,
      documents: legalDocuments('terminos', 'suscripcion', 'privacidad'),
      client_timezone: input.clientTimezone ?? null,
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
      locale: input.locale === 'es' ? 'es-MX' : 'en',
      surface:
        mode === 'trial'
          ? 'web_checkout_trial'
          : mode === 'change'
            ? 'web_plan_change'
            : 'web_checkout',
      ui_version: UI_VERSION,
      disclosure_text: disclosureText,
      checkbox_text: checkboxText,
      checkbox_checked: true,
      button_label: buttonLabel,
      plan_id: input.planKey,
      amount_mxn: price.totalCents / 100,
      currency: CURRENCY,
      tax_included: true,
      billing_interval: price.interval,
      trial_end_utc: mode === 'trial' ? dates.trialEndsAt.toISOString() : null,
      charge_date_utc: dates.chargeAt.toISOString(),
      reminder_date_utc: mode === 'trial' ? dates.reminderAt.toISOString() : null,
      payment_method: {
        processor: 'mercadopago',
        brand: card.payment_method_id ?? null,
        last4: card.last_four_digits ?? null,
        mp_preapproval_id: preapprovalId,
      },
      marketing_opt_in: false,
    });
  } catch (err) {
    console.error('[billing/start] consent not stored — cancelling the new preapproval', err);
    await cancelPreapproval(preapprovalId).catch((e) =>
      console.error(
        '[billing/start] COULD NOT CANCEL preapproval without evidence',
        preapprovalId,
        e,
      ),
    );
    return { ok: false, code: 'MP_ERROR' };
  }

  const exp =
    card.expiration_month && card.expiration_year
      ? `${String(card.expiration_month).padStart(2, '0')}/${String(card.expiration_year).slice(-2)}`
      : null;
  await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      tier,
      plan_key: input.planKey,
      mp_preapproval_id: preapprovalId,
      external_reference: reference,
      // Written as 'pending'; the sync below records Mercado Pago's real
      // status, which is what makes it a first activation (audit, grant).
      status: 'pending',
      amount_cents: price.totalCents,
      currency: CURRENCY,
      started_at: now.toISOString(),
      trial_ends_at: mode === 'trial' ? dates.trialEndsAt.toISOString() : null,
      next_charge_at: firstChargeLater ? dates.chargeAt.toISOString() : null,
      next_payment_date: firstChargeLater ? dates.chargeAt.toISOString() : null,
      reminder_due_at: mode === 'trial' ? dates.reminderAt.toISOString() : null,
      card_brand: card.payment_method_id ?? null,
      card_last4: card.last_four_digits ?? null,
      card_exp: exp,
      consent_id: consent.consent_id,
    },
    { onConflict: 'mp_preapproval_id' },
  );
  if (mode === 'trial') {
    await admin
      .from('profiles')
      .update({
        pro_trial_started_at: now.toISOString(),
        pro_trial_ends_at: dates.trialEndsAt.toISOString(),
      })
      .eq('id', userId)
      .is('pro_trial_started_at', null);
    if (fp)
      await admin
        .from('payment_method_fingerprints')
        .upsert({ hash: fp, user_id: userId }, { onConflict: 'hash', ignoreDuplicates: true });
  }

  // Same path the webhook takes: grants the plan, retires an older
  // subscription (it stops charging now; its paid access is kept by
  // access_until), and keeps our copy in step.
  try {
    await syncSubscription(preapprovalId);
  } catch (err) {
    console.error('[billing/start] immediate sync failed; the webhook will finish it', err);
  }

  if (mode === 'trial') {
    const name = (session.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? '';
    const docs = legalDocuments('terminos', 'suscripcion', 'privacidad');
    const labels: Record<string, string> = {
      terminos: 'Términos y Condiciones',
      suscripcion: 'Términos de Suscripción',
      privacidad: 'Aviso de Privacidad',
    };
    const isYear = price.interval === 'year';
    await dispatchBillingEmail({
      userId,
      email,
      kind: 'trial_welcome',
      periodKey: consent.consent_id,
      evidence: undefined,
      vars: {
        nombre: name,
        plan: PLAN_NAMES[input.planKey],
        monto: formatMXN(price.totalCents),
        renovacion: `${isYear ? 'cada año' : 'cada mes'} (${formatMXN(price.totalCents)} MXN)`,
        fecha_inicio: formatFechaLarga(now, 'es'),
        fecha_fin_prueba: formatFechaLarga(dates.trialEndsAt, 'es'),
        fecha_cobro: formatFechaLarga(dates.chargeAt, 'es'),
        fecha_recordatorio: formatFechaLarga(dates.reminderAt, 'es'),
        ultimos4: card.last_four_digits,
        consent_id: consent.consent_id,
        documentos: docs.map((d) => ({
          label: labels[d.doc] ?? d.doc,
          version: d.version,
          url: d.url,
        })),
        appUrl: getAppUrl(),
      },
    });
    void track('trial_start', {
      plan: price.interval === 'year' ? 'anual' : 'mensual',
      source: 'app',
    });
  }

  return { ok: true, consentId: consent.consent_id, mode, preapprovalId };
}
