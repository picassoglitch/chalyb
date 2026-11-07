// Creating a subscription from a card token, with its consent evidence
// (rebuild P2-3, P2-4, P2-9; SCR-15). One path for:
//
//   trial    the 7-day trial (any plan, first time only): first charge when it ends
//   paid     the trial was already used (or Pro Lealtad): first charge today
//   change   a plan change (Mensual ↔ Anual, VIP, back to Pro): first charge
//            on the effective date, the old subscription stops charging now
//
// THE MERCADO PAGO APPROACH (documented for the PR): the SDK only supports
// `free_trial` on preapproval PLANS; the card-token preapproval this app
// already uses takes `auto_recurring.start_date` — the date of the first
// charge. So the 7-day trial is a preapproval authorised today whose first
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
  getMercadoPagoIsolated,
  getAppUrl,
  getMpEnv,
  cachedSellerEmail,
  isCheckoutReady,
  logMpCreate,
  mpErrorCodeOf,
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
import {
  addInterval,
  switchChargeDate,
  switchMovesCharge,
  trialDates,
  type TrialDates,
} from './trial-dates';
import { formatFechaLarga, formatMXN } from './format';
import {
  lealtadEnabled,
  lealtadOpenToNewCustomers,
  lealtadReturnWindowDays,
  paidCheckoutEnabled,
  trialFlowEnabled,
  chargebackRefuseNewSubscriptions,
  mpPayerEmailEditable,
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
import { trialCardCheck } from './trial-eligibility';
import { PLAN_NAMES } from '@/lib/billing/plan-names';
import {
  alertChargedWithoutRow,
  cancelUnchargedWithoutRow,
} from '@/lib/payments/unrecorded-preapproval';
import { writeRowWithRetry } from '@/lib/payments/row-retry';
import {
  declineReasonOf,
  rejectionDetailOf,
  type DeclineReason,
} from '@/lib/payments/card-decline';
import { meliSessionOptions } from '@/lib/payments/device-session';
import { choosePayerEmail, payerIsSeller } from '@/lib/payments/payer-email';
import { refundProration } from './proration-refund';
import { notify } from '@/lib/notifications/notify';
import { getStripe, isStripeReady, usingStripe } from '@/lib/payments/stripe';
import {
  confirmOrReadBack,
  createStripeSubscription,
  parseStartMeta,
  readConfirmationToken,
  STRIPE_START_EXPAND,
  stripeStartState,
  type StartMeta,
} from './stripe-start';

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
  /** MP_DEVICE_SESSION_ID from the card form, sent as X-meli-session-id. */
  deviceSessionId?: string | null;
  /** The buyer's Mercado Pago email from the form (MP_PAYER_EMAIL_EDITABLE). */
  mpPayerEmail?: string | null;
  /** A change's refund of the old period; a Stripe start that waits on 3DS runs it at finalize. */
  prorationRefund?: { paymentId: string; cents: number };
}

export type StartError =
  | 'CONSENT_REQUIRED'
  | 'NOT_CONFIGURED'
  | 'ADMIN'
  | 'QUEBEC'
  | 'CARD_TRIAL_USED'
  | 'CARD_UNVERIFIED'
  | 'ACCOUNT_CLOSED'
  | 'PAID_REFUSED'
  | 'BAD_TOKEN'
  | 'DECLINED'
  | 'MP_ERROR'
  // Stripe wants the buyer's bank (3DS): the page runs it, then calls finalize.
  | 'REQUIRES_ACTION'
  // Charged, but neither our row nor the fallback could be written: the team is
  // alerted and the customer must not pay again.
  | 'CHARGED_NO_PLAN';

