'use client';

// A stream key, masked until "Mostrar" (TOOLS-SPEC §6.3–§6.4). Showing it
// asks for the password again (or a sign-in in the last 5 minutes); the key
// only lives in this component's memory once revealed and is never stored.
// `target` is "ingest" (the key the encoder uses) or a destination's id.

import { useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Sheet } from '@/components/ui/sheet';
import { MASKED_KEY } from '@/lib/tools/envivo-core';

export type KeyTarget = 'ingest' | { id: string };

/** "Mostrar" with re-authentication. `reveal('')` tries without a password
 *  (a recent sign-in is enough); REAUTH_REQUIRED opens the password sheet. */
export function useKeyReveal(target: KeyTarget) {
  const [key, setKey] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<'wrong' | 'limit' | 'other' | null>(null);
  const [busy, setBusy] = useState(false);

  async function reveal(password: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/tools/chalybobs/stream-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target === 'ingest' ? 'ingest' : target.id, password }),
      });
      const json = (await res.json()) as { ok: boolean; code?: string; data?: { key: string } };
      if (json.ok && json.data) {
        setKey(json.data.key);
        setAsk(false);
        return true;
      }
      if (json.code === 'REAUTH_REQUIRED') {
        if (password) setError('wrong');
        setAsk(true);
      } else setError(json.code === 'RATE_LIMITED' ? 'limit' : 'other');
    } catch {
      setError('other');
    } finally {
      setBusy(false);
    }
    return false;
  }
  return { key, hide: () => setKey(null), ask, setAsk, error, busy, reveal };
}

export function ReauthSheet({
  r,
  next,
}: {
  r: ReturnType<typeof useKeyReveal>;
  /** Where "Volver a iniciar sesión" comes back to. */
  next: string;
}) {
  const t = useTranslations('liveTool.settings');
  const [password, setPassword] = useState('');
  return (
    <Sheet
      open={r.ask}
      onClose={() => r.setAsk(false)}
      title={t('revealTitle')}
      closeLabel={t('close')}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void r.reveal(password).then((ok) => ok && setPassword(''));
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
        {r.error && (
          <p role="alert" style={{ color: 'var(--bad)' }}>
            {r.error === 'wrong'
              ? t('revealError')
              : r.error === 'limit'
                ? t('revealLimit')
                : t('saveError')}
          </p>
        )}
        <button type="submit" className="ch-btn ch-btn--primary" disabled={r.busy || !password}>
          {t('revealCta')}
        </button>
        <p className="ch-muted" style={{ fontSize: 15 }}>
          {t('revealSignIn')}{' '}
          <Link href={`/sign-in?next=${encodeURIComponent(next)}` as Route} className="ch-lnk">
            {t('revealSignInCta')}
          </Link>
        </p>
      </form>
    </Sheet>
  );
}

/** Copy to the clipboard with a short "Copiado". */
export function CopyButton({ value, disabled }: { value: string; disabled?: boolean }) {
  const t = useTranslations('liveTool.encoder');
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ch-btn ch-btn--gray ch-btn--compact"
      disabled={disabled}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        } catch {}
      }}
    >
      <Copy aria-hidden="true" />
      {done ? t('copied') : t('copy')}
    </button>
  );
}

/** One labelled read-only value with Copy (and Mostrar/Ocultar for keys). */
export function ValueRow({
  id,
  label,
  value,
  secret,
  note,
}: {
  id: string;
  label: string;
  /** Null: still masked. */
  value: string | null;
  secret?: { shown: boolean; busy: boolean; onShow: () => void; onHide: () => void };
  note?: string;
}) {
  const t = useTranslations('liveTool.settings');
  return (
    <div className="ch-ev-key">
      <label htmlFor={id} className="ch-ev-key__l">
        {label}
      </label>
      <div className="ch-ev-key__row">
        <input
          id={id}
          className="ch-input ch-ev-key__v"
          readOnly
          value={value ?? MASKED_KEY}
          onFocus={(e) => e.currentTarget.select()}
        />
        {secret &&
          (secret.shown ? (
            <button
              type="button"
              className="ch-btn ch-btn--gray ch-btn--compact"
              onClick={secret.onHide}
            >
              <EyeOff aria-hidden="true" />
              {t('hide')}
            </button>
          ) : (
            <button
              type="button"
              className="ch-btn ch-btn--gray ch-btn--compact"
              disabled={secret.busy}
              onClick={secret.onShow}
            >
              <Eye aria-hidden="true" />
              {t('show')}
            </button>
          ))}
        <CopyButton value={value ?? ''} disabled={value === null} />
      </div>
      {note && <p className="ch-muted ch-ev-key__n">{note}</p>}
    </div>
  );
}
