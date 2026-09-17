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
// WHY THIS MOUNTS THE BRICK BY HAND instead of <CardPayment> from
// @mercadopago/sdk-react: that wrapper creates the Brick in an effect and
// unmounts it in the effect's cleanup. Any second effect run — a parent
// remount, StrictMode in dev, a Suspense boundary hiding and resuming the
// subtree, a prop identity change — tears the form down while its bundle
// and iframes are still loading, which surfaces as
// "Cannot read properties of null (reading 'addEventListener')" from
// cardPayment.js and a skeleton that never resolves. Here:
//   - the container element has a unique id per component instance;
//   - one Brick is created per instance, and an effect re-run reuses it;
//   - cleanup DEFERS the unmount by a tick and an effect re-run cancels
//     that, so only a real unmount destroys the Brick;
//   - every step logs under [mp-card-brick] so the next failure names
//     itself: script, instance, create, ready, error.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { loadMercadoPago } from '@mercadopago/sdk-js';

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

export type CardSubmitResult =
  /** Money moved and the entitlement is granted. */
  | { ok: true; outcome: 'approved'; message?: string }
  /** Mercado Pago has not decided yet (pending / in review / action
   *  required). Nothing is granted; the webhook finishes the job. */
  | { ok: true; outcome: 'pending'; message: string }
  | { ok: false; error: string };

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
  /** Rendered once the payment is approved. */
  success: React.ReactNode;
  /** Rendered when Mercado Pago left the payment pending. Never the success
   *  node: nothing has been granted yet. */
  pending: React.ReactNode;
}

type Phase = 'loading' | 'ready' | 'processing' | 'done' | 'pending';

// ── Minimal typing of MercadoPago.js v2 (loaded at runtime from
// sdk.mercadopago.com; no types ship with the loader). ──────────────────
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
interface BrickAdditionalData {
  paymentTypeId?: string;
}
interface BrickError {
  type: 'critical' | 'non_critical';
  cause?: string;
  message: string;
}
interface MercadoPagoInstance {
  bricks: () => {
    create: (
      name: 'cardPayment',
      containerId: string,
      settings: Record<string, unknown>,
    ) => Promise<BrickController>;
  };
}
type MercadoPagoCtor = new (
  publicKey: string,
  options?: { locale?: string },
) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoCtor;
  }
}

/** One SDK instance per public key for the whole page. */
const instances = new Map<string, MercadoPagoInstance>();

function log(step: string, detail?: unknown) {
  if (detail === undefined) console.info(`[mp-card-brick] ${step}`);
  else console.info(`[mp-card-brick] ${step}`, detail);
}

async function getInstance(publicKey: string): Promise<MercadoPagoInstance> {
  const cached = instances.get(publicKey);
  if (cached) return cached;
  log('loading MercadoPago.js');
  await loadMercadoPago();
  if (!window.MercadoPago) {
    throw new Error('MercadoPago.js loaded but window.MercadoPago is missing');
  }
  log('MercadoPago.js loaded; creating SDK instance');
  const mp = new window.MercadoPago(publicKey, { locale: 'es-MX' });
  instances.set(publicKey, mp);
  return mp;
}

