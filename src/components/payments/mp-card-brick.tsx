'use client';

// Mercado Pago Card Payment Brick, exactly as the official docs show it:
//   1. load https://sdk.mercadopago.com/js/v2
//   2. const mp = new MercadoPago(PUBLIC_KEY)
//   3. mp.bricks().create('cardPayment', 'cardPaymentBrick_container', {
//        initialization: { amount }, callbacks: { onReady, onSubmit, onError } })
//   4. window.cardPaymentBrickController.unmount() when leaving the page
// Nothing else: no theme, no custom variables, no texts, no payer prefill,
// no installment limits. The card fields are Mercado Pago iframes (PCI is
// theirs); onSubmit gives us a single-use token that the caller's server
// function turns into a preapproval or an order.

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

export interface CardSubmission {
  token: string;
  paymentMethodId: string;
  issuerId: string | null;
  installments: number;
  payerEmail: string | null;
  identification: { type: string; number: string } | null;
  paymentTypeId: string | null;
}

export type CardSubmitResult =
  | { ok: true; outcome: 'approved'; message?: string }
  | { ok: true; outcome: 'pending'; message: string }
  | { ok: false; error: string };

interface Props {
  publicKey: string;
  /** Major units, e.g. 749 for $749.00 MXN. */
  amount: number;
  /** Kept for the callers' sake; the Brick asks the buyer for the email. */
  payerEmail?: string | null;
  maxInstallments?: number;
  submitLabel?: string;
  onSubmit: (card: CardSubmission) => Promise<CardSubmitResult>;
  success: React.ReactNode;
  pending: React.ReactNode;
}

interface BrickController {
  unmount: () => void;
}
interface BrickFormData {
  token: string;
  issuer_id?: string;
  payment_method_id: string;
  installments?: number;
  payer?: { email?: string; identification?: { type: string; number: string } };
}
interface BrickError {
  type: 'critical' | 'non_critical';
  cause?: string;
  message: string;
}
type MercadoPagoCtor = new (publicKey: string) => {
  bricks: () => {
    create: (
      name: 'cardPayment',
      containerId: string,
      settings: Record<string, unknown>,
    ) => Promise<BrickController>;
  };
};

declare global {
  interface Window {
    MercadoPago?: MercadoPagoCtor;
    cardPaymentBrickController?: BrickController;
  }
}

const CONTAINER_ID = 'cardPaymentBrick_container';

export function MpCardBrick({ publicKey, amount, onSubmit, success, pending }: Props) {
  const [sdkReady, setSdkReady] = useState(
    () => typeof window !== 'undefined' && Boolean(window.MercadoPago),
  );
  const [phase, setPhase] = useState<'loading' | 'ready' | 'processing' | 'done' | 'pending'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    if (!sdkReady || !window.MercadoPago) return;
    let cancelled = false;
    const mp = new window.MercadoPago(publicKey);
    mp.bricks()
      .create('cardPayment', CONTAINER_ID, {
        initialization: { amount },
        callbacks: {
          onReady: () => {
            setPhase('ready');
          },
          onSubmit: async (form: BrickFormData, extra?: { paymentTypeId?: string }) => {
            setError(null);
            setPhase('processing');
            const result = await onSubmitRef.current({
              token: form.token,
              paymentMethodId: form.payment_method_id,
              issuerId: form.issuer_id || null,
              installments: form.installments || 1,
              payerEmail: form.payer?.email ?? null,
              identification: form.payer?.identification ?? null,
              paymentTypeId: extra?.paymentTypeId ?? null,
            });
            if (result.ok && result.outcome === 'approved') {
              setNotice(result.message ?? null);
              setPhase('done');
            } else if (result.ok) {
              setNotice(result.message);
              setPhase('pending');
            } else {
              setError(result.error);
              setPhase('ready');
            }
          },
          onError: (e: BrickError) => {
            console.error('[mercadopago brick]', e);
            if (e.type === 'critical') {
              setError(`${e.message}${e.cause ? ` (${e.cause})` : ''}`);
            }
          },
        },
      })
      .then((controller) => {
        if (cancelled) {
          controller.unmount();
          return;
        }
        window.cardPaymentBrickController = controller;
      })
      .catch((err: unknown) => {
        console.error('[mercadopago brick] create failed', err);
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      window.cardPaymentBrickController?.unmount();
      window.cardPaymentBrickController = undefined;
    };
  }, [sdkReady, publicKey, amount]);

  if (phase === 'done' || phase === 'pending') {
    return (
      <div>
        {phase === 'done' ? success : pending}
        {notice && (
          <p style={{ fontSize: 12.5, color: 'var(--cc-txt-3)', marginTop: 8 }}>{notice}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => setError('No se pudo cargar el script de Mercado Pago.')}
      />
      {phase === 'loading' && !error && (
        <p style={{ fontSize: 12.5, color: 'var(--cc-txt-3)', marginBottom: 10 }}>Cargando…</p>
      )}
      {phase === 'processing' && (
        <p style={{ fontSize: 12.5, color: 'var(--cc-txt-2)', marginBottom: 10 }}>Procesando…</p>
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
          }}
        >
          {error}
        </div>
      )}
      <div id={CONTAINER_ID} />
    </div>
  );
}
