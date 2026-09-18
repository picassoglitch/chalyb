'use client';

// Mercado Pago Card Payment Brick, hosted in a same-origin iframe.
//
// The Brick itself lives in /mp/card-brick.html (public/mp/card-brick.html):
// the plain, documented integration — the SDK script tag, the documented
// container id, one bricks().create() — in a document that has nothing
// else in it. No React reconciliation, no app CSS, no app scripts, no
// StrictMode, no Suspense: nothing on the app page can touch the Brick's
// DOM while its bundle and secure-field iframes are loading, which is what
// kept breaking it when it was mounted inline. Leaving the checkout removes
// the iframe and the browser tears the Brick down; there is no unmount to
// time right.
//
// This component owns the conversation with that page over postMessage
// (origin-checked, same origin both ways), the status/error UI around the
// form, and the watchdog that names the stage that stalled. The card fields
// are Mercado Pago's own iframes inside the host page (PCI stays with them).
// onSubmit hands us a single-use token; the caller's server function turns
// it into a preapproval or an order and decides the price. Nothing here is
// trusted for money.

import { useCallback, useEffect, useRef, useState } from 'react';

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
  /** Another way to pay (a link to the Mercado Pago-hosted checkout).
   *  Always rendered under the form; the load-failure banner points at it. */
  fallback?: React.ReactNode;
}

interface BrickFormData {
  token: string;
  issuer_id?: string;
  payment_method_id: string;
  installments?: number;
  payer?: { email?: string; identification?: { type: string; number: string } };
}

const HOST_PATH = '/mp/card-brick.html';
const WATCHDOG_MS = 20_000;
const INITIAL_HEIGHT = 330;

type Phase = 'loading' | 'ready' | 'processing' | 'done' | 'pending';
type Stage = 'host' | 'sdk' | 'create' | 'onReady' | 'ready';

