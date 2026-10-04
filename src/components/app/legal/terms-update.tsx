'use client';

// aceptacion-ux §8 · Terms update, Law's copy verbatim. A relevant change
// shows the blocking modal ([Aceptar y continuar] · [No acepto, ver
// opciones]); a minor one the non-blocking banner. The modal steps aside on
// the screens it must never block: cancelling, its options, downloading
// content and help (termsModalExempt).

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Info } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { termsModalExempt, type ReacceptDoc } from '@/lib/legal/reaccept';
import { Markup } from '@/components/ui/markup';

export interface TermsUpdateView {
  doc: ReacceptDoc;
  version: string;
  effective: string;
  changes: string[];
  changesHref: string;
}

export function TermsReacceptModal({ v }: { v: TermsUpdateView }) {
  const t = useTranslations('termsUpdate');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (termsModalExempt(pathname)) return null;

  async function accept() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/legal/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', locale }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="terms-title" className="ch-gate">
      <div className="ch-card ch-gate__card">
        <h1 id="terms-title" className="ch-h2">
          {t(`titles.${v.doc}`)}
        </h1>
        <p>
          <Markup text={t.markup('lead', { fecha: v.effective, b: (c) => `<b>${c}</b>` })} />
        </p>
        {v.changes.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {v.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        <p>
          <a href={v.changesHref} className="ch-lnk" target="_blank" rel="noopener">
            {t('seeAll')}
          </a>
        </p>
        <p className="ch-muted">{t('disagree')}</p>
        {error && (
          <p role="alert" style={{ color: 'var(--bad)' }}>
            {t('error')}
          </p>
        )}
        <button
          type="button"
          className="ch-btn ch-btn--primary ch-btn--xl"
          onClick={accept}
          disabled={busy}
        >
          {t('accept')}
        </button>
        <Link href="/app/terminos" className="ch-btn ch-btn--secondary">
          {t('options')}
        </Link>
      </div>
    </div>
  );
}

export function TermsNoticeBanner({ v }: { v: TermsUpdateView }) {
  const t = useTranslations('termsUpdate');
  const locale = useLocale();
  const logged = useRef(false);
  // `terms_notice_shown` is the evidence that the banner appeared; once.
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    void fetch('/api/legal/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shown', locale }),
    }).catch(() => {});
  }, [locale]);
  return (
    <div className="ch-bnr ch-bnr--gray" role="status">
      <span className="ch-bnr__ic" aria-hidden="true">
        <Info />
      </span>
      <span className="ch-bnr__tx">{t(`banner.${v.doc}`)}</span>
      <a
        href={v.changesHref}
        className="ch-btn ch-btn--white ch-btn--compact"
        target="_blank"
        rel="noopener"
      >
        {t('bannerLink')}
      </a>
    </div>
  );
}
