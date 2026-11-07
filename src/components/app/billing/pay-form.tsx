'use client';

// SCR-15 · Pago. The card goes into Mercado Pago's embedded Brick; the
// recurring-charge checkbox is unchecked by default and the button stays
// disabled until it's checked (aceptacion-ux §3.3). The server repeats the
// rule — a request without the box is refused with 422.
//
// Also used by the plan change confirm step (`endpoint` /api/billing/change).

import { useCallback, useMemo, useState } from 'react';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  MpCardBrick,
  type CardSubmission,
  type CardSubmitResult,
} from '@/components/payments/mp-card-brick';
import { Markup } from '@/components/ui/markup';
import {
  StripeCardElement,
  type StripeSubmission,
} from '@/components/payments/stripe-card-element';
import type { PlanKey } from '@/config/pricing';
import { asDeclineReason } from '@/lib/payments/card-decline';
import { cleanPayerEmail } from '@/lib/payments/payer-email';

type Phase = 'loading' | 'ready' | 'processing' | 'done' | 'pending';

interface Answer {
  ok?: boolean;
  code?: string;
  decline?: string;
  consentId?: string;
  clientSecret?: string;
  subscriptionId?: string;
}

export function PayForm({
  publicKey,
  payerEmail,
  planKey,
  amountMajor,
  consentText,
  buttonLabel,
  endpoint,
  successHref,
  askWhere,
  askMpEmail = false,
  stripe,
}: {
  publicKey: string;
  payerEmail: string | null;
  planKey: PlanKey;
  amountMajor: number;
  /** The checkbox sentence, already rendered with this plan's numbers.
   *  Omitted for a card update, which changes no charge. */
  consentText?: string;
  buttonLabel: string;
  endpoint: '/api/billing/trial' | '/api/billing/change' | '/api/billing/card';
  successHref: string;
  /** Ask where the buyer lives (Quebec, P2-11). */
  askWhere: boolean;
  /** Ask the email of the buyer's Mercado Pago account (MP_PAYER_EMAIL_EDITABLE). */
  askMpEmail?: boolean;
  /** Pay through Stripe's Payment Element instead (PAYMENTS_PROVIDER=stripe). */
  stripe?: { publishableKey: string; mode: 'subscription' | 'setup'; amountCents: number };
}) {
  const t = useTranslations('checkout.pay');
  const ts = useTranslations('checkout.stripe');
  const tPlans = useTranslations('plans');
  const locale = useLocale();
  const router = useRouter();
  const needsConsent = consentText !== undefined;
  const [checked, setChecked] = useState(!needsConsent);
  const [phase, setPhase] = useState<Phase>('loading');
  const [signal, setSignal] = useState(0);
  const [nudge, setNudge] = useState(false);
  const [province, setProvince] = useState('mx');
  const [mpEmail, setMpEmail] = useState(payerEmail ?? '');
  const [mpEmailBad, setMpEmailBad] = useState(false);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  /** The server's answer, in this page's words. */
  const answer = useCallback(
    (res: Response, body: Answer): CardSubmitResult => {
      if (res.ok && body.ok) {
        router.push(
          `${successHref}${successHref.includes('?') ? '&' : '?'}folio=${body.consentId ?? ''}` as Route,
        );
        return { ok: true, outcome: 'approved' };
      }
      const reason = asDeclineReason(body.decline);
      const decline =
        stripe && (reason === 'risk' || reason === 'duplicated' || reason === 'unknown')
          ? ts(`decline.${reason}`)
          : t(`decline.${reason}`);
      const message =
        body.code === 'CONSENT_REQUIRED'
          ? t('consentError')
          : body.code === 'CARD_TRIAL_USED'
            ? t('cardUsed')
            : body.code === 'CARD_UNVERIFIED'
              ? t('cardUnverified')
              : body.code === 'DECLINED'
                ? decline
                : body.code === 'QUEBEC'
                  ? tPlans('quebec')
                  : body.code === 'ACCOUNT_CLOSED' || body.code === 'PAID_REFUSED'
                    ? t(body.code === 'ACCOUNT_CLOSED' ? 'accountClosed' : 'paidRefused')
                    : body.code === 'CHARGED_NO_PLAN'
                      ? t('chargedNoPlan')
                      : body.code === 'NOT_AVAILABLE' || body.code === 'NOT_CONFIGURED'
                        ? t('unavailable')
                        : t('error');
      return { ok: false, error: message };
    },
    [router, successHref, stripe, t, ts, tPlans],
  );

  const send = useCallback(
    async (token: string, deviceSessionId: string | null) =>
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey,
          cardTokenId: token,
          consentChecked: checked,
          province: province === 'qc' ? 'QC' : null,
          timezone,
          locale,
          deviceSessionId,
          ...(askMpEmail ? { mpEmail: mpEmail.trim() } : {}),
        }),
      }),
    [endpoint, planKey, checked, province, timezone, locale, askMpEmail, mpEmail],
  );

  const onSubmit = useCallback(
    async (card: CardSubmission): Promise<CardSubmitResult> => {
      try {
        const res = await send(card.token, card.deviceSessionId);
        return answer(res, (await res.json().catch(() => ({}))) as Answer);
      } catch {
        return { ok: false, error: t('error') };
      }
    },
    [send, answer, t],
  );

  const onStripeSubmit = useCallback(
    async (sub: StripeSubmission): Promise<CardSubmitResult> => {
      try {
        let res = await send(sub.token, null);
        let body = (await res.json().catch(() => ({}))) as Answer;
        // The bank's check runs here, in-site; then the server finishes what it started.
        if (body.code === 'REQUIRES_ACTION' && body.clientSecret && body.subscriptionId) {
          const action = await sub.handleNextAction(body.clientSecret);
          if (!action.ok) return { ok: false, error: action.error ?? ts('actionFailed') };
          res = await fetch('/api/billing/stripe/finalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriptionId: body.subscriptionId,
              kind: endpoint === '/api/billing/card' ? 'card' : 'start',
              intentId: body.clientSecret.split('_secret_')[0],
            }),
          });
          body = (await res.json().catch(() => ({}))) as Answer;
          if (body.code === 'REQUIRES_ACTION') return { ok: false, error: ts('actionFailed') };
        }
        return answer(res, body);
      } catch {
        return { ok: false, error: ts('error') };
      }
    },
    [send, answer, endpoint, ts],
  );

  function pay() {
    if (!checked) {
      setNudge(true);
      return;
    }
    // The server would quietly fall back to the account email; say so instead.
    if (askMpEmail && !cleanPayerEmail(mpEmail)) {
      setMpEmailBad(true);
      return;
    }
    setSignal((n) => n + 1);
  }

  const busy = phase === 'processing' || phase === 'done';

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="ch-brick">
        {stripe ? (
          <StripeCardElement
            publishableKey={stripe.publishableKey}
            mode={stripe.mode}
            amountCents={stripe.amountCents}
            submitSignal={signal}
            onPhaseChange={setPhase}
            onSubmit={onStripeSubmit}
            success={<p>{t('saving')}</p>}
            pending={<p>{t('saving')}</p>}
          />
        ) : (
          <MpCardBrick
            publicKey={publicKey}
            amount={amountMajor}
            payerEmail={payerEmail}
            maxInstallments={1}
            submitLabel={buttonLabel}
            hideSubmit
            submitSignal={signal}
            theme="light"
            onPhaseChange={setPhase}
            onSubmit={onSubmit}
            success={<p>{t('saving')}</p>}
            pending={<p>{t('saving')}</p>}
          />
        )}
      </div>

      {askMpEmail && (
        <label style={{ display: 'grid', gap: 6, fontSize: 17 }}>
          {t('mpEmail.label')}
          <input
            type="email"
            name="mpEmail"
            className="ch-input"
            autoComplete="email"
            value={mpEmail}
            onChange={(e) => {
              setMpEmail(e.target.value);
              setMpEmailBad(false);
            }}
            aria-invalid={mpEmailBad}
            aria-describedby="mp-email-hint"
          />
          <span
            id="mp-email-hint"
            role={mpEmailBad ? 'alert' : undefined}
            className="ch-muted"
            style={{ fontSize: 15 }}
          >
            {mpEmailBad ? t('mpEmail.invalid') : t('mpEmail.hint')}
          </span>
        </label>
      )}

      {askWhere && (
        <label
          style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 17 }}
        >
          {t('where')}
          <select
            className="ch-select"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          >
            {(['mx', 'us', 'qc', 'ca', 'other'] as const).map((o) => (
              <option key={o} value={o}>
                {t(`whereOpts.${o}`)}
              </option>
            ))}
          </select>
        </label>
      )}

      {needsConsent && (
        <label className="ch-check">
          <input
            type="checkbox"
            name="consent"
            checked={checked}
            onChange={(e) => {
              setChecked(e.target.checked);
              setNudge(false);
            }}
            aria-describedby="consent-hint"
          />
          <span>
            <Markup text={consentText!} />
          </span>
        </label>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          className="ch-btn ch-btn--primary ch-btn--xl"
          disabled={!checked || busy || phase === 'loading'}
          aria-disabled={!checked || busy}
          onClick={pay}
        >
          {busy ? t('saving') : buttonLabel}
        </button>
        {needsConsent && (
          <p
            id="consent-hint"
            role={nudge ? 'alert' : undefined}
            className="ch-muted"
            style={{ fontSize: 16, textAlign: 'center' }}
          >
            {nudge ? t('consentError') : t('ctaHint')}
          </p>
        )}
      </div>
    </div>
  );
}
