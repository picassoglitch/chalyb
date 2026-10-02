'use client';

// SCR-18 · Cancelar: Mi plan → "Cancelar …" → this sheet → "Sí, cancelar".
// Two clicks. "Sí, cancelar" (btn-dark) and "Seguir con …" (btn-primary)
// have the same size and weight, and stay visible next to the one optional
// offer (annual plans only).

import { useState } from 'react';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Sheet } from '@/components/ui/sheet';
import { Markup } from '@/components/ui/markup';

export function CancelSheet({
  trial,
  planName,
  accessDate,
  email,
  offer,
  reactivateHref,
  triggerLabel,
  triggerSub,
}: {
  trial: boolean;
  planName: string;
  accessDate: string;
  email: string;
  offer: { href: string; label: string } | null;
  /** "Reactivar": back to the plan just cancelled. */
  reactivateHref: string;
  triggerLabel: string;
  triggerSub: string;
}) {
  const t = useTranslations('cancel');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'ask' | 'working' | 'done' | 'error'>('ask');
  const [folio, setFolio] = useState('');

  async function confirm() {
    setState('working');
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerShown: !!offer, locale }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; folio?: string };
      if (res.ok && body.ok) {
        setFolio(body.folio ?? '');
        setState('done');
      } else setState('error');
    } catch {
      setState('error');
    }
  }

  return (
    <>
      <button type="button" className="ch-row" onClick={() => setOpen(true)}>
        <span className="ch-row__tx">
          <b style={{ color: 'var(--bad)' }}>{triggerLabel}</b>
          <small>{triggerSub}</small>
        </span>
      </button>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          if (state === 'done') window.location.reload();
        }}
        title={state === 'done' ? t('done.title') : trial ? t('trial.title') : t('paid.title', { plan: planName })}
        closeLabel={t('close')}
      >
        {state === 'done' ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <p>
              <Markup text={t.markup('done.body', { plan: planName, fecha: accessDate, b: (c) => `<b>${c}</b>` })} />
            </p>
            <p className="ch-muted">{t('done.again')}</p>
            <p className="ch-muted" style={{ fontSize: 15 }}>
              {t('done.folio', { folio, correo: email })}
            </p>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <Link href={'/app' as Route} className="ch-btn ch-btn--gray">
                {t('done.home')}
              </Link>
              <Link href={reactivateHref as Route} className="ch-btn ch-btn--primary">
                {t('done.reactivate')}
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <p>
              <Markup
                text={
                  trial
                    ? t.markup('trial.body', { fecha: accessDate, b: (c) => `<b>${c}</b>` })
                    : t.markup('paid.body', { plan: planName, fecha: accessDate, b: (c) => `<b>${c}</b>` })
                }
              />
            </p>
            {offer && (
              <div className="ch-disc" style={{ padding: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ flex: 1 }}>{t('offer')}</span>
                <Link href={offer.href as Route} className="ch-btn ch-btn--secondary ch-btn--compact">
                  {offer.label}
                </Link>
              </div>
            )}
            {state === 'error' && (
              <p role="alert" style={{ color: 'var(--bad)' }}>
                {t('error')}
              </p>
            )}
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <button type="button" className="ch-btn ch-btn--dark" onClick={confirm} disabled={state === 'working'}>
                {state === 'working' ? t('working') : t('yes')}
              </button>
              <button type="button" className="ch-btn ch-btn--primary" onClick={() => setOpen(false)}>
                {t('keep', { plan: trial ? 'Pro' : planName })}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
