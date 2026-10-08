'use client';
import { SignInLink } from './SignInLink';
import { Companion } from './Companion';
import { useLocale, useTranslations } from 'next-intl';
import { Camera, Inbox, LayoutGrid, MonitorSmartphone, ShoppingBag, Users } from 'lucide-react';
import { PRODUCT_NAME, formatCompanionTitle } from '@chalito/brand';
import { companionName } from '@chalito/ui';
import { Group, Row } from '@/components/ui/primitives';
import { Link, chalitoPath } from '@/lib/chalito/navigation';
import { useSettings } from '@/lib/chalito/useSettings';
import { homeHeroShown } from '@/lib/chalito/companion';
import { useSession } from '@/lib/chalito/web/session';
import type { AppLocale } from '@/i18n/locales';

// Chalito's Inicio (owner decision 2026-10-06): the hub's tool tabs cover Inicio, Sesiones and
// Ajustes; every other section is a row here.
const SECTIONS = [
  ['/bandeja', 'inbox', Inbox, '#30D158'],
  ['/dispositivos', 'devices', MonitorSmartphone, '#0A84FF'],
  ['/salas', 'rooms', Users, '#FF9F0A'],
  ['/m', 'mesas', LayoutGrid, '#5B4BFF'],
  ['/tienda', 'store', ShoppingBag, '#FF375F'],
  ['/personaje', 'character', Camera, '#BF5AF2'],
] as const;

export const Home = () => {
  const t = useTranslations('chalito.home');
  const tn = useTranslations('chalito.nav');
  const locale = useLocale() as AppLocale;
  const session = useSession();
  const { values: settings, onboarded } = useSettings();
  const title = settings
    ? formatCompanionTitle(settings.companionName.name, settings.companionName.isRenamed, locale)
    : null;
  // After onboarding (owner decision 2026-10-06): the companion big, and one obvious next step,
  // a new session. The sections stay below it.
  const ready = homeHeroShown({ settingsLoaded: !!settings, onboarded, sessionStatus: session.status });
  return (
    <div className="ch-chl">
      {ready ? (
        <section className="ch-chl ch-chl-center" data-testid="home-hero">
          <Companion hero />
          <h2 className="ch-h2">{t('title', { name: title?.title ?? PRODUCT_NAME })}</h2>
          {title?.credit ? <p className="ch-muted">{title.credit}</p> : null}
          <Link
            href="/sesiones/nueva"
            className="ch-btn ch-btn--primary ch-chl-cta"
            data-testid="home-talk"
          >
            {t('talk', { name: settings?.companionName.name ?? PRODUCT_NAME })}
          </Link>
        </section>
      ) : (
        <header className="ch-chl-head">
          <h2 className="ch-h2">{t('title', { name: title?.title ?? PRODUCT_NAME })}</h2>
          {title?.credit ? <p className="ch-muted">{title.credit}</p> : null}
          <p className="ch-sub">{t('subtitle')}</p>
          {settings ? (
            <p className="ch-muted" data-testid="home-companion">
              {t('companion', { name: companionName(settings.avatar, locale) })}
            </p>
          ) : null}
        </header>
      )}
      {session.status === 'signed_out' ? (
        <div className="ch-card ch-chl-card">
          <p>{t('signedOut')}</p>
          <SignInLink className="ch-btn ch-btn--primary">{t('signIn')}</SignInLink>
        </div>
      ) : null}
      <Group title={t(ready ? 'sections.moreTitle' : 'sections.sectionsTitle')}>
        {SECTIONS.map(([href, key, Icon, color]) => (
          <Row
            key={href}
            href={chalitoPath(href)}
            icon={<Icon />}
            iconColor={color}
            title={tn(key)}
            detail={t(`sections.${key}`)}
          />
        ))}
      </Group>
      {/* Only until onboarding is done: after that it would start the steps over. */}
      {settings && !onboarded ? (
        <Link href="/bienvenida" className="ch-btn ch-btn--primary ch-chl-fit">
          {t('startOnboarding')}
        </Link>
      ) : null}
    </div>
  );
};
