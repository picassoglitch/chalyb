'use client';

import { useEffect } from 'react';
import type { Route } from 'next';
import { Link, usePathname } from '@/i18n/routing';
import { useDashboard } from '@/lib/dashboard/store';
import { Sidebar } from './sidebar';
import { ActivityRail } from './activity-rail';
import { MetricStrip } from './metric-strip';
import { CommandPalette } from './command-palette';
import { DetailDrawer } from './detail-drawer';
import { Toast } from './toast';
import { PAGE_META } from './nav-data';
import type { Engine } from '@/lib/data/types';

interface Props {
  initialEngines: Engine[];
  userInitial: string;
  userName: string;
  userRole: string;
  /** Unread admin inbox: subscriber threads + landing-form inquiries. */
  unreadMessages?: number;
  /** Unread notifications. Badges Actividad and the bell. */
  unreadNotifications?: number;
  children: React.ReactNode;
}

export function DashboardShell({
  initialEngines,
  userInitial,
  userName,
  userRole,
  unreadMessages = 0,
  unreadNotifications = 0,
  children,
}: Props) {
  const pathname = usePathname();
  const setEngines = useDashboard((s) => s.setEngines);
  const openPalette = useDashboard((s) => s.openPalette);
  const mobileSidebarOpen = useDashboard((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useDashboard((s) => s.setMobileSidebarOpen);

  // Hydrate Zustand from server-fetched engines once.
  useEffect(() => {
    setEngines(initialEngines);
  }, [initialEngines, setEngines]);

  // Page meta is keyed by exact pathname, but dynamic routes
  // (e.g. /dashboard/engines/[slug]) wouldn't match. Fall back to a prefix
  // search so /dashboard/engines/chalybclip inherits the /dashboard/engines
  // strip while we wait for someone to add slug-specific copy.
  const meta =
    PAGE_META[pathname] ??
    (() => {
      for (const [key, value] of Object.entries(PAGE_META)) {
        if (pathname.startsWith(key + '/')) return value;
      }
      return { title: 'Módulo', sub: 'Esta sección sigue en construcción.' };
    })();

  // One catalogue count for the whole shell: the strip's "vivos / total" and
  // the Engines badge in the sidebar read the same two numbers. The sidebar
  // used to carry a hardcoded "6" while the catalogue held eight.
  const engineLiveCount = initialEngines.filter((e) => e.status === 'active').length;

  // The rail lives on the Centro de mando only. Everywhere else the main
  // column takes the space back.
  const railVisible = pathname === '/dashboard';

  return (
    <div className={`cc-shell${railVisible ? '' : ' cc-shell--no-rail'}`}>
      {mobileSidebarOpen && (
        <div className="cc-sbscrim show" onClick={() => setMobileSidebarOpen(false)} />
      )}
      <Sidebar
        userInitial={userInitial}
        userName={userName}
        userRole={userRole}
        mobileOpen={mobileSidebarOpen}
        unreadMessages={unreadMessages}
        unreadNotifications={unreadNotifications}
        engineCount={initialEngines.length}
        engineLiveCount={engineLiveCount}
      />

      <main className="cc-main">
        <MetricStrip totalEngines={initialEngines.length} />

        <div className="cc-ph">
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <button
              type="button"
              className="cc-mtoggle"
              aria-label="Abrir menú"
              onClick={() => setMobileSidebarOpen(true)}
            >
              ☰
            </button>
            <div>
              <h1 className="cc-pg-title">{meta.title}</h1>
              <div className="cc-pg-sub">{meta.sub}</div>
            </div>
          </div>
          <div className="cc-tools">
            <button type="button" className="cc-cmdk" onClick={openPalette}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ width: 14, height: 14 }}
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4-4" />
              </svg>
              <span>Busca o ejecuta una acción…</span>
              <kbd>⌘K</kbd>
            </button>
            {/* Goes to Actividad. It used to be a button that popped a toast
                saying "No tienes notificaciones nuevas" whether or not that
                was true. */}
            <Link
              href={'/dashboard/activity' as Route}
              className="cc-ibtn"
              title={
                unreadNotifications > 0
                  ? `${unreadNotifications} notificación${unreadNotifications === 1 ? '' : 'es'} sin leer`
                  : 'Actividad — notificaciones y auditoría'
              }
              style={{ position: 'relative' }}
            >
              🔔
              {unreadNotifications > 0 && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--cc-green)',
                    boxShadow: '0 0 6px var(--cc-green)',
                  }}
                />
              )}
            </Link>
          </div>
        </div>

        {children}
      </main>

      <ActivityRail />

      <CommandPalette />
      <DetailDrawer />
      <Toast />
    </div>
  );
}
