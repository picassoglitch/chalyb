'use client';

// The AI voice/likeness step (BUILD-SPEC §11.6). Nothing uses it yet: any
// future option that clones a voice or face renders this first, and its
// server action calls requireLikenessConsent().

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Markup } from '@/components/ui/markup';

export function LikenessConsent({ feature, onDone }: { feature: string; onDone: () => void }) {
  const t = useTranslations('consents.likeness');
  const locale = useLocale();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const res = await fetch('/api/tools/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'likeness', feature, checked, locale }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) onDone();
  }
  return (
    <section
      className="ch-card"
      style={{ padding: 24, display: 'grid', gap: 14 }}
      aria-labelledby="likeness-title"
    >
      <h2 id="likeness-title" className="ch-h2">
        {t('title')}
      </h2>
      <p>
        <Markup text={t.markup('body', { b: (c) => `<b>${c}</b>` })} />
      </p>
      <label className="ch-check">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>
          <Markup
            text={t.markup('check', { terms: (c) => `<terms>${c}</terms>` })}
            termsHref="/uso-aceptable"
          />
        </span>
      </label>
      <button
        type="button"
        className="ch-btn ch-btn--primary"
        disabled={!checked || busy}
        onClick={go}
      >
        {t('cta')}
      </button>
    </section>
  );
}
