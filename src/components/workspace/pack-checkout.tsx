'use client';

// Paying for a credit pack: the Paquetes checkbox (unchecked by default,
// Términos de los Paquetes §9.1), the card form and the "pay some other
// way" fallback. Nothing is charged until the box is ticked: the pay button
// stays disabled, the hosted button refuses, and the server repeats the rule
// (pack-checkout-core.ts) with the total this page showed.
//
// Cards are charged in place through payTokenPackWithCard. OXXO, SPEI and
// account money live on Mercado Pago's own page: createTokenPackCheckout.

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useWorkspace } from '@/lib/workspace/store';
import {
  createTokenPackCheckout,
  payTokenPackWithCard,
  type PackCheckoutResult,
} from '@/lib/payments/token-checkout-actions';
import { formatMXN } from '@/lib/billing/format';
import {
  MpCardBrick,
  type CardSubmission,
  type CardSubmitResult,
} from '@/components/payments/mp-card-brick';
import { HostedCheckoutButton } from '@/components/payments/hosted-checkout-button';
import { Markup } from '@/components/ui/markup';

type Phase = 'loading' | 'ready' | 'processing' | 'done' | 'pending';

interface Props {
  packId: string;
  /** The total shown on the page, in centavos; sent back so the server can
   *  refuse if it is no longer the price in force. */
  cents: number;
  publicKey: string;
  payerEmail: string | null;
  /** The checkbox sentence, rendered on the server (same as the evidence). */
  consentText: string;
}

export function PackCheckout({ packId, cents, publicKey, payerEmail, consentText }: Props) {
  const t = useTranslations('packCheckout');
  const locale = useLocale();
  const router = useRouter();
  const showToast = useWorkspace((s) => s.showToast);
  const [checked, setChecked] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [signal, setSignal] = useState(0);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const monto = formatMXN(cents);

  const consent = useMemo(
    () => ({ packId, accepted: checked, shownCents: cents, locale, clientTimezone: timezone }),
    [packId, checked, cents, locale, timezone],
  );

  /** The server's refusal, in this page's words. */
  const message = useCallback(
    (res: { reason?: PackCheckoutResult['reason'] | string; error?: string }) =>
      res.reason === 'consent_required'
        ? t('consentError')
        : res.reason === 'price_changed'
          ? t('priceChanged')
          : res.reason === 'not_configured' || res.reason === 'terms_mismatch'
            ? t('unavailable')
            : (res.error ?? t('error')),
    [t],
  );

  const onSubmit = useCallback(
    async (card: CardSubmission): Promise<CardSubmitResult> => {
      if (!consent.accepted) return { ok: false, error: t('consentError') };
      const res = await payTokenPackWithCard({
        ...consent,
        token: card.token,
        paymentMethodId: card.paymentMethodId,
        issuerId: card.issuerId,
        installments: card.installments,
        paymentTypeId: card.paymentTypeId,
        identification: card.identification,
      });
      if (!res.ok) {
        if (res.reason === 'price_changed') router.refresh();
        return { ok: false, error: message(res) };
      }
      if (res.status !== 'approved') {
        // pending / in_process: honest wait, no toast, no redirect.
        return { ok: true, outcome: 'pending', message: t('pendingShort') };
      }
      showToast(`<b>${t('approvedToast')}</b>`);
      setTimeout(() => {
        router.push('/app/usage');
        router.refresh();
      }, 1800);
      return { ok: true, outcome: 'approved' };
    },
    [consent, message, router, showToast, t],
  );

  function pay() {
    if (!checked) {
      setNudge(true);
      return;
    }
    setSignal((n) => n + 1);
  }

  const busy = phase === 'processing' || phase === 'done';
  const panel = (kind: 'ok' | 'wait', text: string) => (
    <div className={`ch-bnr ch-bnr--${kind === 'ok' ? 'trial' : 'warn'}`} role="status">
      <span>
        <Markup text={text} />
      </span>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <label className="ch-check">
        <input
          type="checkbox"
          name="pack-consent"
          checked={checked}
          onChange={(e) => {
            setChecked(e.target.checked);
            setNudge(false);
          }}
          aria-describedby="pack-consent-hint"
        />
        <span>
          <Markup text={consentText} termsHref="/legal/packs" />
        </span>
      </label>

      <div className="ch-brick">
        <MpCardBrick
          publicKey={publicKey}
          amount={cents / 100}
          payerEmail={payerEmail}
          maxInstallments={12}
          submitLabel={t('cta', { monto })}
          hideSubmit
          submitSignal={signal}
          theme="light"
          onPhaseChange={setPhase}
          onSubmit={onSubmit}
          success={panel('ok', t('approved'))}
          pending={panel('wait', t('pending'))}
          fallback={
            <HostedCheckoutButton
              hint={t('hostedHint')}
              label={t('hostedCta', { monto })}
              start={async () => {
                if (!consent.accepted) {
                  setNudge(true);
                  return { ok: false, error: t('consentError') };
                }
                const res = await createTokenPackCheckout(consent);
                return res.ok ? res : { ok: false, error: message(res) };
              }}
            />
          }
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          className="ch-btn ch-btn--primary ch-btn--xl"
          style={{ width: '100%' }}
          disabled={!checked || busy || phase === 'loading'}
          aria-disabled={!checked || busy}
          onClick={pay}
        >
          {t('cta', { monto })}
        </button>
        <p
          id="pack-consent-hint"
          role={nudge ? 'alert' : undefined}
          className="ch-muted"
          style={{ fontSize: 16, textAlign: 'center', margin: 0 }}
        >
          {nudge ? t('consentError') : t('ctaHint')}
        </p>
      </div>
    </div>
  );
}
