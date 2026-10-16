'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { desktopHandoff, type DesktopHandoffResult } from '@/lib/chalito/web/desktop-sso';

/**
 * The desktop app's sign-in, in the system browser: one hub launch token, handed to the app as a
 * link the person clicks (browsers ask before opening chalito://). Never exchanged here.
 */
export const DesktopHandoff = ({ state, redirect }: { state: string; redirect: string }) => {
  const t = useTranslations('chalito.sso');
  const started = useRef(false);
  const [result, setResult] = useState<DesktopHandoffResult | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void desktopHandoff({ state, redirect }, window.fetch.bind(window)).then(setResult);
  }, [state, redirect]);

  if (!result)
    return (
      <p aria-busy="true" className="ch-muted">
        {t('working')}
      </p>
    );
  if (!result.ok)
    return (
      <p role="alert" data-testid="desktop-handoff-failed" className="ch-card ch-chl-card ch-chl-card--bad">
        {t(result.reason === 'rate_limited' ? 'rateLimited' : 'failed')}
      </p>
    );
  return (
    <div className="ch-card ch-state" data-testid="desktop-handoff">
      <p className="ch-chl-h3">{t('desktop.title')}</p>
      <p className="ch-muted">{t('desktop.body')}</p>
      {/* A link the person clicks: browsers ask before opening a custom scheme like chalito://. */}
      <a className="ch-btn ch-btn--primary" href={result.url} rel="noreferrer">
        {t('desktop.open')}
      </a>
    </div>
  );
};
