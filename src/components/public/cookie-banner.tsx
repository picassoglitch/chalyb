'use client';

// Cookie banner (aceptacion-ux §9, BUILD-SPEC §8.1, rebuild P4-7). Mounted
// once in the locale layout, where it also decides whether Vercel Analytics
// loads: <Analytics /> renders only after the visitor accepts analytics, so
// no analytics request leaves the browser before consent.

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Analytics } from '@vercel/analytics/next';
import { Link } from '@/i18n/routing';
import {
  ALL,
  CONSENT_CHANGED_EVENT,
  NECESSARY_ONLY,
  OPEN_CONSENT_EVENT,
  parseConsent,
  readConsentRaw,
  saveConsent,
  type Consent,
} from '@/lib/analytics/consent';
import '@/styles/chalyb-tokens.css';
import '@/styles/chalyb-public.css';

/** The server can't see the cookie: render nothing until the client knows. */
const SERVER_SNAPSHOT = '\u0000server';

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
}

export function CookieConsent() {
  const t = useTranslations('landing.cookies');
  const raw = useSyncExternalStore(subscribe, readConsentRaw, () => SERVER_SNAPSHOT);
  const known = raw !== SERVER_SNAPSHOT;
  const consent = known ? parseConsent(raw) : null;
  const [reopened, setReopened] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [draft, setDraft] = useState<Consent>(NECESSARY_ONLY);
  const titleId = useId();
  const firstButton = useRef<HTMLButtonElement>(null);
  const open = known && (reopened || consent === null);

  useEffect(() => {
    const reopen = () => {
      setDraft(parseConsent(readConsentRaw()) ?? NECESSARY_ONLY);
      setConfiguring(true);
      setReopened(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (open && configuring) firstButton.current?.focus();
  }, [open, configuring]);

  // While open, the page gets bottom room the size of the banner, so the last
  // rows (e.g. "Cancelar" in Mi plan) can still scroll clear of it.
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = box.current;
    const root = document.documentElement;
    if (!open || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => root.style.setProperty('--consent-h', `${el.offsetHeight + 24}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--consent-h');
    };
  }, [open]);

  const choose = (c: Consent) => {
    saveConsent(c);
    setReopened(false);
    setConfiguring(false);
  };

  return (
    <>
      {consent?.analytics && <Analytics />}
      {open && (
        <div className="chalyb-app pub-consent">
          <section
            ref={box}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            className="pub-consent__box"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && consent) setReopened(false);
            }}
          >
            <h2 id={titleId} className="ch-sr">
              {t('title')}
            </h2>
            <p className="pub-consent__text">
              {t('text')}{' '}
              <Link href="/legal/privacy" className="ch-lnk">
                {t('privacy')}
              </Link>
            </p>

            {configuring && (
              <fieldset className="pub-consent__cats">
                <legend className="ch-sr">{t('configure')}</legend>
                <label className="pub-consent__cat">
                  <input type="checkbox" checked disabled />
                  <span>
                    <b>{t('necessary')}</b>
                    <small>{t('necessaryHint')}</small>
                  </span>
                </label>
                <label className="pub-consent__cat">
                  <input
                    type="checkbox"
                    checked={draft.analytics}
                    onChange={(e) => setDraft({ ...draft, analytics: e.target.checked })}
                  />
                  <span>
                    <b>{t('analytics')}</b>
                    <small>{t('analyticsHint')}</small>
                  </span>
                </label>
                <label className="pub-consent__cat">
                  <input
                    type="checkbox"
                    checked={draft.ads}
                    onChange={(e) => setDraft({ ...draft, ads: e.target.checked })}
                  />
                  <span>
                    <b>{t('ads')}</b>
                    <small>{t('adsHint')}</small>
                  </span>
                </label>
              </fieldset>
            )}

            <div className="pub-consent__actions">
              <button ref={firstButton} type="button" className="ch-btn ch-btn--primary ch-btn--compact" onClick={() => choose(ALL)}>
                {t('acceptAll')}
              </button>
              <button type="button" className="ch-btn ch-btn--secondary ch-btn--compact" onClick={() => choose(NECESSARY_ONLY)}>
                {t('necessaryOnly')}
              </button>
              {configuring ? (
                <button type="button" className="ch-btn ch-btn--gray ch-btn--compact" onClick={() => choose(draft)}>
                  {t('save')}
                </button>
              ) : (
                <button
                  type="button"
                  className="ch-btn ch-btn--gray ch-btn--compact"
                  aria-expanded={false}
                  onClick={() => {
                    setDraft(consent ?? NECESSARY_ONLY);
                    setConfiguring(true);
                  }}
                >
                  {t('configure')}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

/** Footer "Cookies" link: reopens the banner on the settings view. */
export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations('landing.cookies');
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      {t('link')}
    </button>
  );
}
