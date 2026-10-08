'use client';

// The copyright notice form (Uso aceptable §5.1; art. 114 Octies LFDA). The
// four minimum fields first and required; the optional ones are labelled as
// optional and never block sending.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TAKEDOWN_LIMITS } from '@/lib/legal/takedown-limits';

type Field =
  | 'claimantName'
  | 'claimantContact'
  | 'contentIdentification'
  | 'rightStatement'
  | 'contentLocation'
  | 'workDescription'
  | 'ownershipEvidence';

const REQUIRED: Field[] = [
  'claimantName',
  'claimantContact',
  'contentIdentification',
  'rightStatement',
  'contentLocation',
];
const OPTIONAL: Field[] = ['workDescription', 'ownershipEvidence'];
const LONG = new Set<Field>([
  'contentIdentification',
  'rightStatement',
  'workDescription',
  'ownershipEvidence',
]);

export function TakedownForm() {
  const t = useTranslations('takedown.form');
  const [missing, setMissing] = useState<Field[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error' | 'limited'>('idle');
  const [folio, setFolio] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(
      [...REQUIRED, ...OPTIONAL].map((k) => [k, String(fd.get(k) ?? '')]),
    );
    body.declaredTruthful = fd.get('declaredTruthful') === 'on';
    body.website = String(fd.get('website') ?? '');
    const empty = REQUIRED.filter((k) => !String(body[k]).trim());
    setMissing(empty);
    if (empty.length) {
      document.getElementById(`td-${empty[0]}`)?.focus();
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/legal/takedown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string | null;
        fields?: Field[];
      };
      if (res.status === 429) {
        setState('limited');
        return;
      }
      if (!res.ok || !j.ok) {
        if (j.fields?.length) setMissing(j.fields);
        setState('error');
        return;
      }
      setFolio(j.id ? j.id.slice(0, 8) : null);
      setState('sent');
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div role="status" className="legal-callout">
        <strong>{t('sentTitle')}</strong> {t('sentBody')} {folio && t('folio', { folio })}
      </div>
    );
  }

  const field = (k: Field, required: boolean) => {
    const bad = missing.includes(k);
    const props = {
      id: `td-${k}`,
      name: k,
      required,
      'aria-invalid': bad || undefined,
      'aria-describedby': bad ? `td-${k}-err` : undefined,
    };
    return (
      <div key={k} className={`auth-field${bad ? ' err' : ''}`}>
        <label htmlFor={`td-${k}`}>
          {t(`${k}.label`)}
          {!required && ` (${t('optional')})`}
        </label>
        {LONG.has(k) ? (
          <textarea
            {...props}
            rows={4}
            maxLength={TAKEDOWN_LIMITS[k]}
            placeholder={t(`${k}.hint`)}
          />
        ) : (
          <input
            {...props}
            type="text"
            maxLength={TAKEDOWN_LIMITS[k]}
            placeholder={t(`${k}.hint`)}
          />
        )}
        {bad && (
          <p id={`td-${k}-err`} role="alert" className="auth-error" style={{ marginTop: 6 }}>
            {t('required')}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      {REQUIRED.map((k) => field(k, true))}
      <p style={{ fontSize: 14 }}>{t('optionalNote')}</p>
      {OPTIONAL.map((k) => field(k, false))}
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14 }}>
        <input type="checkbox" name="declaredTruthful" style={{ marginTop: 4 }} />
        <span>
          {t('truthful')} ({t('optional')})
        </span>
      </label>
      {(state === 'error' || state === 'limited') && (
        <div role="alert" className="auth-error">
          {state === 'limited' ? t('rateLimited') : t('error')}
        </div>
      )}
      <button type="submit" className="auth-submit" disabled={state === 'sending'}>
        {t('submit')}
      </button>
    </form>
  );
}
