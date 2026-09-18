'use client';

// Mercado Pago Card Payment Brick, hosted in an isolated document.
//
// The Brick lives in /mp/card-brick.html (public/mp/card-brick.html): the
// plain, documented integration — SDK script tag, documented container id,
// one bricks().create() — with no app code in the document. This component
// loads that document in an iframe and talks to it over postMessage.
//
// It tries the document in more than one isolation, in order, and moves on
// the moment an attempt is poisoned, so the buyer gets a form and not a
// wait:
//
//   frame  the document at its https URL. Nothing from the app page (React,
//          CSS, scripts) is in it. Browser extensions that only inject into
//          the top frame never see it.
//   blob   the same document served from a blob: URL of this origin.
//          Extension content scripts match by URL pattern, and blob: URLs
//          match none of them, so an extension that injects into every
//          frame stays out of this one.
//
// An attempt is abandoned when the host reports an uncaught error while the
// Brick is coming up (poisoned), when the SDK cannot load, on a critical
// Brick error, or when a watchdog runs out. If every strategy fails, the
// banner says what happened and the hosted Mercado Pago button under the
// form takes the payment. The console narrates every step under
// [mercadopago brick].
//
// The card fields are Mercado Pago's own iframes inside the host document
// (PCI stays with them). onSubmit hands us a single-use token; the caller's
// server function turns it into a preapproval or an order and decides the
// price. Nothing here is trusted for money.

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
  /** Another way to pay (the Mercado Pago-hosted checkout). Always rendered
   *  under the form; when every attempt fails it is the way forward. */
  fallback?: React.ReactNode;
}

const HOST_PATH = '/mp/card-brick.html';
const STRATEGIES = ['frame', 'blob'] as const;
type Strategy = (typeof STRATEGIES)[number];

/** Per attempt: how long the Brick may take to report ready. */
const ATTEMPT_TIMEOUT_MS = 15_000;
/** After a poisoned report: how long ready may still arrive before the
 *  attempt is abandoned. */
const POISON_GRACE_MS = 3_000;
/** The init message is resent at this interval until the host answers it,
 *  so the handshake does not hang on one lost message or a stalled load
 *  event. The host ignores repeats. */
const INIT_RETRY_MS = 400;
const INITIAL_HEIGHT = 330;

type Phase = 'loading' | 'ready' | 'processing' | 'done' | 'pending';

interface BrickSettings {
  publicKey: string;
  amount: number;
  payerEmail: string | null;
  maxInstallments: number;
  submitLabel: string;
}

interface BrickFormData {
  token: string;
  issuer_id?: string;
  payment_method_id: string;
  installments?: number;
  payer?: { email?: string; identification?: { type: string; number: string } };
}

interface ExtensionInfo {
  script: string;
  extensionId: string;
}

type HostMessage =
  | { type: 'chalyb-mp:host-ready' }
  | { type: 'chalyb-mp:init-ack' }
  | { type: 'chalyb-mp:sdk-failed' }
  | { type: 'chalyb-mp:stage'; stage: 'create' | 'created' }
  | { type: 'chalyb-mp:ready' }
  | { type: 'chalyb-mp:error'; errorType?: string; cause?: string; message?: string }
  | { type: 'chalyb-mp:poisoned'; count: number; sample: string }
  | { type: 'chalyb-mp:extension'; script: string; extensionId: string }
  | {
      type: 'chalyb-mp:submit';
      id: number;
      formData: BrickFormData;
      additionalData: { paymentTypeId?: string } | null;
    }
  | { type: 'chalyb-mp:resize'; height: number };

function log(step: string, detail?: unknown) {
  if (detail === undefined) console.info(`[mercadopago brick] ${step}`);
  else console.info(`[mercadopago brick] ${step}`, detail);
}

// ── One attempt: one iframe, one strategy ──────────────────────────────────

