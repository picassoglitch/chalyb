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

import { useEffect, useRef, useState } from 'react';
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

export function MpCardBrick({
  publicKey,
  amount,
  payerEmail,
  maxInstallments = 1,
  submitLabel = 'Pagar',
  onSubmit,
  success,
}: Props) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'processing' | 'done'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);

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

  if (phase === 'done') {
    return (
      <div>
        {success}
        {notice && (
          <p style={{ fontSize: 12.5, color: 'var(--cc-txt-3)', marginTop: 8 }}>{notice}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {phase === 'loading' && !error && (
        <p style={{ fontSize: 12.5, color: 'var(--cc-txt-3)', marginBottom: 10 }}>
          Preparando el formulario de pago…
        </p>
      )}
      {phase === 'processing' && (
        <p style={{ fontSize: 12.5, color: 'var(--cc-txt-2)', marginBottom: 10 }}>
          Procesando el pago con Mercado Pago…
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
      <div
        style={{
          opacity: phase === 'processing' ? 0.6 : 1,
          pointerEvents: phase === 'processing' ? 'none' : 'auto',
        }}
      >
        <CardPayment
          locale="es-MX"
          initialization={{
            amount,
            ...(payerEmail ? { payer: { email: payerEmail } } : {}),
          }}
          customization={{
            paymentMethods: { minInstallments: 1, maxInstallments },
            visual: {
              hideFormTitle: true,
              texts: { formSubmit: submitLabel },
              style: {
                theme: 'dark',
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
          }}
          onReady={() => setPhase('ready')}
          onError={(e) => {
            // The Brick reports validation slips as non_critical while the
            // buyer types; only a critical error (bad key, failed load) is
            // worth a banner.
            if (e.type === 'critical') {
              setError(`El formulario de pago falló: ${e.message}`);
              setPhase('ready');
            }
          }}
          onSubmit={async (form, extra) => {
            if (busy.current) return;
            busy.current = true;
            setError(null);
            setPhase('processing');
            try {
              const result = await onSubmit({
                token: form.token,
                paymentMethodId: form.payment_method_id,
                issuerId: form.issuer_id || null,
                installments: form.installments || 1,
                payerEmail: form.payer?.email ?? payerEmail,
                identification: form.payer?.identification
                  ? {
                      type: form.payer.identification.type,
                      number: form.payer.identification.number,
                    }
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
          }}
        />
      </div>
    </div>
  );
}