export type StartResult =
  | { ok: true; consentId: string; mode: StartMode; preapprovalId: string }
  | { ok: false; code: 'REQUIRES_ACTION'; clientSecret: string; subscriptionId: string }
  | { ok: false; code: Exclude<StartError, 'REQUIRES_ACTION'>; decline?: DeclineReason };

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
  const stripe = usingStripe();
  if (!(stripe ? isStripeReady() : isCheckoutReady())) return { ok: false, code: 'NOT_CONFIGURED' };
  // The routes that call this check it too; refuse here as well so no new
  // caller can sell while paid checkout is off.
  if (!paidCheckoutEnabled()) return { ok: false, code: 'NOT_CONFIGURED' };
  const token = input.cardTokenId?.trim();
  if (!token || token.length > 128) return { ok: false, code: 'BAD_TOKEN' };
  if (paidPlansBlocked({ declared: input.declaredProvince })) return { ok: false, code: 'QUEBEC' };

  const { session } = input;
  const userId = session.user.id;
  const email = session.user.email;
  if (!email) return { ok: false, code: 'MP_ERROR' };
  let payerEmail = email;
  let payerAudit: Record<string, unknown> = {};
  if (!stripe) {
    // B33: the test buyer in `test`, the user in `prod`; never mixed.
    const accountPayerEmail = mpPayerEmail(email);
    if (!accountPayerEmail) {
      console.error('[billing/start] no payer email for this Mercado Pago environment');
      return { ok: false, code: 'NOT_CONFIGURED' };
    }
    if (!(await sellerMatches())) return { ok: false, code: 'NOT_CONFIGURED' };
    const payer = choosePayerEmail({
      accountPayerEmail,
      formEmail: input.mpPayerEmail,
      editable: mpPayerEmailEditable(),
      mpEnv: getMpEnv(),
    });
    payerEmail = payer.email;
    // Booleans only: tells a self-charge (seller's own account) from a mismatch.
    payerAudit = {
      payer_email_source: payer.source,
      payer_is_seller: payerIsSeller(payerEmail, cachedSellerEmail()),
    };
  }
  // Pro Lealtad (WS-7): only with its flag, and only while it is open to
  // new customers (Términos 4 bis.3: existing schedules continue).
  const lealtad = input.planKey === 'pro_lealtad';
  if (lealtad && !(lealtadEnabled() && lealtadOpenToNewCustomers())) {
    return { ok: false, code: 'NOT_CONFIGURED' };
  }
  // Its amount changes every month through the MP-only amount update; not sold on Stripe yet.
  if (lealtad && stripe) return { ok: false, code: 'NOT_CONFIGURED' };

  const admin = createAdminClient();
  const billing = await loadBilling(userId);
  // WS-8 · only after a bad-faith chargeback, and only with the flags on
  // (rows exist only then): a closed account can't start a paid plan
  // (Términos §10.6); refusing new paid plans is its own flag (§10.8).
  // prepayment_required already counts as trialUsed (no trial, pay today).
  if (billing.restriction.closed) return { ok: false, code: 'ACCOUNT_CLOSED' };
  if (billing.restriction.prepaymentRequired && chargebackRefuseNewSubscriptions())
    return { ok: false, code: 'PAID_REFUSED' };
  // 7 days free on any plan, for first-time customers only: once per
  // account (and card), never after a charged subscription (trialUsed).
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
  let fp: string | null;
  if (stripe) {
    let sc;
    try {
      sc = await readConfirmationToken(token);
    } catch (err) {
      console.error('[billing/start] stripe unreachable reading the card', err);
      return { ok: false, code: 'MP_ERROR' };
    }
    if (!sc) return { ok: false, code: 'BAD_TOKEN' };
    card = {
      last_four_digits: sc.last4 ?? undefined,
      expiration_month: sc.expMonth ?? undefined,
      expiration_year: sc.expYear ?? undefined,
      payment_method_id: sc.brand ?? undefined,
    };
    fp = sc.fingerprint;
  } else {
    try {
      card = (await getMercadoPago().cardToken.get({ id: token })) as CardToken;
    } catch (err) {
      console.warn('[billing/start] card token lookup failed; continuing without card details', err);
    }
    fp = fingerprint(card);
  }
  // One trial per card: a card we can't fingerprint gets no trial (fail
  // closed). The customer saw the trial terms, not a charge today, so this
  // is an error to retry, never a silent switch to the paid path.
  const cardCheck = trialCardCheck({ mode, fingerprint: fp, seenUserId: undefined, userId });
  if (!cardCheck.ok) return { ok: false, code: cardCheck.code };
  if (mode === 'trial' && fp) {
    const { data: seen } = await admin
      .from('payment_method_fingerprints')
      .select('user_id')
      .eq('hash', fp)
      .maybeSingle();
    const seenCheck = trialCardCheck({
      mode,
      fingerprint: fp,
      seenUserId: (seen?.user_id as string | undefined) ?? null,
      userId,
    });
    if (!seenCheck.ok) return { ok: false, code: seenCheck.code };
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
  // T-6: the switch's fresh notice goes out now, so its charge comes at
  // least 5 days later — pushed past the trial's end when the switch is late
  // (owner, 2026-10-03); the trial runs to the same instant.
  const originalTrialEnd = trialSwitch ? new Date(billing.primary.trialEndsAt as string) : null;
  const switchEnds = originalTrialEnd ? switchChargeDate(originalTrialEnd, now) : null;
  const switchMoved = !!originalTrialEnd && switchMovesCharge(originalTrialEnd, now);
  const trialStartedAt = (billing.primaryRow?.started_at as string | undefined) ?? null;
  const dates: TrialDates =
    mode === 'trial'
      ? trialDates(now)
      : switchEnds
        ? {
            startsAt: trialStartedAt ? new Date(trialStartedAt) : now,
            trialEndsAt: switchEnds,
            chargeAt: switchEnds,
            reminderAt: now,
          }
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
  // A trial switch: the change page's own paragraph, with the (moved) date.
  const switchParagraph = trialSwitch
    ? tChangeText(switchMoved ? 'trialSwitchMoved' : 'trialSwitch', {
        fecha: formatFechaLarga(dates.chargeAt, input.locale),
        monto: formatMXN(chargeCents),
        periodo: tb(price.interval === 'year' ? 'vars.cadaPeriodo.year' : 'vars.cadaPeriodo.month'),
      })
    : null;
  const disclosureText = lealtad
    ? evidenceText(
        lealtadCheckoutParagraphs(t, {
          start: lealtadStart,
          cardLast4: null,
          locale: input.locale,
        }),
      )
    : switchParagraph
      ? evidenceText([switchParagraph])
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

  // ── The gateway ────────────────────────────────────────────────────
  const tier = price.tier;
  const reference = subscriptionReference(userId, tier);
  let preapprovalId: string;
  let status: string;
  let stripeSub: Awaited<ReturnType<typeof createStripeSubscription>> | null = null;
  if (stripe) {
    const meta: StartMeta = {
      m: mode,
      ts: trialSwitch ? 1 : 0,
      sm: switchMoved ? 1 : 0,
      fp: fp ?? '',
      ss: trialSwitch ? String(billing.primaryRow?.started_at ?? '') : '',
      ...(input.prorationRefund
        ? { rp: input.prorationRefund.paymentId, rc: input.prorationRefund.cents }
        : {}),
    };
    try {
      stripeSub = await createStripeSubscription({
        user: {
          id: userId,
          email,
          name: (session.user.user_metadata?.full_name as string | undefined) ?? null,
        },
        planKey: input.planKey,
        reference,
        firstChargeAt: firstChargeLater ? Math.floor(dates.chargeAt.getTime() / 1000) : null,
        confirmationToken: token,
        meta,
      });
    } catch (err) {
      console.error('[billing/start] stripe subscription create failed', err);
      return { ok: false, code: 'MP_ERROR' };
    }
    preapprovalId = stripeSub.id;
    status = 'pending';
  } else {
    let backUrl: string;
    try {
      backUrl = mpReturnUrl('/app/billing');
    } catch (err) {
      console.error(err);
      return { ok: false, code: 'NOT_CONFIGURED' };
    }
    try {
      // Isolated: the SDK keeps a call's requestOptions on its client for good.
      const { preapproval } = getMercadoPagoIsolated();
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
        requestOptions: meliSessionOptions(input.deviceSessionId),
      });
      logMpCreate('preapproval', { id: created.id, externalReference: reference });
      console.info('[billing/start] preapproval payer', payerAudit);
      if (!created.id) return { ok: false, code: 'MP_ERROR' };
      preapprovalId = created.id;
      status = normalizePreapprovalStatus(created.status);
    } catch (err) {
      // B36: the MP codes go to the log; the customer gets the sentence for
      // the kind of decline (a risk rejection is not the bank's).
      const detail = rejectionDetailOf(err);
      console.error(
        '[billing/start] preapproval.create failed',
        { mp_code: mpErrorCodeOf(err), status_detail: detail, ...payerAudit },
        err,
      );
      return { ok: false, code: 'DECLINED', decline: declineReasonOf(detail) };
    }
    if (status !== 'authorized' && status !== 'pending') {
      return { ok: false, code: 'DECLINED', decline: 'unknown' };
    }
  }

  // ── Evidence, then our copy ────────────────────────────────────────
  // A subscription without its consent evidence must not survive: if the
  // event can't be stored, the preapproval is cancelled. A trial is cancelled
  // before any charge; a paid start's first charge is NOT refunded here.
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
        processor: stripe ? 'stripe' : 'mercadopago',
        brand: card.payment_method_id ?? null,
        last4: card.last_four_digits ?? null,
        ...(stripe
          ? { stripe_subscription_id: preapprovalId }
          : { mp_preapproval_id: preapprovalId }),
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
  const rowErr = await writeRowWithRetry(() =>
    admin.from('subscriptions').upsert(
      {
        user_id: userId,
        tier,
        plan_key: input.planKey,
        mp_preapproval_id: preapprovalId,
        ...(stripe ? { provider: 'stripe' } : {}),
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
        // Fixed at creation: dates the deadline if this never charges (0057).
        first_charge_at: dates.chargeAt.toISOString(),
        next_payment_date: firstChargeLater ? dates.chargeAt.toISOString() : null,
        reminder_due_at: trialLike ? dates.reminderAt.toISOString() : null,
        card_brand: card.payment_method_id ?? null,
        card_last4: card.last_four_digits ?? null,
        card_exp: exp,
        consent_id: consent.consent_id,
      },
      { onConflict: 'mp_preapproval_id' },
    ),
  );
  // No money taken yet: cancel. Already charged: cancelling would keep the
  // money and give nothing, so carry on and let the webhook build the row.
  if (rowErr) {
    console.error('[billing/start] subscriptions row not stored', preapprovalId, rowErr);
    const who = { userId, preapprovalId, source: 'billing.start' };
    // Stripe has charged nothing yet either: its payment is confirmed only below.
    if (firstChargeLater || stripe) {
      await cancelUnchargedWithoutRow(who);
      return { ok: false, code: 'MP_ERROR' };
    }
    // Build the row from MP now, with the plan sold, so the plan is on (and a
    // second purchase is blocked) before we answer.
    const synced = await syncSubscription(preapprovalId, {
      rowFailed: { planKey: input.planKey },
    }).catch((err) => {
      console.error('[billing/start] fallback sync failed', preapprovalId, err);
      return null;
    });
    const fallback = !synced?.ok ? 'failed' : synced.applied === 'activate' ? 'granted' : 'row_only';
    await alertChargedWithoutRow({ ...who, planKey: input.planKey, fallback });
    if (fallback === 'failed') return { ok: false, code: 'CHARGED_NO_PLAN' };
  }
  if (stripeSub) {
    const outcome = await confirmOrReadBack(stripeSub, token);
    // Still unknown: left as is; the webhook grants it if it paid, expiry closes it if not.
    if (!outcome) return { ok: false, code: 'MP_ERROR' };
    if (outcome.kind === 'declined') {
      await abandonStripeStart(preapprovalId);
      return { ok: false, code: 'DECLINED', decline: outcome.decline };
    }
    if (outcome.kind === 'action') {
      return {
        ok: false,
        code: 'REQUIRES_ACTION',
        clientSecret: outcome.clientSecret,
        subscriptionId: preapprovalId,
      };
    }
    // Finished here: a later finalize call for this start must do nothing.
    const claim = await claimStartFinish(preapprovalId, userId);
    if (claim === 'error') {
      console.error('[billing/start] finish not marked; a later finalize repeats it', preapprovalId);
    }
    // The webhook got there first and already finished this start.
    if (claim === 'taken') return { ok: true, consentId: consent.consent_id, mode, preapprovalId };
  }

  await afterStart({
    userId,
    email,
    firstName: (session.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? '',
    mode,
    planKey: input.planKey,
    interval: price.interval,
    lealtad,
    lealtadStart,
    trialLike,
    trialSwitch,
    switchMoved,
    now,
    dates,
    fp,
    preapprovalId,
    consentId: consent.consent_id,
    last4: card.last_four_digits ?? null,
    switchStartedAt: (billing.primaryRow?.started_at as string | undefined) ?? null,
  });
  return { ok: true, consentId: consent.consent_id, mode, preapprovalId };
}

