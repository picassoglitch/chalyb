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
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { CookieSettingsButton } from './cookie-banner';

/** The disclaimer names these tools, so it shows only while one of them is active. */
const FINANCIAL = new Set(['chalybcrypto', 'chalybpicks', 'chalybtrade']);

export async function PublicFooter({ onLanding = false }: { onLanding?: boolean }) {
  const t = await getTranslations('landing.publicFooter');
  const active = await listActiveTools();
  const tools = active.slice(0, 3);
  const hasClips = active.some((tool) => tool.slug === 'chalybclip');
  const hasEnVivo = active.some((tool) => tool.slug === 'chalybobs');
  const leadKey = hasClips && hasEnVivo ? 'lead' : hasClips ? 'leadClipsOnly' : hasEnVivo ? 'leadLiveOnly' : 'leadGeneric';
  const financial = active.some((x) => FINANCIAL.has(x.slug));
  const entity = legalEntity();
  const seller = [entity.name, entity.address, entity.phone, entity.email].filter(Boolean);

  return (
    <footer className="pub-foot">
      <div className="pub-wrap">
        <div className="pub-foot__cols">
          <div className="pub-foot__brand">
            <Logo href="/" />
            <p className="pub-foot__lead">{t(leadKey)}</p>
          </div>
          {active.length > 0 && (
            <nav aria-label={t('tools')} data-foot="tools">
              <p className="pub-foot__h">{t('tools')}</p>
              {tools.map((tool) => (
                <Link key={tool.slug} href={'/#herramientas' as Route}>
                  {tool.name}
                </Link>
              ))}
              <Link href={'/#herramientas' as Route}>{t('toolsAll')}</Link>
            </nav>
          )}
          <nav aria-label={t('chalyb')}>
            <p className="pub-foot__h">{t('chalyb')}</p>
            {active.length > 0 && (
              <Link href={(onLanding ? '/#precios' : '/planes') as Route}>{t('pricing')}</Link>
            )}
            <Link href="/contacto">{t('help')}</Link>
            {active.length > 0 && <Link href={'/#idea' as Route}>{t('idea')}</Link>}
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
            <Link href="/derechos-de-autor" data-foot-target="derechos_de_autor">
              {t('copyright')}
            </Link>
          </nav>
          <nav aria-label={t('contact')}>
            <p className="pub-foot__h">{t('contact')}</p>
            <Link href="/contacto" data-foot-target="contacto">
              {t('write')}
            </Link>
          </nav>
        </div>

        {financial && <p className="pub-foot__disc">{t('disclaimer')}</p>}

        {seller.length > 0 && (
          <address className="pub-foot__seller">
            <span>{t('sellerLabel')}</span> {seller.join(' · ')}
          </address>
        )}

        <div className="pub-foot__bottom">
          <p>{t('copy', { year: new Date().getFullYear() })}</p>
          <p>{t('secure')}</p>
          <CookieSettingsButton className="pub-foot__cookies" />
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
