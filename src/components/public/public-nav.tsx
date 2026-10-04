// PublicNav (LANDING-SPEC §3.1): logo, Herramientas · Precios · Ayuda,
// "Iniciar sesión" and the one trial button "Prueba gratis". Signed in, both
// become "Abrir Chalyb" → /app. Below 1024 px the links move into a sheet
// (mobile-menu.tsx) with the trial button.

import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/ui/primitives';
import { trialFlowEnabled } from '@/lib/config/flags';
import { APP_HREF, LOGIN_HREF, landingTrialHref } from '@/components/landing/links';
import { MobileMenu } from './mobile-menu';

const LINKS = [
  ['tools', '/#herramientas'],
  ['pricing', '/#precios'],
  ['help', '/contacto'],
] as const;

export async function PublicNav({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations('landing.publicNav');
  const tl = await getTranslations('landing');
  const flow = trialFlowEnabled();
  const trialHref = signedIn
    ? APP_HREF
    : landingTrialHref({ from: 'nav_trial', trialFlowEnabled: flow, signedIn });
  const menuTrialHref = landingTrialHref({ from: 'menu_trial', trialFlowEnabled: flow, signedIn });
  const links = LINKS.map(([key, href]) => ({ key, href, label: t(key) }));

  return (
    <header className="pub-nav">
      <Logo href="/" />
      <nav className="pub-nav__links" aria-label={t('aria')}>
        {links.map((l) => (
          <Link key={l.key} href={l.href as Route} data-nav={l.key}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="pub-nav__r">
        <Link href={signedIn ? APP_HREF : LOGIN_HREF} className="pub-nav__in" data-signin="nav">
          {signedIn ? t('app') : t('login')}
        </Link>
        <Link
          href={trialHref}
          className="ch-btn ch-btn--primary pub-nav__cta"
          data-cta={signedIn ? undefined : 'nav_trial'}
        >
          {signedIn ? t('app') : flow ? t('trial') : t('trialNoTrial')}
        </Link>
        <MobileMenu
          links={links}
          login={{ href: signedIn ? APP_HREF : LOGIN_HREF, label: signedIn ? t('app') : t('login') }}
          cta={{ href: menuTrialHref, label: flow ? tl('cta') : tl('ctaNoTrial') }}
          labels={{ open: t('menu'), close: t('close'), aria: t('aria') }}
        />
      </div>
    </header>
  );
}