interface AfterStart {
  userId: string;
  email: string;
  firstName: string;
  mode: StartMode;
  planKey: PlanKey;
  interval: 'month' | 'year';
  lealtad: boolean;
  lealtadStart: Date;
  trialLike: boolean;
  trialSwitch: boolean;
  switchMoved: boolean;
  now: Date;
  dates: Pick<TrialDates, 'trialEndsAt' | 'chargeAt'>;
  fp: string | null;
  preapprovalId: string;
  consentId: string;
  last4: string | null;
  switchStartedAt: string | null;
}

/** Everything after the gateway authorised the start: trial dates, card, sync, notices. */
async function afterStart(c: AfterStart): Promise<void> {
  const { userId, email, firstName, mode, planKey, interval, lealtad, lealtadStart } = c;
  const { trialLike, trialSwitch, switchMoved, now, dates, fp, preapprovalId, consentId } = c;
  const { last4, switchStartedAt } = c;
  const admin = createAdminClient();
  if (mode === 'trial') {
    const { error: trialErr } = await admin
      .from('profiles')
      .update({
        pro_trial_started_at: now.toISOString(),
        pro_trial_ends_at: dates.trialEndsAt.toISOString(),
      })
      .eq('id', userId)
      .is('pro_trial_started_at', null);
    if (trialErr) console.error('[billing/start] trial dates not stored', userId, trialErr);
  }
  // A switch that pushed the charge back extends the trial to it.
  if (switchMoved) {
    await admin
      .from('profiles')
      .update({ pro_trial_ends_at: dates.trialEndsAt.toISOString() })
      .eq('id', userId);
  }
  // Every card that starts a plan, trial or paid: a card that already paid
  // for one account can't open a trial on another.
  if (fp) {
    const { error: fpErr } = await admin
      .from('payment_method_fingerprints')
      .upsert({ hash: fp, user_id: userId }, { onConflict: 'hash', ignoreDuplicates: true });
    if (fpErr) {
      console.error('[billing/start] card fingerprint not stored', userId, fpErr);
      await notify({
        severity: 'warning',
        title: 'Tarjeta sin registrar para la regla de una prueba por tarjeta',
        body: `usuario ${userId} · suscripción ${preapprovalId}`,
        href: '/dashboard/dinero',
        source: 'billing.start',
      });
    }
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
    const name = firstName;
    const v = lealtadVars();
    await dispatchBillingEmail({
      userId,
      email,
      kind: 'lealtad_started',
      periodKey: consentId,
      vars: {
        nombre: name,
        plan: 'Pro Lealtad',
        monto: v.m1,
        reinicio: v.m1,
        fecha_hoy: formatFechaLarga(lealtadStart, 'es'),
        ultimos4: last4 ?? undefined,
        calendario: lealtadCalendar(lealtadStart)
          .slice(1)
          .map((c, i, all) => ({
            fecha: formatFechaLarga(c.date, 'es'),
            monto: formatMXN(c.cents),
            desde: i === all.length - 1,
          })),
        consent_id: consentId,
        version_sus: legalDocuments('suscripcion')[0]?.version,
        appUrl: getAppUrl(),
      },
    });
  }

  if (trialLike) {
    const name = firstName;
    await dispatchBillingEmail({
      userId,
      email,
      kind: 'trial_7d',
      periodKey: trialNoticeKey(dates.chargeAt, preapprovalId),
      evidence: 'charge_notice_sent',
      vars: trialNoticeVars({
        nombre: name,
        planKey: planKey,
        startedAt: trialSwitch ? (switchStartedAt ?? now) : now,
        trialEndsAt: dates.trialEndsAt,
        chargeAt: dates.chargeAt,
        last4: last4 ?? null,
        consentId: consentId,
        appUrl: getAppUrl(),
      }),
    });
    if (mode === 'trial') {
      void track('trial_start', {
        plan: interval === 'year' ? 'anual' : 'mensual',
        source: 'app',
      });
    }
  }

}

