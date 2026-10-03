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
import {
  lealtadPriceCents,
  planHasTrial,
  planPrice,
  type PlanKey,
  CURRENCY,
} from '@/config/pricing';
import { lealtadCalendar, resumeStep } from './lealtad';
import {
  getMercadoPago,
  getAppUrl,
  isCheckoutReady,
  logMpCreate,
  mpErrorCodeOf,
  mpGet,
  mpPayerEmail,
  mpReturnUrl,
  sellerMatches,
} from '@/lib/payments/mercadopago';
import {
  normalizePreapprovalStatus,
  subscriptionReference,
} from '@/lib/payments/subscription-reference';
import { cancelPreapproval, syncSubscription } from '@/lib/payments/subscription-sync';
import { track } from '@/lib/analytics/track';
import { legalDocuments } from '@/lib/legal/documents';
import type { SessionUser } from '@/lib/auth/session';
import { addInterval, trialDates, type TrialDates } from './trial-dates';
import { formatFechaLarga, formatMXN } from './format';
import {
  lealtadEnabled,
  lealtadOpenToNewCustomers,
  lealtadReturnWindowDays,
  trialFlowEnabled,
  chargebackRefuseNewSubscriptions,
} from '@/lib/config/flags';
import {
  consentSentence,
  disclosureParagraphs,
  lealtadCheckoutParagraphs,
  lealtadConsentSentence,
  lealtadVars,
  paidConsentSentence,
  paidParagraphs,
  evidenceText,
  stripMarkup,
  type Translate,
} from './billing-copy';
import { recordConsent, requestContext, UI_VERSION } from './consent';
import { dispatchBillingEmail, trialNoticeVars } from './notices';
import { trialNoticeKey } from './reminders';
import { paidPlansBlocked } from './quebec';
import { loadBilling } from './subscription-store';
import { PLAN_NAMES } from '@/lib/billing/plan-names';

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
  | 'ACCOUNT_CLOSED'
  | 'PAID_REFUSED'
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
  // B33: the test buyer in `test`, the user in `prod`; never mixed.
  const payerEmail = mpPayerEmail(email);
  if (!payerEmail) {
    console.error('[billing/start] no payer email for this Mercado Pago environment');
    return { ok: false, code: 'NOT_CONFIGURED' };
  }
  if (!(await sellerMatches())) return { ok: false, code: 'NOT_CONFIGURED' };
  // Pro Lealtad (WS-7): only with its flag, and only while it is open to
  // new customers (Términos 4 bis.3: existing schedules continue).
  const lealtad = input.planKey === 'pro_lealtad';
  if (lealtad && !(lealtadEnabled() && lealtadOpenToNewCustomers())) {
    return { ok: false, code: 'NOT_CONFIGURED' };
  }

  const admin = createAdminClient();
  const billing = await loadBilling(userId);
  // WS-8 · only after a bad-faith chargeback, and only with the flags on
  // (rows exist only then): a closed account can't start a paid plan
  // (Términos §10.6); refusing new paid plans is its own flag (§10.8).
  // prepayment_required already counts as trialUsed (no trial, pay today).
  if (billing.restriction.closed) return { ok: false, code: 'ACCOUNT_CLOSED' };
  if (billing.restriction.prepaymentRequired && chargebackRefuseNewSubscriptions())
    return { ok: false, code: 'PAID_REFUSED' };
  // 7 days free on Pro mensual and Pro anual, once per account (and card).
  const wantsTrial =
    trialFlowEnabled() &&
    planHasTrial(input.planKey) &&
    !billing.trialUsed &&
    input.intent !== 'change';
  // Buying a plan from Gratis through the change page (e.g. VIP anual) is a
  // new subscription, not a change: subscription_started, charged today.
  const changing = input.intent === 'change' && billing.primary.state !== 'free';
  const mode: StartMode = changing ? 'change' : wantsTrial ? 'trial' : 'paid';
  // T-6 · switching Pro mensual ↔ Pro anual during the trial: same charge
  // date, the new plan's amount, the trial's own disclosure and checkbox,
  // and a fresh charge notice (a new amount is a new notice).
  const trialSwitch =
    mode === 'change' &&
    billing.primary.state === 'trialing' &&
    planHasTrial(input.planKey) &&
    !!billing.primary.trialEndsAt;
  const trialLike = mode === 'trial' || trialSwitch;
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
  // Pro Lealtad starts at month 1, or where it was within the optional
  // return window (O-15, default off); every other plan at its price.
  let startStep = 0;
  if (lealtad && lealtadReturnWindowDays() > 0) {
    const { data: last } = await admin
      .from('subscriptions')
      .select('loyalty_step, ended_at, access_until')
      .eq('user_id', userId)
      .eq('plan_key', 'pro_lealtad')
      .eq('status', 'cancelled')
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const ended = (last?.access_until ?? last?.ended_at) as string | null | undefined;
    startStep = resumeStep({
      windowDays: lealtadReturnWindowDays(),
      lastCancelledEndedAt: ended ? new Date(ended) : null,
      lastStep: (last?.loyalty_step as number | null) ?? null,
      now: new Date(),
    });
  }
  const chargeCents = lealtad ? lealtadPriceCents(startStep) : price.totalCents;
  const switchEnds = trialSwitch ? new Date(billing.primary.trialEndsAt as string) : null;
  const dates: TrialDates =
    mode === 'trial'
      ? trialDates(now)
      : switchEnds
        ? { startsAt: now, trialEndsAt: switchEnds, chargeAt: switchEnds, reminderAt: now }
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
  // What the page showed, by path: the trial block; a charge today (new
  // plan, or a change that applies now): Law's paid block and checkbox; a
  // change at a later date: the change checkbox.
  const paidInput = {
    planKey: input.planKey,
    renewalAt: addInterval(now, price.interval),
    cardLast4: null,
    locale: input.locale,
  };
  const chargedToday = !trialLike && (mode === 'paid' || !firstChargeLater);
  const tChangeText = await getTranslations({ locale: input.locale, namespace: 'change' });
  // Pro Lealtad: Law's checkout block with the real dates, from the first
  // charge (today, or when the current plan ends).
  const lealtadStart = firstChargeLater ? dates.chargeAt : now;
  const disclosureText = lealtad
    ? evidenceText(
        lealtadCheckoutParagraphs(t, {
          start: lealtadStart,
          cardLast4: null,
          locale: input.locale,
        }),
      )
    : trialLike
      ? evidenceText(disclosureParagraphs(t, disclosure))
      : chargedToday
        ? evidenceText(paidParagraphs(t, paidInput))
        : null;
  const checkboxText = lealtad
    ? stripMarkup(lealtadConsentSentence(t))
    : trialLike
      ? stripMarkup(consentSentence(t, disclosure))
      : chargedToday
        ? stripMarkup(paidConsentSentence(t, paidInput))
        : stripMarkup(
            tChangeText.markup('consent', {
              monto: formatMXN(price.totalCents),
              renovacion_corta: tb(
                price.interval === 'year'
                  ? 'vars.renovacionCorta.year'
                  : 'vars.renovacionCorta.month',
              ),
              fecha: formatFechaLarga(dates.chargeAt, input.locale),
              b: (c: string) => `<b>${c}</b>`,
              terms: (c: string) => `<terms>${c}</terms>`,
            }),
          );
  const tPay = await getTranslations({ locale: input.locale, namespace: 'checkout' });
  const tChange = await getTranslations({ locale: input.locale, namespace: 'change' });
  const tPlansBtn = await getTranslations({ locale: input.locale, namespace: 'plans' });
  const buttonLabel = lealtad
    ? tPlansBtn('lealtad.cta', { m1: lealtadVars().m1 })
    : mode === 'trial'
      ? tPay('pay.cta')
      : mode === 'change'
        ? tChange('cta')
        : tPay('paid.cta');

  // ── Mercado Pago ───────────────────────────────────────────────────
  const tier = price.tier;
  const reference = subscriptionReference(userId, tier);
  let backUrl: string;
  try {
    backUrl = mpReturnUrl('/app/billing');
  } catch (err) {
    console.error(err);
    return { ok: false, code: 'NOT_CONFIGURED' };
  }
  let preapprovalId: string;
  let status: string;
  try {
    const { preapproval } = getMercadoPago();
    const created = await preapproval.create({
      body: {
        reason: `Chalyb ${PLAN_NAMES[input.planKey]}`,
        external_reference: reference,
        payer_email: payerEmail,
        card_token_id: token,
        auto_recurring: {
          frequency: price.interval === 'year' ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: chargeCents / 100,
          currency_id: CURRENCY,
          // The first charge: the trial end, the change date, or now.
          ...(firstChargeLater ? { start_date: dates.chargeAt.toISOString() } : {}),
        },
        back_url: backUrl,
        status: 'authorized',
      },
    });
    logMpCreate('preapproval', { id: created.id, externalReference: reference });
    if (!created.id) return { ok: false, code: 'MP_ERROR' };
    preapprovalId = created.id;
    status = normalizePreapprovalStatus(created.status);
  } catch (err) {
    // B36: the MP code (e.g. CC_VAL_433) goes to the log; the customer gets
    // the friendly card error that DECLINED maps to.
    console.error(
      '[billing/start] preapproval.create failed',
      { mp_code: mpErrorCodeOf(err) },
      err,
    );
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
      event_type: lealtad
        ? 'lealtad_started'
        : mode === 'trial'
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
      amount_mxn: chargeCents / 100,
      currency: CURRENCY,
      tax_included: true,
      billing_interval: price.interval,
      trial_end_utc: trialLike ? dates.trialEndsAt.toISOString() : null,
      charge_date_utc: dates.chargeAt.toISOString(),
      reminder_date_utc: trialLike ? dates.reminderAt.toISOString() : null,
      payment_method: {
        processor: 'mercadopago',
        brand: card.payment_method_id ?? null,
        last4: card.last_four_digits ?? null,
        mp_preapproval_id: preapprovalId,
      },
      marketing_opt_in: false,
      ...(lealtad
        ? {
            details: {
              start_step: String(startStep),
              schedule: lealtadCalendar(lealtadStart)
                .map((c) => `${c.date.toISOString().slice(0, 10)}=${c.cents}`)
                .join(','),
            },
          }
        : {}),
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
      amount_cents: chargeCents,
      ...(lealtad ? { loyalty_step: startStep, loyalty_mp_amount_cents: chargeCents } : {}),
      currency: CURRENCY,
      started_at: now.toISOString(),
      trial_ends_at: trialLike ? dates.trialEndsAt.toISOString() : null,
      next_charge_at: firstChargeLater ? dates.chargeAt.toISOString() : null,
      next_payment_date: firstChargeLater ? dates.chargeAt.toISOString() : null,
      reminder_due_at: trialLike ? dates.reminderAt.toISOString() : null,
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

  // The charge notice, sent now (aceptacion-ux §3.6): on day 0 it is 7 days
  // before the charge, the legal ≥5-day notice AND the confirmation. Nothing
  // else goes in it (no welcome, no marketing: C1a). Its delivery gates the
  // charge (the hold rule); the cron uses the same key, so it goes out once.
  // Pro Lealtad: the confirmation with the whole calendar (aceptacion-ux §4.2).
  if (lealtad) {
    const name = (session.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? '';
    const v = lealtadVars();
    await dispatchBillingEmail({
      userId,
      email,
      kind: 'lealtad_started',
      periodKey: consent.consent_id,
      vars: {
        nombre: name,
        plan: 'Pro Lealtad',
        monto: v.m1,
        reinicio: v.m1,
        fecha_hoy: formatFechaLarga(lealtadStart, 'es'),
        ultimos4: card.last_four_digits,
        calendario: lealtadCalendar(lealtadStart)
          .slice(1)
          .map((c, i, all) => ({
            fecha: formatFechaLarga(c.date, 'es'),
            monto: formatMXN(c.cents),
            desde: i === all.length - 1,
          })),
        consent_id: consent.consent_id,
        version_sus: legalDocuments('suscripcion')[0]?.version,
        appUrl: getAppUrl(),
      },
    });
  }

  if (trialLike) {
    const name = (session.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? '';
    await dispatchBillingEmail({
      userId,
      email,
      kind: 'trial_7d',
      periodKey: trialNoticeKey(dates.chargeAt, preapprovalId),
      evidence: 'charge_notice_sent',
      vars: trialNoticeVars({
        nombre: name,
        planKey: input.planKey,
        startedAt: trialSwitch
          ? ((billing.primaryRow?.started_at as string | undefined) ?? now)
          : now,
        trialEndsAt: dates.trialEndsAt,
        chargeAt: dates.chargeAt,
        last4: card.last_four_digits ?? null,
        consentId: consent.consent_id,
        appUrl: getAppUrl(),
      }),
    });
    if (mode === 'trial') {
      void track('trial_start', {
        plan: price.interval === 'year' ? 'anual' : 'mensual',
        source: 'app',
      });
    }
  }

  return { ok: true, consentId: consent.consent_id, mode, preapprovalId };
}
