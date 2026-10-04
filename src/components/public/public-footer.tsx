// PublicFooter (LANDING-SPEC §3.11). Columns: brand · Herramientas (active
// tools) · Chalyb · Legal (only pages that exist, src/lib/legal/public-pages)
// · Contacto. Column titles are not headings (one h2 per section above). The
// seller block reads LEGAL_ENTITY_* and shows only the values that are set.

import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/ui/primitives';
import { legalEntity } from '@/lib/billing/legal-entity';
import { listActiveTools } from '@/lib/tools/public-tools-server';
import { LEGAL_PAGES } from '@/lib/legal/public-pages';
import { CookieSettingsButton } from './cookie-banner';

export async function PublicFooter({ onLanding = false }: { onLanding?: boolean }) {
  const t = await getTranslations('landing.publicFooter');
  const tools = (await listActiveTools()).slice(0, 3);
  const entity = legalEntity();
  const seller = [entity.name, entity.address, entity.phone, entity.email].filter(Boolean);

  return (
    <footer className="pub-foot">
      <div className="pub-wrap">
        <div className="pub-foot__cols">
          <div className="pub-foot__brand">
            <Logo href="/" />
            <p className="pub-foot__lead">{t('lead')}</p>
          </div>
          <nav aria-label={t('tools')} data-foot="tools">
            <p className="pub-foot__h">{t('tools')}</p>
            {tools.map((tool) => (
              <Link key={tool.slug} href={'/#herramientas' as Route}>
                {tool.name}
              </Link>
            ))}
            <Link href={'/#herramientas' as Route}>{t('toolsAll')}</Link>
          </nav>
          <nav aria-label={t('chalyb')}>
            <p className="pub-foot__h">{t('chalyb')}</p>
            <Link href={(onLanding ? '/#precios' : '/planes') as Route}>{t('pricing')}</Link>
            <Link href="/contacto">{t('help')}</Link>
            <Link href={'/#idea' as Route}>{t('idea')}</Link>
            <Link href="/sign-in" data-signin="footer">
              {t('login')}
            </Link>
          </nav>
          <nav aria-label={t('legal')}>
            <p className="pub-foot__h">{t('legal')}</p>
            {LEGAL_PAGES.map((p) => (
              <Link key={p.key} href={p.href as Route} data-foot-target={p.key}>
                {t(`legalDocs.${p.key}`)}
              </Link>
            ))}
            <Link href="/quien-vende" data-foot-target="quien_vende">
              {t('seller')}
            </Link>
          </nav>
          <nav aria-label={t('contact')}>
            <p className="pub-foot__h">{t('contact')}</p>
            <Link href="/contacto" data-foot-target="contacto">
              {t('write')}
            </Link>
          </nav>
        </div>

        <p className="pub-foot__disc">{t('disclaimer')}</p>

        {seller.length > 0 && (
          <address className="pub-foot__seller">
            <span>{t('sellerLabel')}</span> {seller.join(' · ')}
          </address>
        )}

        <div className="pub-foot__bottom">
          <p>{t('copy', { year: new Date().getFullYear() })}</p>
          <p>{t('secure')}</p>
          <CookieSettingsButton className="pub-foot__cookies" />
          <Link href="/" locale="en" hrefLang="en" className="pub-foot__lang" data-foot-target="en">
            {t('lang')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
