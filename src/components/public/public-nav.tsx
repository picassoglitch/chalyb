// PublicNav (BUILD-SPEC §8.1, mockups 10/11): logo, the landing anchors,
// "Entrar" and the one trial button. Below 900px the anchors fold into a
// hamburger built on <details>, so it works without JavaScript.

import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Menu } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/ui/primitives';
import { trialFlowEnabled } from '@/lib/config/flags';
import { APP_HREF, LOGIN_HREF, trialCtaHref, trialCtaLabel } from '@/components/landing/links';

const ANCHORS = [
  ['tools', '/#herramientas'],
  ['how', '/#como'],
  ['plans', '/#planes'],
  ['faq', '/#preguntas'],
] as const;

export async function PublicNav({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations('landing.publicNav');
  const trialHref = trialCtaHref({ trialFlowEnabled: trialFlowEnabled(), signedIn });

  const anchors = ANCHORS.map(([key, href]) => (
    <Link key={key} href={href as Route}>
      {t(key)}
    </Link>
  ));

  return (
    <header className="pub-nav">
      <Logo href="/" />
      <nav className="pub-nav__links" aria-label={t('aria')}>
        {anchors}
      </nav>
      <div className="pub-nav__r">
        {signedIn ? (
          <Link href={APP_HREF} className="pub-nav__in">
            {t('app')}
          </Link>
        ) : (
          <Link href={LOGIN_HREF} className="pub-nav__in">
            {t('login')}
          </Link>
        )}
        <Link href={trialHref} className="ch-btn ch-btn--primary ch-btn--compact pub-nav__cta">
          {t(trialCtaLabel({ trialFlowEnabled: trialFlowEnabled(), signedIn }))}
        </Link>
        <details className="pub-nav__menu">
          <summary aria-label={t('menu')}>
            <Menu aria-hidden="true" />
          </summary>
          <nav className="pub-nav__sheet" aria-label={t('aria')}>
            {anchors}
            <Link href={signedIn ? APP_HREF : LOGIN_HREF}>{signedIn ? t('app') : t('login')}</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
