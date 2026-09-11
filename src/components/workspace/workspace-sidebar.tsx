'use client';

import type { Route } from 'next';
import { Link, usePathname } from '@/i18n/routing';
import { FusionMark } from '@/components/dashboard/fusion-mark';
import { SUBSCRIBER_NAV } from '@/components/dashboard/nav-data';
import { SidebarSignOut } from '@/components/dashboard/sidebar-sign-out';
import { useWorkspace } from '@/lib/workspace/store';

interface Props {
  userInitial: string;
  userName: string;
  tierLabel: string;
  isAdmin: boolean;
  /** Render as the ct chip on the Mensajes nav item. 0 hides it.
   *  Counts ≥ 100 collapse to "99+" so the chip width stays predictable. */
  unreadMessages?: number;
}

function formatBadgeCount(n: number): string {
  if (n >= 100) return '99+';
  return String(n);
}

export function WorkspaceSidebar({
  userInitial,
  userName,
  tierLabel,
  isAdmin,
  unreadMessages = 0,
}: Props) {
  const pathname = usePathname();
  const setMobileSidebarOpen = useWorkspace((s) => s.setMobileSidebarOpen);
  const mobileOpen = useWorkspace((s) => s.mobileSidebarOpen);

  function isActive(href: string): boolean {
    if (href === '/app') return pathname === '/app';
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside className={`cc-sb${mobileOpen ? ' open' : ''}`}>
      <div className="cc-sb-top">
        <FusionMark size={26} />
        <div className="cc-wm">Chalyb</div>
        <span className="cc-env">{tierLabel}</span>
      </div>

      <div className="cc-sb-scroll" data-tour="nav">
        {SUBSCRIBER_NAV.map((g) => (
          <div key={g.grp} className="cc-sb-grp">
            <div className="cc-gl">{g.grp}</div>
            <div className="cc-nav">
              {g.items.map((it) => {
                // Override the static `ct` on the Mensajes item with the
                // live unread count from the server. Static NAV stays
                // count-agnostic for every other item.
                const ct =
                  it.id === 'messages' && unreadMessages > 0
                    ? formatBadgeCount(unreadMessages)
                    : it.ct;
                return (
                  <Link
                    key={it.id}
                    href={it.href as Route}
                    data-tour={`nav-${it.id}`}
                    className={`cc-nav-item${isActive(it.href) ? ' on' : ''}`}
                    onClick={() => setMobileSidebarOpen(false)}
                  >
                    <span className="cc-ic">{it.ic}</span>
                    <span>{it.label}</span>
                    {it.live && <span className="cc-dot" />}
                    {ct && (
                      <span
                        className="cc-ct"
                        style={
                          // Highlight unread-message badge in green so it's
                          // the eye-catcher in the sidebar (vs. neutral counts
                          // used by other items).
                          it.id === 'messages' && unreadMessages > 0
                            ? {
                                background: 'var(--cc-green-g)',
                                color: 'var(--cc-green)',
                                border: '1px solid rgba(158,234,58,.3)',
                              }
                            : undefined
                        }
                      >
                        {ct}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Cross-nav: only admins can swap into the operator command center */}
        {isAdmin && (
          <div className="cc-sb-grp">
            <div className="cc-gl">Vista</div>
            <div className="cc-nav">
              <Link
                href={'/dashboard' as Route}
                className="cc-nav-item"
                onClick={() => setMobileSidebarOpen(false)}
                title="Volver al command center"
              >
                <span className="cc-ic">⬡</span>
                <span>Vista admin</span>
                <span className="cc-ct">→</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="cc-sb-foot">
        <div className="cc-ava">{userInitial}</div>
        <div className="cc-u">
          <div className="cc-u-n">{userName}</div>
          <div className="cc-u-r">{tierLabel} plan</div>
        </div>
        <Link
          href={'/app/settings' as Route}
          className="cc-cog"
          title="Settings"
          onClick={() => setMobileSidebarOpen(false)}
        >
          ⚙
        </Link>
        {/* Always-visible logout next to settings — same pattern as
            the admin sidebar. One click signs out + lands on the public
            landing page. */}
        <SidebarSignOut onBeforeNav={() => setMobileSidebarOpen(false)} />
      </div>
    </aside>
  );
}