/** Moves start_finalized_at off null; only the call that does it may finish the start. */
async function claimStartFinish(
  subscriptionId: string,
  userId: string,
): Promise<'claimed' | 'taken' | 'error'> {
  const { data, error } = await createAdminClient()
    .from('subscriptions')
    .update({ start_finalized_at: new Date().toISOString() })
    .eq('mp_preapproval_id', subscriptionId)
    .eq('user_id', userId)
    .is('start_finalized_at', null)
    .select('mp_preapproval_id');
  if (error) {
    console.error('[billing/finalize] finish claim failed', subscriptionId, error);
    return 'error';
  }
  return (data?.length ?? 0) > 0 ? 'claimed' : 'taken';
}

/** A Stripe start the card did not pay: cancelled now so its row and Stripe agree. */
async function abandonStripeStart(subscriptionId: string): Promise<void> {
  try {
    await cancelPreapproval(subscriptionId);
    await syncSubscription(subscriptionId);
  } catch (err) {
    console.error('[billing/start] could not close an unpaid stripe start', subscriptionId, err);
  }
}

export type FinalizeResult =
  | { ok: true; consentId: string; mode: StartMode; preapprovalId: string }
  | { ok: false; code: 'NOT_FOUND' | 'DECLINED' | 'MP_ERROR'; decline?: DeclineReason }
  | { ok: false; code: 'REQUIRES_ACTION'; clientSecret: string; subscriptionId: string };

