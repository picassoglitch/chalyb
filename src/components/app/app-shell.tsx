'use client';

// The subscriber shell (SCR-01/08): a 272px sidebar with exactly three items
// on desktop, a header + bottom tabs below 900px, and nothing at all inside a
// wizard. Old /app screens keep working inside a contained legacy panel.

import type { Route } from 'next';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { House, LayoutDashboard, SquarePlay, User } from 'lucide-react';
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
  children: ReactNode;
}

export function AppShell({ userName, planKey, isAdmin, banner, children }: Props) {
  const pathname = usePathname();
  const t = useTranslations('app.nav');
  const toastHtml = useWorkspace((s) => s.toastHtml);
  const mode = shellModeFor(pathname);
  const active = activeNavFor(pathname);

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
        <Logo href="/app" />
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
            {/* TODO(P3): the Avisos bell (BUILD-SPEC §5.4) joins here with /app/avisos. */}
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
