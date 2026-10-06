'use client';

// The owner panel shell (P5): the app's light design system, six nav items,
// the "Dueño" card and "Ver la app ›". Below 900px the nav becomes a
// scrollable strip under the header.

import type { Route } from 'next';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Banknote, Gauge, History, LayoutGrid, Settings, Users } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { Avatar, Logo } from '@/components/ui/primitives';
import { ADMIN_MORE, ADMIN_NAV, activeAdminNav, type AdminNavKey } from './admin-routes';

const ICONS: Record<AdminNavKey, typeof Gauge> = {
  command: Gauge,
  people: Users,
  money: Banknote,
  tools: LayoutGrid,
  activity: History,
  settings: Settings,
};

export function AdminShell({ ownerName, children }: { ownerName: string; children: ReactNode }) {
  const t = useTranslations('admin');
  const active = activeAdminNav(usePathname());

  const items = ADMIN_NAV.map(({ key, href }) => {
    const Icon = ICONS[key];
    return (
      <Link key={key} href={href as Route} aria-current={active === key ? 'page' : undefined}>
        <Icon aria-hidden="true" />
        {t(`nav.${key}`)}
      </Link>
    );
  });

  return (
    <div className="chalyb-app ch-shell ch-admin">
      <a href="#main" className="ch-skip">
        {t('nav.aria')}
      </a>
      <aside className="ch-side">
        <Logo href="/dashboard" />
        <nav className="ch-nav" aria-label={t('nav.aria')}>
          {items}
        </nav>
        <details className="ch-adm-more">
          <summary>{t('nav.more')}</summary>
          <ul>
            {ADMIN_MORE.map((m) => (
              <li key={m.key}>
                <Link href={m.href as Route}>{t(`more.${m.key}`)}</Link>
              </li>
            ))}
          </ul>
        </details>
        <div className="ch-me" style={{ display: 'grid', gap: 10 }}>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
            <Avatar name={ownerName} />
            <span style={{ minWidth: 0 }}>
              <span className="ch-me__n" style={{ display: 'block' }}>
                {ownerName}
              </span>
              <span className="ch-me__p">{t('nav.owner')}</span>
            </span>
          </span>
          <Link href={'/app' as Route} className="ch-lnk">
            {t('nav.viewApp')}
          </Link>
        </div>
      </aside>

      <div className="ch-main">
        <header className="ch-mhead">
          <Logo href="/dashboard" />
          <Link href={'/app' as Route} className="ch-lnk">
            {t('nav.viewApp')}
          </Link>
        </header>
        <nav className="ch-adm-mnav" aria-label={t('nav.aria')}>
          {items}
        </nav>
        <main id="main" className="ch-content">
          <div className="ch-wrap ch-wrap--wide">{children}</div>
        </main>
      </div>
    </div>
  );
}