type HostMessage =
  | { type: 'chalyb-mp:host-ready' }
  | { type: 'chalyb-mp:sdk-failed' }
  | { type: 'chalyb-mp:stage'; stage: 'create' | 'created' }
  | { type: 'chalyb-mp:ready' }
  | { type: 'chalyb-mp:error'; errorType?: string; cause?: string; message?: string }
  | {
      type: 'chalyb-mp:submit';
      id: number;
      formData: BrickFormData;
      additionalData: { paymentTypeId?: string } | null;
    }
  | { type: 'chalyb-mp:resize'; height: number }
  | { type: 'chalyb-mp:extension'; script: string; extensionId: string };

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
  fallback,
}: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [height, setHeight] = useState(INITIAL_HEIGHT);
  const [loadFailed, setLoadFailed] = useState(false);

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const stageRef = useRef<Stage>('host');
  const brickErrors = useRef<string[]>([]);
  const busy = useRef(false);
  const initSent = useRef(false);
  // A browser extension seen inside the Brick's stack traces, if any.
  const extensionRef = useRef<{ script: string; extensionId: string } | null>(null);

  // Read at init time so a parent re-render never re-initialises the Brick.
  const settingsRef = useRef({ publicKey, amount, payerEmail, maxInstallments, submitLabel });
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    settingsRef.current = { publicKey, amount, payerEmail, maxInstallments, submitLabel };
    onSubmitRef.current = onSubmit;
  }, [publicKey, amount, payerEmail, maxInstallments, submitLabel, onSubmit]);

  const post = useCallback((msg: Record<string, unknown>) => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(msg, window.location.origin);
  }, []);

  const sendInit = useCallback(() => {
    if (initSent.current) return;
    initSent.current = true;
    const s = settingsRef.current;
    if (stageRef.current === 'host') stageRef.current = 'sdk';
    log('initialising the host page', { amount: s.amount, maxInstallments: s.maxInstallments });
    post({
      type: 'chalyb-mp:init',
      publicKey: s.publicKey,
      amount: s.amount,
      payerEmail: s.payerEmail,
      maxInstallments: s.maxInstallments,
      submitLabel: s.submitLabel,
      locale: 'es-MX',
    });
  }, [post]);

  const failLoad = useCallback((message: string) => {
    setLoadFailed(true);
    const ext = extensionRef.current;
    const withExtension = ext
      ? `${message} Una extensión del navegador (${ext.script}, id ${ext.extensionId}) está interfiriendo con el formulario: pruébalo en una ventana de incógnito o desactívala en chrome://extensions.`
      : message;
    setError((prev) => prev ?? withExtension);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data.type !== 'string') return;

      switch (data.type) {
        case 'chalyb-mp:host-ready':
          log('host page ready');
          sendInit();
          break;
        case 'chalyb-mp:sdk-failed':
          console.error('[mercadopago brick] SDK script failed to load in the host page');
          failLoad('No se pudo cargar el script de Mercado Pago (sdk.mercadopago.com).');
          break;
        case 'chalyb-mp:stage':
          if (data.stage === 'create') {
            stageRef.current = 'create';
            log('creating Brick');
          } else if (data.stage === 'created') {
            if (stageRef.current === 'create') stageRef.current = 'onReady';
            log('Brick created; waiting for onReady');
          }
          break;
        case 'chalyb-mp:ready':
          stageRef.current = 'ready';
          log('Brick ready');
          setError(null);
          setLoadFailed(false);
          setPhase('ready');
          break;
        case 'chalyb-mp:error': {
          const line = `${data.cause ?? 'sin_causa'}: ${data.message ?? ''}`;
          brickErrors.current.push(line);
          if (data.errorType === 'critical') {
            console.error('[mercadopago brick] critical error', data);
            const text = `El formulario de pago falló: ${data.message ?? 'error'}${
              data.cause ? ` (${data.cause})` : ''
            }`;
            if (stageRef.current !== 'ready') failLoad(text);
            else setError(text);
          } else {
            log('non-critical error', data);
          }
          break;
        }
        case 'chalyb-mp:resize':
          if (typeof data.height === 'number' && data.height > 0) {
            setHeight(Math.max(40, Math.ceil(data.height)));
          }
          break;
        case 'chalyb-mp:extension':
          extensionRef.current = { script: data.script, extensionId: data.extensionId };
          console.error(
            `[mercadopago brick] a browser extension is running inside the Brick's stack: ${data.script} (extension id ${data.extensionId}). Test in an incognito window or disable it.`,
          );
          break;
        case 'chalyb-mp:submit':
          void handleSubmit(data.id, data.formData, data.additionalData);
          break;
      }
    };

    async function handleSubmit(
      id: number,
      form: BrickFormData,
      extra: { paymentTypeId?: string } | null,
    ) {
      if (busy.current) {
        post({ type: 'chalyb-mp:submit-result', id, ok: false, error: 'busy' });
        return;
      }
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
          post({ type: 'chalyb-mp:submit-result', id, ok: true });
        } else if (result.ok) {
          setNotice(result.message);
          setPhase('pending');
          post({ type: 'chalyb-mp:submit-result', id, ok: true });
        } else {
          setError(result.error);
          setPhase('ready');
          post({ type: 'chalyb-mp:submit-result', id, ok: false, error: result.error });
        }
      } catch (err) {
        console.error('[mercadopago brick] submit failed', err);
        const message = 'No pudimos completar el pago. Inténtalo de nuevo en un momento.';
        setError(message);
        setPhase('ready');
        post({ type: 'chalyb-mp:submit-result', id, ok: false, error: message });
      } finally {
        busy.current = false;
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post, sendInit, failLoad]);

  // Names the stage that stalled if the Brick never reports ready.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (stageRef.current === 'ready') return;
      const stage =
        stageRef.current === 'host'
          ? 'la página del formulario (/mp/card-brick.html) no respondió'
          : stageRef.current === 'sdk'
            ? 'el script de Mercado Pago (sdk.mercadopago.com) no cargó'
            : stageRef.current === 'create'
              ? 'Mercado Pago no terminó de crear el formulario'
              : 'Mercado Pago creó el formulario pero nunca avisó que estuviera listo';
      const reported = brickErrors.current.length
        ? ` Errores reportados: ${Array.from(new Set(brickErrors.current)).join(' · ')}.`
        : ' Sin errores reportados por Mercado Pago.';
      console.error(
        `[mercadopago brick] watchdog after ${WATCHDOG_MS / 1000}s: ${stage}.${reported}`,
      );
      failLoad(`No pudimos cargar el formulario de pago: ${stage}.${reported}`);
    }, WATCHDOG_MS);
    return () => window.clearTimeout(t);
  }, [failLoad]);

  const finished = phase === 'done' || phase === 'pending';
  const statusText =
    phase === 'loading' && !error
      ? 'Preparando el formulario de pago…'
      : phase === 'processing'
        ? 'Procesando el pago con Mercado Pago…'
        : null;

  return (
    <div>
      <div style={{ minHeight: finished ? 0 : 22 }}>
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
                {loadFailed && fallback && (
                  <span style={{ display: 'block', marginTop: 6, color: 'var(--cc-txt-2)' }}>
                    Puedes pagar igual con la opción de abajo, en la página de Mercado Pago.
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* The host page. Hidden, not removed, once the payment is decided;
          removed only when the checkout is left. */}
      <iframe
        ref={frameRef}
        src={HOST_PATH}
        title="Formulario de pago de Mercado Pago"
        scrolling="no"
        onLoad={() => {
          log('host page loaded');
          // The host posts host-ready on its own; this covers a listener
          // that attached after that message went by.
          sendInit();
        }}
        style={{
          display: finished || loadFailed ? 'none' : 'block',
          width: '100%',
          height,
          border: 0,
          background: 'transparent',
          colorScheme: 'dark',
          opacity: phase === 'processing' ? 0.6 : 1,
          pointerEvents: phase === 'processing' ? 'none' : 'auto',
          transition: 'height 120ms ease-out',
        }}
      />

      {fallback && !finished && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--cc-line)' }}>
          {fallback}
        </div>
      )}
    </div>
  );
}
