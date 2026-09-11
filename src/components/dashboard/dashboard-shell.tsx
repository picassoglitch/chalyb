'use client';

import { useEffect } from 'react';
import { usePathname } from '@/i18n/routing';
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
  /** Unread message count rendered as a chip on the "Mensajes" nav item.
   *  Combines subscriber-thread unreads + landing-form inquiries that
   *  haven't been opened yet. 0 hides the badge. */
  unreadMessages?: number;
  children: React.ReactNode;
}

export function DashboardShell({
  initialEngines,
  userInitial,
  userName,
  userRole,
  unreadMessages = 0,
  children,
}: Props) {
  const pathname = usePathname();
  const setEngines = useDashboard((s) => s.setEngines);
  const openPalette = useDashboard((s) => s.openPalette);
  const mobileSidebarOpen = useDashboard((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useDashboard((s) => s.setMobileSidebarOpen);
  const showToast = useDashboard((s) => s.showToast);

  // Hydrate Zustand from server-fetched engines once.
  useEffect(() => {
    setEngines(initialEngines);
  }, [initialEngines, setEngines]);

  // Page meta is keyed by exact pathname, but dynamic routes
  // (e.g. /dashboard/engines/[slug]) wouldn't match. Fall back to a prefix
  // search so /dashboard/engines/chalybclip inherits the /dashboard/engines
  // strip while we wait for someone to add slug-specific copy.
  const meta = PAGE_META[pathname] ?? (() => {
    for (const [key, value] of Object.entries(PAGE_META)) {
      if (pathname.startsWith(key + '/')) return value;
    }
    return { title: 'Módulo', sub: 'Esta sección sigue en construcción.' };
  })();

  return (
    <div className="cc-shell">
      {mobileSidebarOpen && (
        <div className="cc-sbscrim show" onClick={() => setMobileSidebarOpen(false)} />
      )}
      <Sidebar
        userInitial={userInitial}
        userName={userName}
        userRole={userRole}
        mobileOpen={mobileSidebarOpen}
        unreadMessages={unreadMessages}
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
            <button
              type="button"
              className="cc-ibtn"
              title="Notificaciones"
              onClick={() => showToast('No tienes notificaciones nuevas.')}
            >
              🔔
            </button>
          </div>
        </div>

        {children}
      </main>

      <ActivityRail />

      <button
        type="button"
        className="cc-mrail"
        title="Actividad"
        onClick={() => showToast('Actividad de IA — pronto la verás en pantalla completa')}
      >
        ⚡
      </button>

      <CommandPalette />
      <DetailDrawer />
      <Toast />
    </div>
  );
}
