// Shared shell for the legal documents (/legal/*, their versions) and the
// copyright notice form (/derechos-de-autor): the public site's chrome
// (PublicNav + PublicFooter), the same as the landing and /planes.
//
// Server pages pass `title`, either `lastUpdated` (a date, shown after the
// "Última actualización" label) or `meta` (a complete line such as
// "Versión 1.0 · En vigor desde …", shown as is), and the body as children.
// The body uses the `.legal-prose` markup, styled in chalyb-legal.css. The
// chrome around it (eyebrow, "last updated" label) is translated here.

import { getTranslations } from 'next-intl/server';
import { PublicNav } from '@/components/public/public-nav';
import { PublicFooter } from '@/components/public/public-footer';
import '@/styles/chalyb-tokens.css';
import '@/styles/chalyb-public.css';
import '@/styles/chalyb-legal.css';

interface Props {
  title: string;
  /** A date: rendered as "Última actualización · {lastUpdated}". */
  lastUpdated?: string;
  /** A complete meta line (version line, "En revisión", a policy reference):
   *  rendered without the "last updated" label, which would read as a
   *  missing date before it. */
  meta?: string;
  isAuthenticated: boolean;
  children: React.ReactNode;
}

export async function LegalPage({ title, lastUpdated, meta, isAuthenticated, children }: Props) {
  const t = await getTranslations('legal');

  return (
    <div className="chalyb-app pub">
      <PublicNav signedIn={isAuthenticated} />
      <main id="main" className="pub-doc">
        <div className="pub-doc__wrap">
          <header className="pub-doc__head">
            <p className="pub-doc__eyebrow">{t('eyebrow')}</p>
            <h1 className="ch-h1">{title}</h1>
            {lastUpdated ? (
              <p className="pub-doc__meta">
                {t('lastUpdated')} · {lastUpdated}
              </p>
            ) : meta ? (
              <p className="pub-doc__meta">{meta}</p>
            ) : null}
          </header>
          <div className="pub-doc__card">
            <div className="legal-prose">{children}</div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
