'use client';

// Dueño → Legal · "Quitar bloqueo" for one blocked source (a mistaken
// removal, or a licence shown later). Posts to /api/admin/legal.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

export function LiftBlockButton({ fingerprint }: { fingerprint: string }) {
  const t = useTranslations('admin.legal.blocks');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function lift() {
    setBusy(true);
    setError(false);
    const res = await fetch('/api/admin/legal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'block', action: 'lift', fingerprint }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) router.refresh();
    else setError(true);
  }
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        className="ch-btn ch-btn--secondary ch-btn--compact"
        disabled={busy}
        onClick={lift}
      >
        {t('lift')}
      </button>
      {error && <span role="alert">{t('error')}</span>}
    </span>
  );
}
