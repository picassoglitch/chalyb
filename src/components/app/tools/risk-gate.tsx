'use client';

// The risk notice (aceptacion-ux §6): blocks Señales, Pronósticos and
// Inversiones until the user ticks the box, once per tool and per legal
// version. The server refuses the tool's actions and launch without it, so
// closing this or editing the URL changes nothing.

import { useState } from 'react';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Markup } from '@/components/ui/markup';

export function RiskGate({ slug, toolName }: { slug: string; toolName: string }) {
  const t = useTranslations('consents.risk');
  const locale = useLocale();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function accept() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/tools/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'risk', slug, checked, locale }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="risk-title" className="ch-gate">
      <div className="ch-card ch-gate__card">
        <h1 id="risk-title" className="ch-h2">
          {t('title')}
        </h1>
        <p>
          <Markup text={t.markup('body', { herramienta: toolName, b: (c) => `<b>${c}</b>` })} />
        </p>
        <Link href={'/uso-aceptable#avisos' as Route} className="ch-lnk">
          {t('read')}
        </Link>
        <label className="ch-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{t('check')}</span>
        </label>
        {error && (
          <p role="alert" style={{ color: 'var(--bad)' }}>
            {t('error')}
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ch-btn ch-btn--primary"
            disabled={!checked || busy}
            onClick={accept}
          >
            {t('cta')}
          </button>
          <button
            type="button"
            className="ch-btn ch-btn--gray"
            aria-label={t('close')}
            onClick={() => router.push('/app' as Route)}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
