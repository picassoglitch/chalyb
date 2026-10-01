'use client';

// Señales · paso 1: big chips, multi-select. Choosing coins only filters
// which notices arrive; it never changes what a signal says.

import { useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Markup } from '@/components/ui/markup';

export function CoinPicker({ coins, initial }: { coins: { symbol: string; name: string }[]; initial: string[] }) {
  const t = useTranslations('signals');
  const tw = useTranslations('wizard');
  const [picked, setPicked] = useState<string[]>(initial);
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const list = new Intl.ListFormat('es', { type: 'conjunction' }).format(picked);
  return (
    <div className="ch-center-col">
      <h1 className="ch-h1">{t('s1.title')}</h1>
      <p className="ch-sub">{t('s1.sub')}</p>
      <div role="group" aria-label={t('s1.title')} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {coins.map((c) => (
          <button
            key={c.symbol}
            type="button"
            aria-pressed={picked.includes(c.symbol)}
            className={`ch-chip${picked.includes(c.symbol) ? ' ch-chip--on' : ''}`}
            onClick={() => toggle(c.symbol)}
          >
            {c.name} {c.symbol !== c.name ? c.symbol : ''}
          </button>
        ))}
      </div>
      <p aria-live="polite" style={{ fontSize: 17 }}>
        {picked.length ? <Markup text={t.markup('s1.count', { n: picked.length, lista: list, b: (x) => `<b>${x}</b>` })} /> : t('s1.none')}
      </p>
      <p className="ch-muted">{t('s1.same')}</p>
      {picked.length > 0 ? (
        <Link href={`/app/senales/avisos?coins=${picked.join(',')}` as Route} className="ch-btn ch-btn--primary ch-btn--xl">
          {tw('continue')}
        </Link>
      ) : (
        <button type="button" className="ch-btn ch-btn--primary ch-btn--xl" disabled>
          {tw('continue')}
        </button>
      )}
    </div>
  );
}
