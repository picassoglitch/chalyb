'use client';

// The card form, inside our page. Mercado Pago's Card Payment Brick renders
// the number, expiry and CVV in iframes it owns (PCI stays with them) and
// hands us a single-use token in onSubmit. What the token pays for is decided
// by the caller's server function, never by anything in this component: the
// amount shown here is for the buyer's eyes and the Brick's installment
// maths, and the server re-reads the price from pricing.ts.
//
// Used by the subscription checkout (the token becomes card_token_id on a
// preapproval) and the token pack checkout (the token pays an order).
//
// MOUNT ONCE. Two things tore the form down after it loaded, and both show
// up as "Cannot read properties of null (reading 'addEventListener')" from
// cardPayment.js while the skeleton never resolves:
//
//   1. The SDK's <CardPayment> re-creates the Brick whenever the identity of
//      `initialization`, `customization` or any callback changes (they are
//      its effect dependencies). Everything handed to it is memoised and the
//      latest onSubmit lives in a ref.
//   2. React reconciles unkeyed siblings by position and type. A status
//      <p> rendered BEFORE the Brick's wrapper, then removed on onReady, put
//      a <div> where a <p> had been: React unmounted the wrapper and mounted
//      a new one, remounting the Brick at the exact moment it became ready.
//      The layout below is therefore fixed: the status block is always
//      present (empty or not) and the Brick's wrapper is keyed and never
//      moves.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';

export interface CardSubmission {
  token: string;
  paymentMethodId: string;
  issuerId: string | null;
  installments: number;
  payerEmail: string | null;
  identification: { type: string; number: string } | null;
  /** 'credit_card' | 'debit_card' | 'prepaid_card' when the Brick reports it. */
  paymentTypeId: string | null;
}

export type CardSubmitResult = { ok: true; message?: string } | { ok: false; error: string };

interface Props {
  publicKey: string;
  /** Major units, e.g. 749 for $749.00 MXN. */
  amount: number;
  payerEmail: string | null;
  /** 1 for subscriptions (a monthly charge has no installments). */
  maxInstallments?: number;
  submitLabel?: string;
  /** Called with the tokenised card. Resolve ok=true to show the success
   *  state; ok=false keeps the form so the buyer can try another card. */
  onSubmit: (card: CardSubmission) => Promise<CardSubmitResult>;
  /** Rendered once the submission succeeded. */
  success: React.ReactNode;
}

type Phase = 'loading' | 'ready' | 'processing' | 'done';

