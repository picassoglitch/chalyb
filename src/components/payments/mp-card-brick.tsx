'use client';

// Mercado Pago Card Payment Brick, mounted by hand.
//
// The SDK is the documented script tag (https://sdk.mercadopago.com/js/v2),
// then `new MercadoPago(PUBLIC_KEY)` and `mp.bricks().create('cardPayment',
// containerId, settings)`. What this component adds is MOUNT STABILITY,
// because the Brick loads its bundle and its secure-field iframes
// asynchronously and dies if it is torn down in the meantime:
//
//   1. A container id unique per component instance (useId). Never the
//      shared global `cardPaymentBrick_container`, so two instances or a
//      remounted one can never fight over one element.
//   2. One Brick per instance. The creating effect depends only on the SDK
//      being loaded; publicKey/amount/etc. are read from refs at creation,
//      so a parent re-render never recreates the Brick.
//   3. Deferred unmount. The effect cleanup does not destroy the Brick; it
//      schedules the unmount on the next tick, and an immediate re-run of
//      the effect (React Strict Mode, a Suspense resume, a remount of this
//      subtree) cancels it. Only a real leave lets the timer fire.
//   4. Critical Brick errors reach the banner; create failures log under
//      [mercadopago brick]; a 20 s watchdog names the stage that stalled.
//
// The card fields are Mercado Pago iframes (PCI stays with them). onSubmit
// hands us a single-use token; the caller's server function turns it into a
// preapproval or an order and decides the price. Nothing here is trusted
// for money.

import { useEffect, useId, useRef, useState } from 'react';
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
  payerEmail?: string | null;
  /** 1 for subscriptions (a monthly charge has no installments). */
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

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const WATCHDOG_MS = 20_000;

type Phase = 'loading' | 'ready' | 'processing' | 'done' | 'pending';
type Stage = 'sdk' | 'create' | 'onReady' | 'ready';

function log(step: string, detail?: unknown) {
  if (detail === undefined) console.info(`[mercadopago brick] ${step}`);
  else console.info(`[mercadopago brick] ${step}`, detail);
}

