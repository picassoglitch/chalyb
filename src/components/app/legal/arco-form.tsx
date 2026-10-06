'use client';

// "Mis datos (derechos ARCO)" (Aviso de privacidad §5.2): which right, what
// data, and for a correction the right value. Identity is the signed-in
// account; the answer goes to its email within the legal deadline.

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

const RIGHTS = ['access', 'rectification', 'cancellation', 'opposition', 'automated'] as const;

export function ArcoForm({ email }: { email: string }) {
  const t = useTranslations('arco.form');
  const locale = useLocale();
  const router = useRouter();
  const [right, setRight] = useState<(typeof RIGHTS)[number]>('access');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      right,
      description: String(fd.get('description') ?? ''),
      dataLocation: String(fd.get('dataLocation') ?? ''),
      correctValue: String(fd.get('correctValue') ?? ''),
      locale,
    };
    if (!body.description.trim()) return setError('description');
    if (right === 'rectification' && !body.correctValue.trim()) return setError('correctValue');
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/legal/arco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string };
      if (!res.ok || !j.ok) {
        setError(
          ['description', 'correctValue', 'rateLimited'].includes(j.code ?? '') ? j.code! : 'send',
        );
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError('send');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="ch-card" style={{ fontWeight: 600 }}>
        {t('sent')}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="ch-card" style={{ display: 'grid', gap: 18 }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10 }}>
        <legend className="ch-label" style={{ marginBottom: 8 }}>
          {t('right')}
        </legend>
        {RIGHTS.map((r) => (
          <label key={r} className="ch-check" style={{ alignItems: 'flex-start' }}>
            <input
              type="radio"
              name="right"
              value={r}
              checked={right === r}
              onChange={() => setRight(r)}
            />
            <span>
              <b>{t(`rights.${r}.title`)}</b>
              <br />
              <span className="ch-muted">{t(`rights.${r}.body`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className={`ch-field${error === 'description' ? ' ch-field--bad' : ''}`}>
        <label htmlFor="arco-description">{t('description')}</label>
        <textarea
          id="arco-description"
          name="description"
          className="ch-input"
          rows={4}
          maxLength={4000}
          aria-invalid={error === 'description' || undefined}
          aria-describedby={error === 'description' ? 'arco-err' : undefined}
        />
      </div>
      <div className="ch-field">
        <label htmlFor="arco-location">
          {t('dataLocation')} ({t('optional')})
        </label>
        <input id="arco-location" name="dataLocation" className="ch-input" maxLength={2000} />
      </div>
      {right === 'rectification' && (
        <div className={`ch-field${error === 'correctValue' ? ' ch-field--bad' : ''}`}>
          <label htmlFor="arco-correct">{t('correctValue')}</label>
          <input
            id="arco-correct"
            name="correctValue"
            className="ch-input"
            maxLength={2000}
            aria-invalid={error === 'correctValue' || undefined}
            aria-describedby={error === 'correctValue' ? 'arco-err' : undefined}
          />
        </div>
      )}
      <p className="ch-muted">{t('identity', { correo: email })}</p>
      {error && (
        <p id="arco-err" role="alert" className="ch-field__err">
          {t(`errors.${error}`)}
        </p>
      )}
      <div>
        <button type="submit" className="ch-btn ch-btn--primary" disabled={busy}>
          {t('submit')}
        </button>
      </div>
    </form>
  );
}
