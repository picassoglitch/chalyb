'use client';

// "Cerrar mi cuenta": an unchecked box and one button, disabled until the box
// is ticked or while the credit balance is unknown. The server re-reads the
// balance and refuses a number that changed since this screen showed it.

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { formatFechaLarga } from '@/lib/billing/format';

type Err = 'credits_changed' | 'not_confirmed' | 'mp_error' | 'rateLimited' | 'send';

export function CloseAccountForm({ creditsShown }: { creditsShown: number | null }) {
  const t = useTranslations('closeAccount');
  const locale = useLocale();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Err | null>(null);
  const [respondBy, setRespondBy] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditsShown, confirmed: checked, locale }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        respondBy?: string;
      };
      if (res.ok && j.ok && j.respondBy) {
        setRespondBy(j.respondBy);
        return;
      }
      if (j.code === 'credits_changed' || j.code === 'already_requested') {
        // Show the current number (or the open request) again.
        if (j.code === 'credits_changed') setError('credits_changed');
        router.refresh();
        return;
      }
      setError(
        (['not_confirmed', 'mp_error', 'rateLimited'] as const).find((c) => c === j.code) ?? 'send',
      );
    } catch {
      setError('send');
    } finally {
      setBusy(false);
    }
  }

  if (respondBy)
    return (
      <p role="status" className="ch-card" style={{ fontWeight: 600 }}>
        {t('done', { fecha: formatFechaLarga(respondBy, locale) })}
      </p>
    );

  return (
    <div className="ch-card" style={{ display: 'grid', gap: 16 }}>
      <label className="ch-check">
        <input
          type="checkbox"
          checked={checked}
          disabled={creditsShown === null}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>{t('check')}</span>
      </label>
      {error && (
        <p role="alert" style={{ color: 'var(--bad)' }}>
          {t(`errors.${error}`)}
        </p>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="ch-btn ch-btn--danger"
          disabled={!checked || busy || creditsShown === null}
          onClick={submit}
        >
          {t('cta')}
        </button>
        <Link href="/app/settings" className="ch-btn ch-btn--gray">
          {t('back')}
        </Link>
      </div>
    </div>
  );
}
