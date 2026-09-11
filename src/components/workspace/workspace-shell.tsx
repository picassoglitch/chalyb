'use client';

import { usePathname } from '@/i18n/routing';
import { useWorkspace } from '@/lib/workspace/store';
import { WorkspaceSidebar } from './workspace-sidebar';
import { WorkspaceTour } from './workspace-tour';
import { PAGE_META } from '@/components/dashboard/nav-data';

interface Props {
  userInitial: string;
  userName: string;
  tierLabel: string;
  isAdmin: boolean;
  /** Unread admin-sent messages shown as a chip on the Mensajes nav item. */
  unreadMessages?: number;
  children: React.ReactNode;
}

export function WorkspaceShell({
  userInitial,
  userName,
  tierLabel,
  isAdmin,
  unreadMessages = 0,
  children,
}: Props) {
  const pathname = usePathname();
  const mobileSidebarOpen = useWorkspace((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useWorkspace((s) => s.setMobileSidebarOpen);
  const toastHtml = useWorkspace((s) => s.toastHtml);

  const meta = PAGE_META[pathname] ?? { title: 'Tu espacio', sub: '' };

  return (
    // `cc-shell--no-rail` swaps the default 3-column grid (sidebar + main +
    // right rail) for a 2-column one. The subscriber workspace has no rail
    // content. We use a class instead of an inline `style` so the responsive
    // media queries in dashboard.css can still collapse to 1fr at ≤920 px —
    // inline styles win the cascade and broke mobile by leaving a 236 px
    // ghost column that pushed the page half-off-screen.
    <div className="cc-shell cc-shell--no-rail">
      {mobileSidebarOpen && (
        <div className="cc-sbscrim show" onClick={() => setMobileSidebarOpen(false)} />
      )}
      <WorkspaceSidebar
        userInitial={userInitial}
        userName={userName}
        tierLabel={tierLabel}
        isAdmin={isAdmin}
        unreadMessages={unreadMessages}
      />

      <main className="cc-main">
        <div className="cc-ph" style={{ paddingTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <button
              type="button"
              className="cc-mtoggle"
              aria-label="Menu"
              onClick={() => setMobileSidebarOpen(true)}
            >
              ☰
            </button>
            <div>
              <h1 className="cc-pg-title">{meta.title}</h1>
              <div className="cc-pg-sub">{meta.sub}</div>
            </div>
          </div>
        </div>
        {children}
      </main>

      {toastHtml && (
        <div className="cc-toast show">
          <span className="cc-td" />
          <span dangerouslySetInnerHTML={{ __html: toastHtml }} />
        </div>
      )}

      {/* First-run onboarding tour (once per browser, /app only). */}
      <WorkspaceTour />
    </div>
  );
}
