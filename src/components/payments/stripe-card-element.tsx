'use client';

// Stripe's Payment Element inside our own page (no redirect): it tokenises the card into a
// ConfirmationToken, the server confirms, and a 3DS challenge opens in-site via Stripe.js.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripeElementsOptionsMode,
} from '@stripe/stripe-js';
import type { CardSubmitResult } from '@/components/payments/mp-card-brick';

export interface StripeSubmission {
  /** The ConfirmationToken id (ctoken_…), the only card data our server sees. */
  token: string;
  /** Runs the bank's check for a server answer that needs one; ok = the browser part is done. */
  handleNextAction: (clientSecret: string) => Promise<{ ok: boolean; error?: string }>;
}

type Phase = 'loading' | 'ready' | 'processing' | 'done' | 'pending';

interface Props {
  publishableKey: string;
  /** 'setup' for a trial or a card change (nothing charged today). */
  mode: 'payment' | 'subscription' | 'setup';
  /** Centavos charged today; ignored in 'setup'. */
  amountCents: number;
  submitSignal: number;
  onPhaseChange?: (phase: Phase) => void;
  onSubmit: (sub: StripeSubmission) => Promise<CardSubmitResult>;
  success: React.ReactNode;
  pending: React.ReactNode;
}

const loaders = new Map<string, Promise<Stripe | null>>();

function stripeFor(key: string): Promise<Stripe | null> {
  let p = loaders.get(key);
  if (!p) {
    p = loadStripe(key);
    loaders.set(key, p);
  }
  return p;
}

export function StripeCardElement({
  publishableKey,
  mode,
  amountCents,
  submitSignal,
  onPhaseChange,
  onSubmit,
  success,
  pending,
}: Props) {
  const t = useTranslations('checkout.stripe');
  const locale = useLocale();
  const mountRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const busy = useRef(false);
  const lastSignal = useRef(submitSignal);
  const onSubmitRef = useRef(onSubmit);
  const [phase, setPhaseState] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  const setPhase = useCallback(
    (p: Phase) => {
      setPhaseState(p);
      onPhaseChange?.(p);
    },
    [onPhaseChange],
  );

  useEffect(() => {
    let cancelled = false;
    let unmount: (() => void) | null = null;
    stripeFor(publishableKey)
      .then((stripe) => {
        if (cancelled) return;
        if (!stripe || !mountRef.current) {
          setError(t('loadFailed'));
          return;
        }
        const options: StripeElementsOptionsMode =
          mode === 'setup'
            ? { mode: 'setup', currency: 'mxn', allowedPaymentMethodTypes: ['card'] }
            : { mode, amount: amountCents, currency: 'mxn', allowedPaymentMethodTypes: ['card'] };
        const elements = stripe.elements({
          ...options,
          locale: locale === 'en' ? 'en' : 'es-419',
          appearance: {
            theme: 'stripe',
            variables: { fontSizeBase: '17px', borderRadius: '14px', colorDanger: '#d70015' },
          },
        });
        const el = elements.create('payment', { layout: 'tabs' });
        el.on('ready', () => setPhase('ready'));
        el.on('loaderror', () => setError(t('loadFailed')));
        el.mount(mountRef.current);
        stripeRef.current = stripe;
        elementsRef.current = elements;
        unmount = () => el.destroy();
      })
      .catch(() => {
        if (!cancelled) setError(t('loadFailed'));
      });
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [publishableKey, mode, amountCents, locale, setPhase, t]);

  const submit = useCallback(async () => {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements || busy.current) return;
    busy.current = true;
    setError(null);
    setPhase('processing');
    try {
      const checked = await elements.submit();
      if (checked.error) {
        setError(checked.error.message ?? t('error'));
        setPhase('ready');
        return;
      }
      const made = await stripe.createConfirmationToken({ elements });
      if (made.error || !made.confirmationToken) {
        setError(made.error?.message ?? t('error'));
        setPhase('ready');
        return;
      }
      const result = await onSubmitRef.current({
        token: made.confirmationToken.id,
        handleNextAction: async (clientSecret) => {
          const r = await stripe.handleNextAction({ clientSecret });
          return r.error
            ? { ok: false, error: r.error.message ?? t('actionFailed') }
            : { ok: true };
        },
      });
      if (result.ok) {
        setPhase(result.outcome === 'approved' ? 'done' : 'pending');
        return;
      }
      setError(result.error);
      setPhase('ready');
    } catch (err) {
      console.error('[stripe element] submit failed', err);
      setError(t('error'));
      setPhase('ready');
    } finally {
      busy.current = false;
    }
  }, [setPhase, t]);

  useEffect(() => {
    if (submitSignal === lastSignal.current) return;
    lastSignal.current = submitSignal;
    void submit();
  }, [submitSignal, submit]);

  const finished = phase === 'done' || phase === 'pending';
  const status =
    phase === 'loading' && !error
      ? t('preparing')
      : phase === 'processing'
        ? t('processing')
        : null;

  return (
    <div>
      {finished ? (
        phase === 'done' ? (
          success
        ) : (
          pending
        )
      ) : (
        <div style={{ minHeight: 22 }}>
          {status && (
            <p style={{ fontSize: 15, color: 'var(--cc-txt-2)', marginBottom: 10 }}>{status}</p>
          )}
          {error && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                border: '1px solid var(--cc-red)',
                background: 'var(--cc-red-g)',
                borderRadius: 9,
                fontSize: 15,
                color: 'var(--cc-red)',
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
      <div
        ref={mountRef}
        hidden={finished}
        style={{ opacity: phase === 'processing' ? 0.6 : 1, minHeight: 120 }}
      />
    </div>
  );
}