interface AttemptProps {
  strategy: Strategy;
  settings: BrickSettings;
  hidden: boolean;
  dimmed: boolean;
  onReady: () => void;
  onFail: (reason: string) => void;
  onExtension: (info: ExtensionInfo) => void;
  onSubmit: (form: BrickFormData, extra: { paymentTypeId?: string } | null) => Promise<boolean>;
}

function BrickAttempt({
  strategy,
  settings,
  hidden,
  dimmed,
  onReady,
  onFail,
  onExtension,
  onSubmit,
}: AttemptProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [src, setSrc] = useState<string | null>(strategy === 'frame' ? HOST_PATH : null);
  const [height, setHeight] = useState(INITIAL_HEIGHT);

  const settingsRef = useRef(settings);
  const callbacks = useRef({ onReady, onFail, onExtension, onSubmit });
  useEffect(() => {
    settingsRef.current = settings;
    callbacks.current = { onReady, onFail, onExtension, onSubmit };
  }, [settings, onReady, onFail, onExtension, onSubmit]);

  // Lifecycle of this attempt. `done` is set once it has reported ready or
  // failed; nothing after that counts.
  const stage = useRef<'load' | 'sdk' | 'create' | 'onReady' | 'ready'>('load');
  const done = useRef(false);
  const initAcked = useRef(false);
  const errors = useRef<string[]>([]);
  const poisonTimer = useRef<number | null>(null);

  const fail = useCallback(
    (reason: string) => {
      if (done.current) return;
      done.current = true;
      if (poisonTimer.current !== null) window.clearTimeout(poisonTimer.current);
      console.error(`[mercadopago brick] attempt "${strategy}" failed: ${reason}`);
      callbacks.current.onFail(reason);
    },
    [strategy],
  );

  const post = useCallback((msg: Record<string, unknown>) => {
    const win = frameRef.current?.contentWindow;
    if (win) win.postMessage(msg, window.location.origin);
  }, []);

  const sendInit = useCallback(() => {
    if (initAcked.current || done.current) return;
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    if (stage.current === 'load') {
      stage.current = 'sdk';
      const s = settingsRef.current;
      log(`attempt "${strategy}": initialising the host document`, {
        amount: s.amount,
        maxInstallments: s.maxInstallments,
      });
    }
    const s = settingsRef.current;
    post({
      type: 'chalyb-mp:init',
      strategy,
      publicKey: s.publicKey,
      amount: s.amount,
      payerEmail: s.payerEmail,
      maxInstallments: s.maxInstallments,
      submitLabel: s.submitLabel,
      locale: 'es-MX',
    });
  }, [post, strategy]);

  // Keep offering init until the host acknowledges it. Covers a host-ready
  // that went by before this listener existed and a load event that never
  // fires because some subresource of the SDK stalled.
  useEffect(() => {
    if (!src) return;
    const t = window.setInterval(() => {
      if (initAcked.current || done.current) {
        window.clearInterval(t);
        return;
      }
      sendInit();
    }, INIT_RETRY_MS);
    return () => window.clearInterval(t);
  }, [src, sendInit]);

  // The blob strategy builds its document from the same file.
  useEffect(() => {
    if (strategy !== 'blob') return;
    let url: string | null = null;
    let cancelled = false;
    fetch(HOST_PATH, { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${HOST_PATH}`);
        return res.text();
      })
      .then((html) => {
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        setSrc(url);
      })
      .catch((err: unknown) => {
        fail(`could not build the blob document: ${err instanceof Error ? err.message : err}`);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [strategy, fail]);

  // Messages from the host document.
  useEffect(() => {
    const onMessage = (event: MessageEvent<HostMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const data = event.data;
      if (!data || typeof data.type !== 'string') return;

      switch (data.type) {
        case 'chalyb-mp:host-ready':
          sendInit();
          break;
        case 'chalyb-mp:init-ack':
          if (!initAcked.current) {
            initAcked.current = true;
            log(`attempt "${strategy}": host acknowledged init`);
          }
          break;
        case 'chalyb-mp:sdk-failed':
          initAcked.current = true;
          fail('el script de Mercado Pago (sdk.mercadopago.com) no cargó');
          break;
        case 'chalyb-mp:stage':
          if (done.current) break;
          initAcked.current = true;
          if (data.stage === 'create') {
            stage.current = 'create';
            log(`attempt "${strategy}": creating Brick`);
          } else if (data.stage === 'created') {
            if (stage.current === 'create') stage.current = 'onReady';
            log(`attempt "${strategy}": Brick created; waiting for onReady`);
          }
          break;
        case 'chalyb-mp:ready':
          if (done.current) break;
          done.current = true;
          stage.current = 'ready';
          if (poisonTimer.current !== null) window.clearTimeout(poisonTimer.current);
          log(`attempt "${strategy}": Brick ready`);
          callbacks.current.onReady();
          break;
        case 'chalyb-mp:error': {
          const line = `${data.cause ?? 'sin_causa'}: ${data.message ?? ''}`;
          errors.current.push(line);
          if (data.errorType === 'critical') {
            fail(`Mercado Pago reportó un error crítico (${line})`);
          } else {
            log(`attempt "${strategy}": non-critical error`, data);
          }
          break;
        }
        case 'chalyb-mp:poisoned':
          // Something threw inside the host document while the Brick was
          // coming up. Give ready a moment, then move on.
          if (!done.current && poisonTimer.current === null) {
            console.warn(
              `[mercadopago brick] attempt "${strategy}": uncaught error in the host document while the Brick was loading (${data.sample})`,
            );
            poisonTimer.current = window.setTimeout(() => {
              poisonTimer.current = null;
              fail(
                `el formulario falló mientras cargaba (${data.count} error${data.count === 1 ? '' : 'es'}: ${data.sample})`,
              );
            }, POISON_GRACE_MS);
          }
          break;
        case 'chalyb-mp:extension':
          callbacks.current.onExtension({ script: data.script, extensionId: data.extensionId });
          break;
        case 'chalyb-mp:resize':
          if (typeof data.height === 'number' && data.height > 0) {
            setHeight(Math.max(40, Math.ceil(data.height)));
          }
          break;
        case 'chalyb-mp:submit':
          void callbacks.current
            .onSubmit(data.formData, data.additionalData)
            .then((ok) => post({ type: 'chalyb-mp:submit-result', id: data.id, ok }))
            .catch(() =>
              post({ type: 'chalyb-mp:submit-result', id: data.id, ok: false, error: 'failed' }),
            );
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [strategy, sendInit, fail, post]);

  // Watchdog: names the stage that stalled.
  useEffect(() => {
    if (!src) return;
    const t = window.setTimeout(() => {
      const where =
        stage.current === 'load'
          ? 'el documento del formulario no respondió'
          : stage.current === 'sdk'
            ? 'el script de Mercado Pago no cargó'
            : stage.current === 'create'
              ? 'Mercado Pago no terminó de crear el formulario'
              : 'Mercado Pago creó el formulario pero nunca avisó que estuviera listo';
      const reported = errors.current.length
        ? ` (errores: ${Array.from(new Set(errors.current)).join(' · ')})`
        : '';
      fail(`${where} en ${ATTEMPT_TIMEOUT_MS / 1000} s${reported}`);
    }, ATTEMPT_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [src, fail]);

  if (!src) return null;
  return (
    <iframe
      ref={frameRef}
      src={src}
      title="Formulario de pago de Mercado Pago"
      scrolling="no"
      onLoad={() => {
        log(`attempt "${strategy}": host document loaded`);
        // The host posts host-ready on its own; this covers a listener
        // that attached after that message went by.
        sendInit();
      }}
      style={{
        display: hidden ? 'none' : 'block',
        width: '100%',
        height,
        border: 0,
        background: 'transparent',
        colorScheme: 'dark',
        opacity: dimmed ? 0.6 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
        transition: 'height 120ms ease-out',
      }}
    />
  );
}

// ── The checkout form ──────────────────────────────────────────────────────

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
  const [attempt, setAttempt] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  const failures = useRef<string[]>([]);
  const extensions = useRef<ExtensionInfo[]>([]);
  const busy = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  // Settings are fixed for the life of the form: a parent re-render never
  // re-creates the Brick.
  const [settings] = useState<BrickSettings>(() => ({
    publicKey,
    amount,
    payerEmail,
    maxInstallments,
    submitLabel,
  }));

  const handleReady = useCallback(() => {
    setError(null);
    setPhase('ready');
  }, []);

  const handleExtension = useCallback((info: ExtensionInfo) => {
    if (extensions.current.some((e) => e.extensionId === info.extensionId)) return;
    extensions.current.push(info);
    console.warn(
      `[mercadopago brick] a browser extension injected ${info.script} (id ${info.extensionId}) into the form's document`,
    );
  }, []);

  const handleFail = useCallback(
    (reason: string) => {
      failures.current.push(`${STRATEGIES[attempt] ?? attempt}: ${reason}`);
      if (attempt + 1 < STRATEGIES.length) {
        log(`switching to attempt "${STRATEGIES[attempt + 1]}"`);
        setAttempt(attempt + 1);
        return;
      }
      const ext = extensions.current[0];
      const extNote = ext
        ? ` Una extensión del navegador (${ext.script}, id ${ext.extensionId}) se inyectó en el formulario.`
        : '';
      const detail = failures.current.join(' · ');
      console.error(`[mercadopago brick] every attempt failed: ${detail}`);
      setExhausted(true);
      setError(
        `No pudimos cargar el formulario de tarjeta en este navegador.${extNote}${
          fallback
            ? ' Paga en la página de Mercado Pago con el botón de abajo: mismo plan, mismo precio.'
            : ''
        } Detalle: ${detail}.`,
      );
    },
    [attempt, fallback],
  );

  const handleSubmit = useCallback(
    async (form: BrickFormData, extra: { paymentTypeId?: string } | null): Promise<boolean> => {
      if (busy.current) return false;
      busy.current = true;
      setError(null);
      setPhase('processing');
      try {
        const result = await onSubmitRef.current({
          token: form.token,
          paymentMethodId: form.payment_method_id,
          issuerId: form.issuer_id || null,
          installments: form.installments || 1,
          payerEmail: form.payer?.email ?? settings.payerEmail,
          identification: form.payer?.identification ?? null,
          paymentTypeId: extra?.paymentTypeId ?? null,
        });
        if (result.ok && result.outcome === 'approved') {
          setNotice(result.message ?? null);
          setPhase('done');
          return true;
        }
        if (result.ok) {
          setNotice(result.message);
          setPhase('pending');
          return true;
        }
        setError(result.error);
        setPhase('ready');
        return false;
      } catch (err) {
        console.error('[mercadopago brick] submit failed', err);
        setError('No pudimos completar el pago. Inténtalo de nuevo en un momento.');
        setPhase('ready');
        return false;
      } finally {
        busy.current = false;
      }
    },
    [settings.payerEmail],
  );

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
              </div>
            )}
          </>
        )}
      </div>

      {/* One iframe per attempt; the key retires the previous one. Hidden,
          not removed, once the payment is decided. */}
      {!exhausted && (
        <BrickAttempt
          key={attempt}
          strategy={STRATEGIES[attempt] ?? 'frame'}
          settings={settings}
          hidden={finished}
          dimmed={phase === 'processing'}
          onReady={handleReady}
          onFail={handleFail}
          onExtension={handleExtension}
          onSubmit={handleSubmit}
        />
      )}

      {fallback && !finished && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--cc-line)' }}>
          {fallback}
        </div>
      )}
    </div>
  );
}