export function MpCardBrick({
  publicKey,
  amount,
  payerEmail,
  maxInstallments = 1,
  submitLabel = 'Pagar',
  onSubmit,
  success,
}: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);
  const phaseRef = useRef<Phase>('loading');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // The caller's onSubmit may change identity on its renders; the Brick
  // must not care. Always call the latest one through the ref.
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  // initMercadoPago only records the key and locale on the SDK singleton;
  // the script itself loads when the Brick mounts. Running it in the lazy
  // initialiser guarantees it precedes the first <CardPayment> render.
  useState(() => {
    initMercadoPago(publicKey, { locale: 'es-MX' });
    return true;
  });

  useEffect(() => {
    // If the SDK script never loads (blocked, offline) the Brick's onReady
    // never fires. Say so instead of spinning forever.
    const t = setTimeout(() => {
      setPhase((p) => {
        if (p === 'loading') {
          setError(
            'No pudimos cargar el formulario de pago. Revisa tu conexión y recarga la página.',
          );
        }
        return p;
      });
    }, 20_000);
    return () => clearTimeout(t);
  }, []);

  const initialization = useMemo(
    () => ({
      amount,
      ...(payerEmail ? { payer: { email: payerEmail } } : {}),
    }),
    [amount, payerEmail],
  );

  const customization = useMemo(
    () => ({
      paymentMethods: { minInstallments: 1, maxInstallments },
      visual: {
        hideFormTitle: true,
        texts: { formSubmit: submitLabel },
        style: {
          theme: 'dark' as const,
          customVariables: {
            baseColor: '#9eea3a',
            baseColorFirstVariant: '#7bc220',
            baseColorSecondVariant: '#c6f24e',
            buttonTextColor: '#070809',
            formBackgroundColor: '#0c0e11',
            inputBackgroundColor: '#111418',
            textPrimaryColor: '#e6e9ee',
            textSecondaryColor: '#aab2bf',
            outlinePrimaryColor: '#262c34',
            outlineSecondaryColor: '#1c2128',
            errorColor: '#ff5d5d',
            successColor: '#9eea3a',
            borderRadiusMedium: '9px',
            borderRadiusLarge: '13px',
            formPadding: '0px',
          },
        },
      },
    }),
    [maxInstallments, submitLabel],
  );

  const handleReady = useCallback(() => {
    setError(null);
    setPhase('ready');
  }, []);

  const handleError = useCallback((e: { type: 'critical' | 'non_critical'; message: string }) => {
    // The Brick reports validation slips as non_critical while the buyer
    // types; only a critical error (bad key, failed load) is worth a banner.
    if (e.type === 'critical') {
      setError(`El formulario de pago falló: ${e.message}`);
      setPhase('ready');
    }
  }, []);

  const handleSubmit = useCallback(
    async (
      form: {
        token: string;
        issuer_id: string;
        payment_method_id: string;
        installments: number;
        payer: { email?: string; identification?: { type: string; number: string } };
      },
      extra?: { paymentTypeId?: string },
    ) => {
      if (busy.current) return;
      busy.current = true;
      setError(null);
      setPhase('processing');
      try {
        const result = await onSubmitRef.current({
          token: form.token,
          paymentMethodId: form.payment_method_id,
          issuerId: form.issuer_id || null,
          installments: form.installments || 1,
          payerEmail: form.payer?.email ?? payerEmail,
          identification: form.payer?.identification
            ? { type: form.payer.identification.type, number: form.payer.identification.number }
            : null,
          paymentTypeId: extra?.paymentTypeId ?? null,
        });
        if (result.ok) {
          setNotice(result.message ?? null);
          setPhase('done');
        } else {
          setError(result.error);
          setPhase('ready');
        }
      } catch (err) {
        console.error('[mp-card-brick] submit failed', err);
        setError('No pudimos completar el pago. Inténtalo de nuevo en un momento.');
        setPhase('ready');
      } finally {
        busy.current = false;
      }
    },
    [payerEmail],
  );

  const statusText =
    phase === 'loading' && !error
      ? 'Preparando el formulario de pago…'
      : phase === 'processing'
        ? 'Procesando el pago con Mercado Pago…'
        : null;

  return (
    <div>
      {/* Always rendered, so the Brick's wrapper below never changes position. */}
      <div key="status" style={{ minHeight: phase === 'done' ? 0 : 22 }}>
        {phase === 'done' ? (
          <>
            {success}
            {notice && (
              <p style={{ fontSize: 12.5, color: 'var(--cc-txt-3)', marginTop: 8 }}>{notice}</p>
            )}
          </>
        ) : (
          <>
            {statusText && (
              <p
                style={{
                  fontSize: 12.5,
                  color: phase === 'processing' ? 'var(--cc-txt-2)' : 'var(--cc-txt-3)',
                  marginBottom: 10,
                }}
              >
                {statusText}
              </p>
            )}
            {error && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  border: '1px solid var(--cc-red)',
                  background: 'var(--cc-red-g)',
                  borderRadius: 9,
                  fontSize: 12.5,
                  color: 'var(--cc-red)',
                  marginBottom: 12,
                  lineHeight: 1.5,
                }}
              >
                ▸ {error}
              </div>
            )}
          </>
        )}
      </div>
      {/* The Brick lives here from first render until the payment is done.
          Hidden (not unmounted) while processing; unmounted only on done. */}
      {phase !== 'done' && (
        <div
          key="brick"
          style={{
            opacity: phase === 'processing' ? 0.6 : 1,
            pointerEvents: phase === 'processing' ? 'none' : 'auto',
          }}
        >
          <CardPayment
            locale="es-MX"
            initialization={initialization}
            customization={customization}
            onReady={handleReady}
            onError={handleError}
            onSubmit={handleSubmit}
          />
        </div>
      )}
    </div>
  );
}
