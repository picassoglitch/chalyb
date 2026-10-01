'use client';

// The subscriber shell (SCR-01/08): a 272px sidebar with exactly three items
// on desktop, a header + bottom tabs below 900px, and nothing at all inside a
// wizard. Old /app screens keep working inside a contained legacy panel.

import type { Route } from 'next';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, House, LayoutDashboard, SquarePlay, User } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { useWorkspace } from '@/lib/workspace/store';
import { Avatar, Logo } from '@/components/ui/primitives';
import {
  NAV_ITEMS,
  activeNavFor,
  shellModeFor,
  type NavKey,
  type PlanLabelKey,
} from './shell-routes';

const NAV_ICONS: Record<NavKey, typeof House> = {
  inicio: House,
  resultados: SquarePlay,
  cuenta: User,
};

interface Props {
  userName: string;
  planKey: PlanLabelKey;
  isAdmin: boolean;
  /** The single top-banner slot (SCR-17). P2 fills it; empty in P1. */
  banner?: ReactNode;
  /** Unread Avisos for the bell (SCR-26). */
  unread?: number;
  children: ReactNode;
}

function AvisosBell({ unread, label }: { unread: number; label: string }) {
  return (
    <Link href={'/app/avisos' as Route} className="ch-bell" aria-label={label}>
      <Bell aria-hidden="true" />
      {unread > 0 && (
        <span className="ch-bell__n" aria-hidden="true">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}

export function AppShell({ userName, planKey, isAdmin, banner, unread = 0, children }: Props) {
  const pathname = usePathname();
  const t = useTranslations('app.nav');
  const toastHtml = useWorkspace((s) => s.toastHtml);
  const mode = shellModeFor(pathname);
  const active = activeNavFor(pathname);
  const tn = useTranslations('notif');
  const bell = <AvisosBell unread={unread} label={unread > 0 ? tn('bell', { n: unread }) : tn('bellNone')} />;

  const toast = toastHtml && (
    <div role="status" className="ch-toast">
      {/* Legacy toasts carry <b> markup from their callers. */}
      <span dangerouslySetInnerHTML={{ __html: toastHtml }} />
    </div>
  );

  if (mode === 'wizard') {
    return (
      <div className="chalyb-app">
        {children}
        {toast}
      </div>
    );
  }

  const content =
    mode === 'legacy' ? (
      <div className="cc-shell ch-legacy">
        <div className="cc-main">{children}</div>
      </div>
    ) : (
      children
    );

  return (
    <div className="chalyb-app ch-shell">
      <a href="#main" className="ch-skip">
        {t('skip')}
      </a>
      <aside className="ch-side">
        <div className="ch-side__top">
          <Logo href="/app" />
          {bell}
        </div>
        <nav className="ch-nav" aria-label={t('aria')}>
          {NAV_ITEMS.map(({ key, href }) => {
            const Icon = NAV_ICONS[key];
            return (
              <Link
                key={key}
                href={href as Route}
                aria-current={active === key ? 'page' : undefined}
              >
                <Icon aria-hidden="true" />
                {t(key)}
              </Link>
            );
          })}
          {isAdmin && (
            <div className="ch-side__extra">
              <Link href={'/dashboard' as Route}>
                <LayoutDashboard aria-hidden="true" />
                {t('admin')}
              </Link>
            </div>
          )}
        </nav>
        <Link href={'/app/settings' as Route} className="ch-me">
          <Avatar name={userName} />
          <span style={{ minWidth: 0 }}>
            <span className="ch-me__n" style={{ display: 'block' }}>
              {userName}
            </span>
            <span className="ch-me__p">{t(`plan.${planKey}`)}</span>
          </span>
        </Link>
      </aside>

      <div className="ch-main">
        <header className="ch-mhead">
          <Logo href="/app" />
          <div className="ch-mhead__r">
            {bell}
            <Link href={'/app/settings' as Route} aria-label={t('cuenta')}>
              <Avatar name={userName} />
            </Link>
          </div>
        </header>
        {banner}
        <main id="main" className={`ch-content${mode === 'legacy' ? ' ch-content--legacy' : ''}`}>
          {mode === 'legacy' ? content : <div className="ch-wrap">{content}</div>}
        </main>
      </div>

      <nav className="ch-tabs" aria-label={t('aria')}>
        {NAV_ITEMS.map(({ key, href }) => {
          const Icon = NAV_ICONS[key];
          return (
            <Link key={key} href={href as Route} aria-current={active === key ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              {t(`tab.${key}`)}
            </Link>
          );
        })}
      </nav>
      {toast}
    </div>
  );
}
