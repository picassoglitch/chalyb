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
import type { PlanKey } from '@/config/pricing';

type Phase = 'loading' | 'ready' | 'processing' | 'done' | 'pending';

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
}) {
  const t = useTranslations('checkout.pay');
  const tPlans = useTranslations('plans');
  const locale = useLocale();
  const router = useRouter();
  const needsConsent = consentText !== undefined;
  const [checked, setChecked] = useState(!needsConsent);
  const [phase, setPhase] = useState<Phase>('loading');
  const [signal, setSignal] = useState(0);
  const [nudge, setNudge] = useState(false);
  const [province, setProvince] = useState('mx');
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const onSubmit = useCallback(
    async (card: CardSubmission): Promise<CardSubmitResult> => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planKey,
            cardTokenId: card.token,
            consentChecked: checked,
            province: province === 'qc' ? 'QC' : null,
            timezone,
            locale,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          code?: string;
          consentId?: string;
        };
        if (res.ok && body.ok) {
          router.push(
            `${successHref}${successHref.includes('?') ? '&' : '?'}folio=${body.consentId ?? ''}` as Route,
          );
          return { ok: true, outcome: 'approved' };
        }
        const message =
          body.code === 'CONSENT_REQUIRED'
            ? t('consentError')
            : body.code === 'CARD_TRIAL_USED'
              ? t('cardUsed')
              : body.code === 'DECLINED'
                ? t('declined')
                : body.code === 'QUEBEC'
                  ? tPlans('quebec')
                  : body.code === 'NOT_AVAILABLE' || body.code === 'NOT_CONFIGURED'
                    ? t('unavailable')
                    : t('error');
        return { ok: false, error: message };
      } catch {
        return { ok: false, error: t('error') };
      }
    },
    [endpoint, planKey, checked, province, timezone, locale, router, successHref, t, tPlans],
  );

  function pay() {
    if (!checked) {
      setNudge(true);
      return;
    }
    setSignal((n) => n + 1);
  }

  const busy = phase === 'processing' || phase === 'done';

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="ch-brick">
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
      </div>

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