/** After the browser ran 3DS: the same finish as an inline start, or the decline. */
export async function finalizeStripeStart(
  session: SessionUser,
  subscriptionId: string,
): Promise<FinalizeResult> {
  const email = session.user.email;
  if (!email) return { ok: false, code: 'NOT_FOUND' };
  return finishStripeStart(subscriptionId, {
    id: session.user.id,
    email,
    fullName: (session.user.user_metadata?.full_name as string | undefined) ?? null,
  });
}

/** The webhook's half: a paid 3DS start whose page never called finalize still finishes. */
export async function finishStripeStartFromWebhook(subscriptionId: string): Promise<void> {
  const { data: row } = await createAdminClient()
    .from('subscriptions')
    .select('user_id, start_finalized_at')
    .eq('mp_preapproval_id', subscriptionId)
    .maybeSingle();
  if (!row?.user_id || row.start_finalized_at) return;
  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('email, full_name')
    .eq('id', row.user_id as string)
    .maybeSingle();
  if (!profile?.email) return;
  const out = await finishStripeStart(subscriptionId, {
    id: row.user_id as string,
    email: profile.email as string,
    fullName: (profile.full_name as string | null) ?? null,
  });
  if (!out.ok && out.code === 'MP_ERROR') throw new Error(`stripe start ${subscriptionId} not finished`);
}

