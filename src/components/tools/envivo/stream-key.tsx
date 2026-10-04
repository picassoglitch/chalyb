'use client';

// The stream key, masked until "Mostrar" (TOOLS-SPEC §6.3). Showing it asks
// for the password again (or a sign-in in the last 5 minutes); the key only
// lives in this component's memory once revealed and is never stored.

import { useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Sheet } from '@/components/ui/sheet';
import { MASKED_KEY } from '@/lib/tools/envivo-core';
import type { LivePlatform } from '@/lib/tools/adapters/tools';

export function StreamKey({
  platform,
  platformName,
}: {
  platform: LivePlatform;
  platformName: string;
}) {
  const t = useTranslations('liveTool.settings');
  const [key, setKey] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reveal(withPassword: string) {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/tools/chalybobs/stream-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, password: withPassword }),
      });
      const json = (await res.json()) as { ok: boolean; code?: string; data?: { key: string } };
      if (json.ok && json.data) {
        setKey(json.data.key);
        setAsk(false);
        setPassword('');
      } else if (json.code === 'REAUTH_REQUIRED') {
        if (ask) setError(true);
        setAsk(true);
      } else setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const id = `key-${platform}`;
  return (
    <div className="ch-ev-key">
      <label htmlFor={id} className="ch-ev-key__l">
        {t('key', { plataforma: platformName })}
      </label>
      <div className="ch-ev-key__row">
        <input id={id} className="ch-input ch-ev-key__v" readOnly value={key ?? MASKED_KEY} />
        {key ? (
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--compact"
            onClick={() => setKey(null)}
          >
            <EyeOff aria-hidden="true" />
            {t('hide')}
          </button>
        ) : (
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--compact"
            disabled={busy}
            onClick={() => void reveal('')}
          >
            <Eye aria-hidden="true" />
            {t('show')}
          </button>
        )}
      </div>
      <Sheet
        open={ask}
        onClose={() => setAsk(false)}
        title={t('revealTitle')}
        closeLabel={t('close')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void reveal(password);
          }}
          style={{ display: 'grid', gap: 14 }}
        >
          <p className="ch-muted">{t('revealBody')}</p>
          <label className="ch-field">
            <span>{t('password')}</span>
            <input
              type="password"
              className="ch-input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" style={{ color: 'var(--bad)' }}>
              {t('revealError')}
            </p>
          )}
          <button type="submit" className="ch-btn ch-btn--primary" disabled={busy || !password}>
            {t('revealCta')}
          </button>
          <p className="ch-muted" style={{ fontSize: 15 }}>
            {t('revealSignIn')}{' '}
            <Link href={'/sign-in?next=/app/en-vivo/ajustes' as Route} className="ch-lnk">
              {t('revealSignInCta')}
            </Link>
          </p>
        </form>
      </Sheet>
    </div>
  );
}
