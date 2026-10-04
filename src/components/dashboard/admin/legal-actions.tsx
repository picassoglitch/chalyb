'use client';

// Dueño → Legal: the buttons for one ARCO request or copyright notice. Each
// posts to /api/admin/legal and refreshes. Inline inputs, never a browser
// prompt.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/admin/legal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({ ok: false }))) as {
    ok: boolean;
    code?: string;
    repeat?: boolean;
  };
}

export function ArcoActions({ id, extended }: { id: string; extended: boolean }) {
  const t = useTranslations('admin.legal');
  const router = useRouter();
  const [outcome, setOutcome] = useState('granted');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(false);
    const r = await post({ kind: 'arco', id, ...body });
    setBusy(false);
    if (r.ok) router.refresh();
    else setError(true);
  };
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <label className="ch-sr" htmlFor={`o-${id}`}>
        {t('arco.outcome')}
      </label>
      <select
        id={`o-${id}`}
        className="ch-select"
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
      >
        {['granted', 'partially_granted', 'denied', 'incomplete'].map((o) => (
          <option key={o} value={o}>
            {t(`arco.outcomes.${o}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="ch-btn ch-btn--primary ch-btn--compact"
        disabled={busy}
        onClick={() => run({ action: 'answer', outcome })}
      >
        {t('arco.answer')}
      </button>
      {!extended && (
        <button
          type="button"
          className="ch-btn ch-btn--secondary ch-btn--compact"
          disabled={busy}
          onClick={() => run({ action: 'extend' })}
        >
          {t('arco.extend')}
        </button>
      )}
      {error && <span role="alert">{t('error')}</span>}
    </div>
  );
}

export function TakedownActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations('admin.legal');
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setMsg(null);
    const r = await post({ kind: 'takedown', id, action, ...extra });
    setBusy(false);
    if (r.ok) {
      if (r.repeat) setMsg(t('takedown.repeat'));
      router.refresh();
    } else setMsg(r.code === 'user' ? t('takedown.noUser') : t('error'));
  };
  const input = (label: string) => (
    <>
      <label className="ch-sr" htmlFor={`t-${id}`}>
        {label}
      </label>
      <input
        id={`t-${id}`}
        className="ch-input"
        style={{ minWidth: 220, flex: 1 }}
        value={text}
        placeholder={label}
        onChange={(e) => setText(e.target.value)}
      />
    </>
  );
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {status === 'received' && (
        <>
          {input(t('takedown.targetEmail'))}
          <button
            type="button"
            className="ch-btn ch-btn--primary ch-btn--compact"
            disabled={busy || !text.trim()}
            onClick={() => run('remove', { targetEmail: text })}
          >
            {t('takedown.remove')}
          </button>
          <button
            type="button"
            className="ch-btn ch-btn--secondary ch-btn--compact"
            disabled={busy}
            onClick={() => run('reject', { reason: text })}
          >
            {t('takedown.reject')}
          </button>
        </>
      )}
      {status === 'removed' && (
        <>
          {input(t('takedown.counterText'))}
          <button
            type="button"
            className="ch-btn ch-btn--secondary ch-btn--compact"
            disabled={busy || !text.trim()}
            onClick={() => run('counter', { text })}
          >
            {t('takedown.counter')}
          </button>
        </>
      )}
      {status === 'counter_noticed' && (
        <button
          type="button"
          className="ch-btn ch-btn--secondary ch-btn--compact"
          disabled={busy}
          onClick={() => run('uphold')}
        >
          {t('takedown.uphold')}
        </button>
      )}
      {msg && <span role="status">{msg}</span>}
    </div>
  );
}