export function MpCardBrick({
  publicKey,
  amount,
  payerEmail = null,
  maxInstallments = 1,
  submitLabel = 'Pagar',
  onSubmit,
  success,
  pending,
}: Props) {
  const [sdkReady, setSdkReady] = useState(
    () => typeof window !== 'undefined' && Boolean(window.MercadoPago),
  );
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Unique per instance and valid for getElementById (useId yields «:r1:»).
  const containerId = `mp-card-brick-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Everything the Brick needs at creation, read from refs so the creating
  // effect can depend on the SDK alone and never recreate on re-render.
  const settingsRef = useRef({ publicKey, amount, payerEmail, maxInstallments, submitLabel });
  const onSubmitRef = useRef(onSubmit);
  // Declared before the creating effect so React runs it first.
  useEffect(() => {
    settingsRef.current = { publicKey, amount, payerEmail, maxInstallments, submitLabel };
    onSubmitRef.current = onSubmit;
  }, [publicKey, amount, payerEmail, maxInstallments, submitLabel, onSubmit]);

  // Lifecycle state that must survive effect re-runs.
  const controllerRef = useRef<BrickController | null>(null);
  const creatingRef = useRef(false);
  const aliveRef = useRef(false);
  const pendingUnmount = useRef<number | null>(null);
  const stageRef = useRef<Stage>('sdk');
  const brickErrors = useRef<string[]>([]);
  const busy = useRef(false);
  // "A listener indicated an asynchronous response by returning true, but
  // the message channel closed…" is emitted only by browser extensions'
  // messaging API. Seeing it while the Brick loads means an extension is
  // injecting into this page (and usually into Mercado Pago's iframes),
  // which is what breaks the form. Remembered so the watchdog can say so.
  const extensionInterference = useRef(false);
  useEffect(() => {
    const onRejection = (ev: PromiseRejectionEvent) => {
      const msg = String(
        (ev.reason as { message?: string } | undefined)?.message ?? ev.reason ?? '',
      );
      if (/message channel closed before a response was received/i.test(msg)) {
        extensionInterference.current = true;
      }
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  useEffect(() => {
    if (!sdkReady) return;
    aliveRef.current = true;

    // Re-run right after a cleanup (Strict Mode, Suspense resume, remount):
    // cancel the scheduled unmount and keep the Brick that exists.
    if (pendingUnmount.current !== null) {
      window.clearTimeout(pendingUnmount.current);
      pendingUnmount.current = null;
      log('effect re-ran; keeping the existing Brick');
      return cleanup;
    }
    if (controllerRef.current || creatingRef.current) return cleanup;

    if (!window.MercadoPago) {
      console.error('[mercadopago brick] script loaded but window.MercadoPago is missing');
      window.setTimeout(
        () => setError('El script de Mercado Pago cargó pero no expuso MercadoPago.'),
        0,
      );
      return cleanup;
    }

    const s = settingsRef.current;
    creatingRef.current = true;
    stageRef.current = 'create';
    // Diagnostic: the Brick holds a reference to the container it finds at
    // create() time. If React ever swaps that element, the Brick renders
    // into a detached node and its lookups come back null. Compare later.
    const containerAtCreate = document.getElementById(containerId);
    log('creating Brick', {
      containerId,
      amount: s.amount,
      containerConnected: containerAtCreate?.isConnected ?? false,
    });

    const mp = new window.MercadoPago(s.publicKey, { locale: 'es-MX' });
    mp.bricks()
      .create('cardPayment', containerId, {
        initialization: {
          amount: s.amount,
          ...(s.payerEmail ? { payer: { email: s.payerEmail } } : {}),
        },
        customization: {
          paymentMethods: { minInstallments: 1, maxInstallments: s.maxInstallments },
          visual: {
            hideFormTitle: true,
            texts: { formSubmit: s.submitLabel },
            style: { theme: 'dark' },
          },
        },
        callbacks: {
          onReady: () => {
            stageRef.current = 'ready';
            log('Brick ready');
            setError(null);
            setPhase('ready');
          },
          onSubmit: async (form: BrickFormData, extra?: { paymentTypeId?: string }) => {
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
                payerEmail: form.payer?.email ?? settingsRef.current.payerEmail,
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
            } catch (err) {
              console.error('[mercadopago brick] submit failed', err);
              setError('No pudimos completar el pago. Inténtalo de nuevo en un momento.');
              setPhase('ready');
            } finally {
              busy.current = false;
            }
          },
          onError: (e: BrickError) => {
            brickErrors.current.push(`${e.cause ?? 'sin_causa'}: ${e.message}`);
            if (e.type === 'critical') {
              console.error('[mercadopago brick] critical error', e);
              setError(
                `El formulario de pago falló: ${e.message}${e.cause ? ` (${e.cause})` : ''}`,
              );
            } else {
              log('non-critical error', e);
            }
          },
        },
      })
      .then((controller) => {
        const now = document.getElementById(containerId);
        log('Brick created; waiting for onReady', {
          containerSameElement: now === containerAtCreate,
          containerConnected: now?.isConnected ?? false,
          iframesInContainer: now?.querySelectorAll('iframe').length ?? 0,
          iframesInDocument: document.querySelectorAll('iframe').length,
        });
        if (stageRef.current === 'create') stageRef.current = 'onReady';
        // Always keep the controller. Never unmount inline here: if the
        // component left while create() was in flight, the deferred cleanup
        // (already scheduled) unmounts it once; if that cleanup was
        // cancelled by an immediate re-run, the Brick simply lives on.
        controllerRef.current = controller;
        if (!aliveRef.current && pendingUnmount.current === null) {
          // Left for real and the cleanup already ran its timer before we
          // had a controller: schedule the unmount now, still deferred.
          log('component left during creation; scheduling deferred unmount');
          pendingUnmount.current = window.setTimeout(() => {
            pendingUnmount.current = null;
            if (!aliveRef.current && controllerRef.current) {
              log('unmounting Brick (component left)');
              try {
                controllerRef.current.unmount();
              } catch (err) {
                console.warn('[mercadopago brick] unmount threw', err);
              }
              controllerRef.current = null;
            }
          }, 0);
        }
      })
      .catch((err: unknown) => {
        console.error('[mercadopago brick] create failed', err);
        setError(
          `No pudimos montar el formulario de pago: ${err instanceof Error ? err.message : String(err)}`,
        );
      })
      .finally(() => {
        creatingRef.current = false;
      });

    function cleanup() {
      aliveRef.current = false;
      // Deferred: an immediate effect re-run cancels this and the Brick
      // survives. Only a real leave reaches the timer body.
      pendingUnmount.current = window.setTimeout(() => {
        pendingUnmount.current = null;
        if (controllerRef.current) {
          log('unmounting Brick (component left)');
          try {
            controllerRef.current.unmount();
          } catch (err) {
            console.warn('[mercadopago brick] unmount threw', err);
          }
          controllerRef.current = null;
        }
      }, 0);
    }
    return cleanup;
    // Create once per instance: only the SDK arriving triggers this.
    // Everything else is read from refs above.
  }, [sdkReady, containerId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (stageRef.current === 'ready') return;
      const stage =
        stageRef.current === 'sdk'
          ? 'el script de Mercado Pago (sdk.mercadopago.com) no cargó'
          : stageRef.current === 'create'
            ? 'Mercado Pago no terminó de crear el formulario'
            : 'Mercado Pago creó el formulario pero nunca avisó que estuviera listo';
      const reported = brickErrors.current.length
        ? ` Errores reportados: ${Array.from(new Set(brickErrors.current)).join(' · ')}.`
        : ' Sin errores reportados por Mercado Pago.';
      const extensionHint = extensionInterference.current
        ? ' Detectamos una extensión del navegador interfiriendo con la página de pago (gestores de contraseñas, autocompletado de tarjetas, cupones o traductores suelen hacerlo). Prueba en una ventana de incógnito o desactívala para este sitio.'
        : '';
      console.error(
        `[mercadopago brick] watchdog after ${WATCHDOG_MS / 1000}s: ${stage}.${reported}`,
      );
      setError(
        (prev) =>
          prev ?? `No pudimos cargar el formulario de pago: ${stage}.${reported}${extensionHint}`,
      );
    }, WATCHDOG_MS);
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
      <Script
        src={SDK_URL}
        strategy="afterInteractive"
        onLoad={() => {
          log('SDK script loaded');
          setSdkReady(true);
        }}
        onError={() => {
          console.error('[mercadopago brick] SDK script failed to load');
          setError('No se pudo cargar el script de Mercado Pago (sdk.mercadopago.com).');
        }}
      />
      {/* Always rendered so the Brick's container never changes position. */}
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
      {/* The Brick's container: React renders it empty and never touches
          its children. Hidden, not removed, once the payment is decided, so
          only the deferred unmount takes the Brick down. */}
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