export function MpCardBrick({
  publicKey,
  amount,
  payerEmail,
  maxInstallments = 1,
  submitLabel = 'Pagar',
  onSubmit,
  success,
  pending,
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

  // A container id that is unique per instance and valid for
  // getElementById (useId yields «:r1:» style tokens).
  const reactId = useId();
  const containerId = `mp-card-brick-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Lifecycle state that must survive effect re-runs.
  const controllerRef = useRef<BrickController | null>(null);
  const aliveRef = useRef(false);
  const pendingUnmount = useRef<number | null>(null);
  const creatingRef = useRef(false);

  const handleSubmit = useCallback(
    async (form: BrickFormData, extra?: BrickAdditionalData) => {
      if (busy.current) return;
      busy.current = true;
      setError(null);
      setPhase('processing');
      log('submit: token received, calling the server');
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
        if (result.ok && result.outcome === 'approved') {
          log('submit: approved');
          setNotice(result.message ?? null);
          setPhase('done');
        } else if (result.ok) {
          // Pending is not success: the buyer must not see an unlock.
          log('submit: pending');
          setNotice(result.message);
          setPhase('pending');
        } else {
          log('submit: refused', result.error);
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

  useEffect(() => {
    aliveRef.current = true;

    // An effect re-run right after a cleanup (StrictMode, a Suspense
    // resume, a parent re-render that remounted this subtree): keep the
    // Brick that already exists instead of creating a second one.
    if (pendingUnmount.current !== null) {
      window.clearTimeout(pendingUnmount.current);
      pendingUnmount.current = null;
      log('effect re-ran; keeping the existing Brick');
      return cleanup;
    }
    if (controllerRef.current || creatingRef.current) {
      log('effect ran while a Brick exists or is being created; nothing to do');
      return cleanup;
    }

    creatingRef.current = true;
    (async () => {
      const mp = await getInstance(publicKey);
      if (!aliveRef.current) {
        log('component went away before the SDK instance was ready');
        return;
      }
      const container = document.getElementById(containerId);
      if (!container || !container.isConnected) {
        throw new Error(`container #${containerId} is not in the document`);
      }
      log('creating Brick', { containerId, amount, maxInstallments });
      const controller = await mp.bricks().create('cardPayment', containerId, {
        locale: 'es-MX',
        initialization: {
          amount,
          ...(payerEmail ? { payer: { email: payerEmail } } : {}),
        },
        customization: {
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
        },
        callbacks: {
          onReady: () => {
            log('Brick ready');
            setError(null);
            setPhase('ready');
          },
          onSubmit: handleSubmit,
          onError: (e: BrickError) => {
            // The Brick reports validation slips as non_critical while the
            // buyer types; only a critical error is worth a banner.
            if (e.type === 'critical') {
              console.error('[mp-card-brick] Brick critical error', e);
              setError(
                `El formulario de pago falló: ${e.message}${e.cause ? ` (${e.cause})` : ''}`,
              );
              setPhase('ready');
            } else {
              log('Brick non-critical error', e);
            }
          },
        },
      });
      log('Brick created (controller obtained)');
      if (!aliveRef.current) {
        log('component went away during creation; unmounting the new Brick');
        controller.unmount();
        return;
      }
      controllerRef.current = controller;
    })()
      .catch((err: unknown) => {
        console.error('[mp-card-brick] could not mount the Brick', err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(
          /Failed to load MercadoPago\.js|not available/i.test(msg)
            ? 'No pudimos cargar el script de Mercado Pago (sdk.mercadopago.com). Si usas un bloqueador de anuncios o de rastreadores, permítelo para esta página y recarga.'
            : `No pudimos montar el formulario de pago: ${msg}`,
        );
      })
      .finally(() => {
        creatingRef.current = false;
      });

    function cleanup() {
      aliveRef.current = false;
      // Defer: if this cleanup is immediately followed by another effect
      // run, that run cancels the unmount and the Brick lives on.
      pendingUnmount.current = window.setTimeout(() => {
        pendingUnmount.current = null;
        if (controllerRef.current) {
          log('unmounting Brick (component left the page)');
          try {
            controllerRef.current.unmount();
          } catch (err) {
            console.warn('[mp-card-brick] unmount threw', err);
          }
          controllerRef.current = null;
        }
      }, 0);
    }
    return cleanup;
    // The Brick is created once per instance; changing these props after
    // mount is not supported (the pages pass server-decided constants).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, containerId]);

  useEffect(() => {
    // If the Brick never reports ready, say which stage stalled.
    const t = window.setTimeout(() => {
      if (phaseRef.current === 'loading') {
        const stage = controllerRef.current
          ? 'Mercado Pago creó el formulario pero sus campos seguros nunca terminaron de cargar'
          : window.MercadoPago
            ? 'Mercado Pago no terminó de crear el formulario'
            : 'el script de Mercado Pago no cargó';
        console.error(`[mp-card-brick] watchdog: still loading after 20s — ${stage}`);
        setError(
          `No pudimos cargar el formulario de pago: ${stage}. Revisa tu conexión y cualquier bloqueador de anuncios, y recarga la página.`,
        );
      }
    }, 20_000);
    return () => window.clearTimeout(t);
  }, []);

  const finished = phase === 'done' || phase === 'pending';
  const statusText =
    phase === 'loading' && !error
      ? 'Preparando el formulario de pago…'
      : phase === 'processing'
        ? 'Procesando el pago con Mercado Pago…'
        : null;

  return (
    <div>
      {/* Always rendered, so the Brick's container below never changes position. */}
      <div key="status" style={{ minHeight: finished ? 0 : 22 }}>
        {finished ? (
          <>
            {phase === 'done' ? success : pending}
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
      {/* The Brick's container. React renders this div empty and never
          touches its children; the Brick owns everything inside. Kept in
          the tree (hidden) once the payment is decided so the deferred
          unmount, not React, takes the Brick down. */}
      <div
        key="brick"
        id={containerId}
        style={{
          display: finished ? 'none' : undefined,
          opacity: phase === 'processing' ? 0.6 : 1,
          pointerEvents: phase === 'processing' ? 'none' : 'auto',
        }}
      />
    </div>
  );
}
