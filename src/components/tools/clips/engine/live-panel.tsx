'use client';

// Clips · En vivo (mode "a"): the RTMP server + stream key to paste into OBS
// (key hidden until "Mostrar"), rotating the key (asks first: the old key
// stops working), and the En vivo ↔ Clips switch (VIP).

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { errorText, toolCall, type ErrorCopy } from './tool-call';

export interface LivePanelCopy {
  server: string;
  key: string;
  show: string;
  hide: string;
  copy: string;
  copied: string;
  noKey: string;
  makeKey: string;
  rotate: string;
  rotateConfirm: string;
  rotateYes: string;
  rotateNo: string;
  rotated: string;
  working: string;
  connection: string;
  connectionOn: string;
  connectionOff: string;
  errors: ErrorCopy;
}

interface LiveState {
  rtmp_url: string | null;
  key: { value: string; masked: string } | null;
  chalybobs: { full_access: boolean; has_external: boolean; connected: boolean };
}

export function LivePanel({ initial, copy }: { initial: LiveState; copy: LivePanelCopy }) {
  const [s, setS] = useState(initial);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function copyText(what: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {}
  }

  async function call(path: string, body?: unknown, ok?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const next = await toolCall<LiveState>(path, 'POST', body);
      setS(next);
      if (ok) setMsg({ ok: true, text: ok });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, copy.errors) });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <div className="ch-ce-stack">
      {s.rtmp_url && (
        <div className="ch-ce-field">
          {copy.server}
          <div className="ch-ce-ro">
            <code>{s.rtmp_url}</code>
            <button
              type="button"
              className="ch-btn ch-btn--secondary ch-btn--compact"
              onClick={() => copyText('server', s.rtmp_url!)}
            >
              {copied === 'server' ? copy.copied : copy.copy}
            </button>
          </div>
        </div>
      )}
      <div className="ch-ce-field">
        {copy.key}
        {s.key ? (
          <div className="ch-ce-ro">
            <code aria-live="polite">{shown ? s.key.value : `••••••••••••  ${s.key.masked}`}</code>
            <button
              type="button"
              className="ch-btn ch-btn--secondary ch-btn--compact"
              onClick={() => setShown((v) => !v)}
            >
              {shown ? copy.hide : copy.show}
            </button>
            <button
              type="button"
              className="ch-btn ch-btn--secondary ch-btn--compact"
              onClick={() => copyText('key', s.key!.value)}
            >
              {copied === 'key' ? copy.copied : copy.copy}
            </button>
          </div>
        ) : (
          <p className="ch-ce-note">{copy.noKey}</p>
        )}
      </div>
      {!confirm ? (
        <div className="ch-ce-actions">
          <button
            type="button"
            className="ch-btn ch-btn--gray"
            disabled={busy}
            onClick={() => (s.key ? setConfirm(true) : call('/live/rotate-key'))}
          >
            {busy ? copy.working : s.key ? copy.rotate : copy.makeKey}
          </button>
        </div>
      ) : (
        <div className="ch-card ch-ce-card" role="alertdialog" aria-labelledby="ce-rot">
          <p id="ce-rot">{copy.rotateConfirm}</p>
          <div className="ch-ce-actions">
            <button
              type="button"
              className="ch-btn ch-btn--danger"
              disabled={busy}
              onClick={() => call('/live/rotate-key', undefined, copy.rotated)}
            >
              {busy ? copy.working : copy.rotateYes}
            </button>
            <button
              type="button"
              className="ch-btn ch-btn--secondary"
              onClick={() => setConfirm(false)}
            >
              {copy.rotateNo}
            </button>
          </div>
        </div>
      )}
      {s.chalybobs.full_access && s.chalybobs.has_external && (
        <div className="ch-setrow" style={{ padding: '10px 0' }}>
          <span className="ch-setrow__tx">
            <b>{copy.connection}</b>
            <span className="ch-muted">
              {s.chalybobs.connected ? copy.connectionOn : copy.connectionOff}
            </span>
          </span>
          <Switch
            checked={s.chalybobs.connected}
            label={copy.connection}
            disabled={busy}
            onChange={(v) => call('/live/connection', { enabled: v })}
          />
        </div>
      )}
      {msg && (
        <p className={msg.ok ? 'ch-ce-ok' : 'ch-ce-err'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
