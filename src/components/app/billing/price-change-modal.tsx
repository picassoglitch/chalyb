'use client';

// Mockup 89 · the price-increase notice in the app (aceptacion-ux §4.1,
// verbatim). Shown on every app page until the subscriber answers; the
// three choices are equal in reach, and cancelling is never blocked.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/routing';
import { Markup } from '@/components/ui/markup';

export interface PriceChangeView {
  plan: string;
  oldPrice: string;
  newPrice: string;
  pct: number;
  periodKey: 'periodMonth' | 'periodYear';
  noticeDate: string;
  renewalDate: string;
  renewalShort: string;
  reminderDate: string;
  keepOld: boolean;
}

export function PriceChangeModal({ v }: { v: PriceChangeView }) {
  const t = useTranslations('priceChange');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const periodo = t(v.periodKey);
  // "Cancelar mi plan" opens the ordinary cancel sheet on Mi plan; the
  // notice steps aside while it is open.
  const cancelling = useSearchParams().get('cancelar') === '1';
  if (cancelling) return null;

  async function answer(decision: 'accept' | 'decline') {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/billing/price-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pc-title" className="ch-gate">
      <div className="ch-card ch-gate__card">
        <p className="ch-eyebrow">{t('eyebrow', { fecha: v.noticeDate })}</p>
        <h1 id="pc-title" className="ch-h2">
          {t('title', { plan: v.plan })}
        </h1>
        <div className="ch-pcm">
          <div>
            <small>{t('today')}</small>
            <p className="ch-pcm__old">{v.oldPrice}</p>
          </div>
          <ArrowRight aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <small>{t('from', { fecha: v.renewalShort })}</small>
            <p className="ch-pcm__new">{v.newPrice}</p>
          </div>
          <span className="ch-pill ch-pill--warn">+{v.pct}%</span>
        </div>
        <p>
          <Markup
            text={t.markup('line1', {
              anterior: v.oldPrice,
              nuevo: v.newPrice,
              periodo,
              fecha: v.renewalDate,
              b: (c) => `<b>${c}</b>`,
            })}
          />
        </p>
        <p>
          {v.keepOld
            ? t('line2KeepOld', { anterior: v.oldPrice, periodo })
            : t('line2Gratis', { plan: v.plan, fecha: v.renewalDate })}
        </p>
        <p className="ch-muted" style={{ fontSize: 15.5 }}>
          {t('remind', { fecha: v.reminderDate })}
        </p>
        {error && (
          <p role="alert" style={{ color: 'var(--bad)' }}>
            {t('error')}
          </p>
        )}
        <button
          type="button"
          className="ch-btn ch-btn--primary ch-btn--xl"
          onClick={() => answer('accept')}
          disabled={busy}
        >
          {t('accept')}
        </button>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <button
            type="button"
            className="ch-btn ch-btn--secondary"
            onClick={() => answer('decline')}
            disabled={busy}
          >
            {t('decline')}
          </button>
          <Link
            href="/app/billing?cancelar=1"
            className="ch-btn ch-btn--secondary"
            style={{ color: 'var(--bad)' }}
          >
            {t('cancel')}
          </Link>
        </div>
      </div>
    </div>
  );
}
