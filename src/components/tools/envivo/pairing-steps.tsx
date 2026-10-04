'use client';

// Conecta tu computadora (TOOLS-SPEC §6.1, mockup 57): download the program
// (the only primary, same-tab attachment), type the 6-digit code, done. The
// page polls the paired computers every 5 s (the SSE fallback) and moves to
// the stream screen 2 s after one shows up.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Check, Download, Info, MessageCircle, RotateCw } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { Markup } from '@/components/ui/markup';
import type { PairingCode } from '@/lib/tools/adapters/tools';
import { codeExpired, otherOs, splitCode } from '@/lib/tools/envivo-core';

const POLL_MS = 5000;

export function PairingSteps({
  os,
  initialCode,
  initialDevices,
  doneHref = '/app/en-vivo',
}: {
  os: 'windows' | 'mac';
  initialCode: PairingCode | null;
  /** Computers already paired: a new one past this count means "connected". */
  initialDevices: number;
  doneHref?: string;
}) {
  const t = useTranslations('liveTool.setup');
  const router = useRouter();
  const [code, setCode] = useState<PairingCode | null>(initialCode);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const busy = useRef(false);

  const newCode = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setCodeError(false);
    try {
      const res = await fetch('/api/tools/chalybobs/pairing-codes', { method: 'POST' });
      const json = (await res.json()) as { ok: boolean; data?: PairingCode };
      if (!json.ok || !json.data) throw new Error('code');
      setCode(json.data);
    } catch {
      setCodeError(true);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch('/api/tools/chalybobs/devices', { cache: 'no-store' });
        const json = (await res.json()) as { ok: boolean; data?: unknown[] };
        if (json.ok && (json.data?.length ?? 0) > initialDevices) setDone(true);
      } catch {}
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [done, initialDevices]);

  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => {
      router.push(doneHref as Route);
      router.refresh();
    }, 2000);
    return () => window.clearTimeout(id);
  }, [done, doneHref, router]);

  const expired = !!code && codeExpired(code.expiresAt, now);
  const [a, b] = code ? splitCode(code.code) : ['   ', '   '];
  const alt = otherOs(os);
  const href = (o: string) => `/api/tools/chalybobs/download?os=${o}`;

  return (
    <section className="ch-pair" aria-labelledby="pair-title">
      <header className="ch-pair__head">
        <h2 id="pair-title" className="ch-h2 ch-pair__title">
          {t('title')}
        </h2>
        <p className="ch-sub">{t('sub')}</p>
      </header>
      <p className="ch-pair__obs">
        <Info aria-hidden="true" />
        <span>
          <Markup text={t('obs')} />
        </span>
      </p>

      <ol className="ch-pair__steps">
        <li className={`ch-card ch-pair__step${done ? '' : ' ch-pair__step--on'}`}>
          <span className="ch-pair__n">
            <b>1</b> {t('now')}
          </span>
          <h3>{t('s1.title')}</h3>
          <p className="ch-muted">{t('s1.body')}</p>
          <a
            href={href(os)}
            download
            className="ch-btn ch-btn--primary ch-btn--xl ch-pair__dl"
            onClick={() => setDownloaded(true)}
          >
            <Download aria-hidden="true" />
            {t(`s1.${os}`)}
          </a>
          <p className="ch-muted ch-pair__alt">
            {t(alt === 'mac' ? 's1.otherMac' : 's1.otherWindows')}{' '}
            <a href={href(alt)} download className="ch-lnk">
              {t(`s1.${alt}`)}
            </a>
          </p>
          {downloaded && (
            <a href={href(os)} download className="ch-lnk ch-pair__again">
              {t('s1.again')}
            </a>
          )}
        </li>

        <li className="ch-card ch-pair__step">
          <span className="ch-pair__n">
            <b>2</b> {t('later')}
          </span>
          <h3>{t('s2.title')}</h3>
          <p className="ch-muted">{t('s2.body')}</p>
          {code && !expired ? (
            <>
              <p className="ch-pair__code" aria-label={t('s2.aria', { codigo: `${a} ${b}` })}>
                {[a, b].map((g, gi) => (
                  <span key={gi} className="ch-pair__grp" aria-hidden="true">
                    {g.split('').map((d, i) => (
                      <span key={i} className="ch-pair__d">
                        {d}
                      </span>
                    ))}
                  </span>
                ))}
              </p>
              <p className="ch-muted ch-pair__valid">{t('s2.valid')}</p>
            </>
          ) : (
            <div className="ch-pair__expired">
              {(expired || codeError) && (
                <p role="alert">{codeError ? t('codeError') : t('s2.expired')}</p>
              )}
              <button
                type="button"
                className="ch-btn ch-btn--secondary"
                onClick={() => void newCode()}
              >
                <RotateCw aria-hidden="true" />
                {t('s2.newCode')}
              </button>
            </div>
          )}
        </li>

        <li className={`ch-card ch-pair__step${done ? ' ch-pair__step--done' : ''}`}>
          <span className="ch-pair__n">
            <b>3</b> {t('last')}
          </span>
          <h3>{t('s3.title')}</h3>
          <p className="ch-muted" role="status">
            {done ? t('s3.done') : t('s3.body')}
          </p>
          <span className={`ch-pair__check${done ? ' ch-pair__check--on' : ''}`} aria-hidden="true">
            <Check />
          </span>
        </li>
      </ol>

      <footer className="ch-pair__foot">
        {!done && (
          <p className="ch-muted ch-pair__wait">
            <span className="ch-spin" aria-hidden="true" />
            {t('wait')}
          </p>
        )}
        <Link href={'/app/help' as Route} className="ch-btn ch-btn--okline">
          <MessageCircle aria-hidden="true" />
          {t('human')}
        </Link>
      </footer>
    </section>
  );
}
