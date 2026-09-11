'use client';

import type { Route } from 'next';
import { Link, usePathname } from '@/i18n/routing';
import { FusionMark } from './fusion-mark';
import { NAV } from './nav-data';
import { SidebarSignOut } from './sidebar-sign-out';
import { useDashboard } from '@/lib/dashboard/store';

interface Props {
  userInitial: string;
  userName: string;
  userRole: string;
  mobileOpen?: boolean;
  /** Render as the ct chip on the Mensajes nav item. 0 / undefined hides it.
   *  Counts >= 100 collapse to "99+" so the chip width stays predictable. */
  unreadMessages?: number;
}

function formatBadgeCount(n: number): string {
  if (n >= 100) return '99+';
  return String(n);
}

export function Sidebar({ userInitial, userName, userRole, mobileOpen, unreadMessages = 0 }: Props) {
  const pathname = usePathname();
  const setMobileSidebarOpen = useDashboard((s) => s.setMobileSidebarOpen);

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside className={`cc-sb${mobileOpen ? ' open' : ''}`}>
      <div className="cc-sb-top">
        <FusionMark size={26} />
        <div className="cc-wm">
          Chalyb
        </div>
        <span className="cc-env">PROD</span>
      </div>

      <div className="cc-sb-scroll">
        {NAV.map((g) => (
          <div key={g.grp} className="cc-sb-grp">
            <div className="cc-gl">{g.grp}</div>
            <div className="cc-nav">
              {g.items.map((it) => {
                // Override the static `ct` on the Mensajes item with the
                // live unread count from the server. Keeps NAV stateless
                // for everything else.
                const ct =
                  it.id === 'messages' && unreadMessages > 0
                    ? formatBadgeCount(unreadMessages)
                    : it.ct;
                return (
                  <Link
                    key={it.id}
                    href={it.href as Route}
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
                          // Highlight unread-message badges in green so they
                          // pop against the muted counts (engines: "6",
                          // models: "9", etc.) that share this class.
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

        {/* Cross-nav: switch to subscriber view */}
        <div className="cc-sb-grp">
          <div className="cc-gl">Vista</div>
          <div className="cc-nav">
            <Link
              href={'/app' as Route}
              className="cc-nav-item"
              onClick={() => setMobileSidebarOpen(false)}
              title="Mira tu plataforma como la ven tus subscribers"
            >
              <span className="cc-ic">◐</span>
              <span>Vista de subscriber</span>
              <span className="cc-ct">→</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="cc-sb-foot">
        <div className="cc-ava">{userInitial}</div>
        <div className="cc-u">
          <div className="cc-u-n">{userName}</div>
          <div className="cc-u-r">{userRole}</div>
        </div>
        <Link
          href={'/dashboard/settings' as Route}
          className="cc-cog"
          title="Ajustes"
          onClick={() => setMobileSidebarOpen(false)}
        >
          ⚙
        </Link>
        {/* Always-visible logout next to settings. One click signs out
            via supabase + bounces to landing. */}
        <SidebarSignOut onBeforeNav={() => setMobileSidebarOpen(false)} />
      </div>
    </aside>
  );
}
