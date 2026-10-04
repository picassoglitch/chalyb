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

interface TargetJob {
  id: string;
  sourceUrl: string;
  normalized: string | null;
  createdAt: string;
}

export function TakedownActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations('admin.legal');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [jobs, setJobs] = useState<TargetJob[] | null>(null);
  const [source, setSource] = useState('');
  const [normalized, setNormalized] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [counter, setCounter] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setMsg(null);
    const r = (await post({ kind: 'takedown', id, action, ...extra })) as Awaited<
      ReturnType<typeof post>
    > & {
      jobs?: TargetJob[];
      normalized?: string | null;
      hidden?: number;
    };
    setBusy(false);
    return r;
  };
  const codeMsg = (code?: string) =>
    code === 'user'
      ? t('takedown.noUser')
      : code === 'no_job'
        ? t('takedown.noJob')
        : code === 'source'
          ? t('takedown.badSource')
          : code === 'reason'
            ? t('takedown.needReason')
            : t('error');

  async function lookup() {
    const r = await call('lookup', { targetEmail: email });
    if (r.ok) {
      setJobs(r.jobs ?? []);
      setSource('');
      setNormalized(null);
    } else {
      setJobs(null);
      setMsg(codeMsg(r.code));
    }
  }
  async function pick(url: string) {
    setSource(url);
    setNormalized(null);
    if (!url.trim()) return;
    const r = await call('preview', { sourceUrl: url });
    setNormalized(r.ok ? (r.normalized ?? null) : null);
    if (!r.ok) setMsg(t('takedown.badSource'));
  }
  async function act(action: string, extra: Record<string, unknown> = {}) {
    const r = await call(action, extra);
    if (r.ok) {
      if (r.repeat) setMsg(t('takedown.repeat'));
      else if (typeof r.hidden === 'number') setMsg(t('takedown.done', { n: r.hidden }));
      router.refresh();
    } else setMsg(codeMsg(r.code));
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {status === 'received' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="ch-sr" htmlFor={`te-${id}`}>
              {t('takedown.targetEmail')}
            </label>
            <input
              id={`te-${id}`}
              className="ch-input"
              style={{ minWidth: 220, flex: 1 }}
              value={email}
              placeholder={t('takedown.targetEmail')}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="button"
              className="ch-btn ch-btn--secondary ch-btn--compact"
              disabled={busy || !email.trim()}
              onClick={lookup}
            >
              {t('takedown.lookup')}
            </button>
          </div>
          {jobs && (
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              <legend className="ch-label">{t('takedown.pickSource')}</legend>
              {jobs.length === 0 && <p className="ch-muted">{t('takedown.noJobs')}</p>}
              {jobs.map((j) => (
                <label key={j.id} className="ch-check" style={{ alignItems: 'flex-start' }}>
                  <input
                    type="radio"
                    name={`src-${id}`}
                    checked={source === j.sourceUrl}
                    onChange={() => pick(j.sourceUrl)}
                  />
                  <span style={{ overflowWrap: 'anywhere' }}>{j.sourceUrl}</span>
                </label>
              ))}
              <label className="ch-sr" htmlFor={`su-${id}`}>
                {t('takedown.sourceUrl')}
              </label>
              <input
                id={`su-${id}`}
                className="ch-input"
                value={source}
                placeholder={t('takedown.sourceUrl')}
                onChange={(e) => setSource(e.target.value)}
                onBlur={(e) => pick(e.target.value)}
              />
              {normalized && <p>{t('takedown.willBlock', { fuente: normalized })}</p>}
              <div>
                <button
                  type="button"
                  className="ch-btn ch-btn--primary ch-btn--compact"
                  disabled={busy || !normalized}
                  onClick={() => act('remove', { targetEmail: email, sourceUrl: source })}
                >
                  {t('takedown.remove')}
                </button>
              </div>
            </fieldset>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="ch-sr" htmlFor={`rr-${id}`}>
              {t('takedown.rejectReason')}
            </label>
            <input
              id={`rr-${id}`}
              className="ch-input"
              style={{ minWidth: 220, flex: 1 }}
              value={reason}
              placeholder={t('takedown.rejectReason')}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              type="button"
              className="ch-btn ch-btn--secondary ch-btn--compact"
              disabled={busy || !reason.trim()}
              onClick={() => act('reject', { reason })}
            >
              {t('takedown.reject')}
            </button>
          </div>
        </>
      )}
      {status === 'removed' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="ch-sr" htmlFor={`ct-${id}`}>
            {t('takedown.counterText')}
          </label>
          <input
            id={`ct-${id}`}
            className="ch-input"
            style={{ minWidth: 220, flex: 1 }}
            value={counter}
            placeholder={t('takedown.counterText')}
            onChange={(e) => setCounter(e.target.value)}
          />
          <button
            type="button"
            className="ch-btn ch-btn--secondary ch-btn--compact"
            disabled={busy || !counter.trim()}
            onClick={() => act('counter', { text: counter })}
          >
            {t('takedown.counter')}
          </button>
        </div>
      )}
      {status === 'counter_noticed' && (
        <div>
          <button
            type="button"
            className="ch-btn ch-btn--secondary ch-btn--compact"
            disabled={busy}
            onClick={() => act('uphold')}
          >
            {t('takedown.uphold')}
          </button>
        </div>
      )}
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