async function finishStripeStart(
  subscriptionId: string,
  user: { id: string; email: string; fullName: string | null },
): Promise<FinalizeResult> {
  const userId = user.id;
  const email = user.email;
  if (!subscriptionId.startsWith('sub_')) return { ok: false, code: 'NOT_FOUND' };
  const admin = createAdminClient();
  const { data: row } = await admin
    .from('subscriptions')
    .select('plan_key, consent_id, started_at, trial_ends_at, first_charge_at, card_last4')
    .eq('mp_preapproval_id', subscriptionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!row?.consent_id || !row.plan_key) return { ok: false, code: 'NOT_FOUND' };
  let sub;
  try {
    sub = await getStripe().subscriptions.retrieve(subscriptionId, { expand: STRIPE_START_EXPAND });
  } catch (err) {
    console.error('[billing/finalize] stripe read failed', subscriptionId, err);
    return { ok: false, code: 'MP_ERROR' };
  }
  const meta = parseStartMeta(sub.metadata?.chalyb_start);
  if (sub.metadata?.user_id !== userId || !meta) return { ok: false, code: 'NOT_FOUND' };
  const outcome = await stripeStartState(sub).catch((err) => {
    console.error('[billing/finalize] stripe state unreadable', subscriptionId, err);
    return null;
  });
  if (!outcome) return { ok: false, code: 'MP_ERROR' };
  if (outcome.kind === 'action') {
    return { ok: false, code: 'REQUIRES_ACTION', clientSecret: outcome.clientSecret, subscriptionId };
  }
  if (outcome.kind === 'declined') {
    await abandonStripeStart(subscriptionId);
    return { ok: false, code: 'DECLINED', decline: outcome.decline };
  }
  const consentId = row.consent_id as string;
  // Single use: only the call that claims the finish runs its side effects (refund above all).
  const claim = await claimStartFinish(subscriptionId, userId);
  if (claim === 'error') return { ok: false, code: 'MP_ERROR' };
  if (claim === 'taken') return { ok: true, consentId, mode: meta.m, preapprovalId: subscriptionId };
  const planKey = row.plan_key as PlanKey;
  // First, so nothing that can throw below stands between the claim and the refund.
  if (meta.rp && meta.rc) {
    await refundProration({
      paymentId: meta.rp,
      cents: meta.rc,
      planKey,
      idempotencyKey: `proration-${subscriptionId}`,
    });
  }
  const trialEndsAt = row.trial_ends_at ? new Date(row.trial_ends_at as string) : null;
  const chargeAt = new Date((row.first_charge_at as string | null) ?? Date.now());
  await afterStart({
    userId,
    email,
    firstName: user.fullName?.split(' ')[0] ?? '',
    mode: meta.m,
    planKey,
    interval: planPrice(planKey).interval,
    lealtad: false,
    lealtadStart: chargeAt,
    trialLike: meta.m === 'trial' || meta.ts === 1,
    trialSwitch: meta.ts === 1,
    switchMoved: meta.sm === 1,
    now: new Date((row.started_at as string | null) ?? Date.now()),
    dates: { trialEndsAt: trialEndsAt ?? chargeAt, chargeAt },
    fp: meta.fp || null,
    preapprovalId: subscriptionId,
    consentId,
    last4: (row.card_last4 as string | null) ?? null,
    switchStartedAt: meta.ss || null,
  });
  return { ok: true, consentId, mode: meta.m, preapprovalId: subscriptionId };
}
