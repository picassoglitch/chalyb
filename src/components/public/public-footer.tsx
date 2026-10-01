// PublicFooter (BUILD-SPEC §8.1 item 10). Tool links come from the active
// tools; legal links list only documents that exist (the P6 pages join when
// they are published); the seller block reads LEGAL_ENTITY_* and shows only
// the values that are set.

import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/ui/primitives';
import { legalEntity } from '@/lib/billing/legal-entity';
import { listActiveTools } from '@/lib/tools/public-tools-server';
import { CookieSettingsButton } from './cookie-banner';

/** Legal documents with a page today. TODO(P6): add Términos de Suscripción
 *  and Uso aceptable when their routes ship (they appear only then). */
const LEGAL_LINKS = [
  ['terms', '/legal/terms'],
  ['privacy', '/legal/privacy'],
] as const;

export async function PublicFooter() {
  const t = await getTranslations('landing.publicFooter');
  const tools = await listActiveTools();
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
          <nav aria-labelledby="foot-tools">
            <h2 id="foot-tools">{t('tools')}</h2>
            {tools.map((tool) => (
              <Link key={tool.slug} href={'/#herramientas' as Route}>
                {tool.name}
              </Link>
            ))}
          </nav>
          <nav aria-labelledby="foot-chalyb">
            <h2 id="foot-chalyb">Chalyb</h2>
            <Link href="/planes">{t('plans')}</Link>
            <Link href="/contacto">{t('help')}</Link>
            <Link href={'/#idea' as Route}>{t('idea')}</Link>
            <Link href="/sign-in">{t('login')}</Link>
          </nav>
          <nav aria-labelledby="foot-legal">
            <h2 id="foot-legal">{t('legal')}</h2>
            {LEGAL_LINKS.map(([key, href]) => (
              <Link key={key} href={href}>
                {t(`legalDocs.${key}`)}
              </Link>
            ))}
            <Link href="/quien-vende">{t('seller')}</Link>
          </nav>
        </div>

        {seller.length > 0 && (
          <address className="pub-foot__seller">
            <span>{t('sellerLabel')}</span> {seller.join(' · ')}
          </address>
        )}

        <div className="pub-foot__bottom">
          <p>{t('copy', { year: new Date().getFullYear() })}</p>
          <p>{t('secure')}</p>
          <CookieSettingsButton className="pub-foot__cookies" />
        </div>
      </div>
    </footer>
  );
}
