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
  /** Unread admin inbox: subscriber threads + landing-form inquiries. */
  unreadMessages?: number;
  /** Unread notifications. Feeds the Actividad badge. */
  unreadNotifications?: number;
  /** Engines in the catalogue, and how many are live. Rendered as the
   *  Engines badge so the sidebar, the strip and /dashboard/engines cannot
   *  disagree — this chip used to be the literal string "6" while the
   *  catalogue held eight. */
  engineCount?: number;
  engineLiveCount?: number;
}

function formatBadgeCount(n: number): string {
  if (n >= 100) return '99+';
  return String(n);
}

export function Sidebar({
  userInitial,
  userName,
  userRole,
  mobileOpen,
  unreadMessages = 0,
  unreadNotifications = 0,
  engineCount = 0,
  engineLiveCount = 0,
}: Props) {
  const pathname = usePathname();
  const setMobileSidebarOpen = useDashboard((s) => s.setMobileSidebarOpen);

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  /** Every badge in this sidebar is a real count taken on this render, or
   *  nothing at all. There are no decorative numbers. */
  function badgeFor(id: string): { text: string; highlight: boolean } | null {
    if (id === 'engines' && engineCount > 0) {
      return { text: `${engineLiveCount}/${engineCount}`, highlight: false };
    }
    if (id === 'messages' && unreadMessages > 0) {
      return { text: formatBadgeCount(unreadMessages), highlight: true };
    }
    if (id === 'activity' && unreadNotifications > 0) {
      return { text: formatBadgeCount(unreadNotifications), highlight: true };
    }
    return null;
  }

  return (
    <aside className={`cc-sb${mobileOpen ? ' open' : ''}`}>
      <div className="cc-sb-top">
        <FusionMark size={26} />
        <div className="cc-wm">Chalyb</div>
        <span className="cc-env">PROD</span>
      </div>

      <div className="cc-sb-scroll">
        {NAV.map((g) => (
          <div key={g.grp} className="cc-sb-grp">
            <div className="cc-gl">{g.grp}</div>
            <div className="cc-nav">
              {g.items.map((it) => {
                const badge = badgeFor(it.id);
                return (
                  <Link
                    key={it.id}
                    href={it.href as Route}
                    className={`cc-nav-item${isActive(it.href) ? ' on' : ''}${
                      it.disconnected ? ' cc-nav-item--off' : ''
                    }`}
                    title={
                      it.disconnected
                        ? `${it.label} — todavía no hay backend detrás de esta pantalla`
                        : undefined
                    }
                    onClick={() => setMobileSidebarOpen(false)}
                  >
                    <span className="cc-ic">{it.ic}</span>
                    <span>{it.label}</span>
                    {it.live && <span className="cc-dot" />}
                    {it.disconnected ? (
                      <span className="cc-ct cc-ct--off">sin conectar</span>
                    ) : (
                      badge && (
                        <span
                          className="cc-ct"
                          style={
                            badge.highlight
                              ? {
                                  background: 'var(--cc-green-g)',
                                  color: 'var(--cc-green)',
                                  border: '1px solid rgba(158,234,58,.3)',
                                }
                              : undefined
                          }
                        >
                          {badge.text}
                        </span>
                      )
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

      {/* No settings cog down here: Ajustes is one of the six above, and two
          doors to the same room is one door too many. */}
      <div className="cc-sb-foot">
        <div className="cc-ava">{userInitial}</div>
        <div className="cc-u">
          <div className="cc-u-n">{userName}</div>
          <div className="cc-u-r">{userRole}</div>
        </div>
        <SidebarSignOut onBeforeNav={() => setMobileSidebarOpen(false)} />
      </div>
    </aside>
  );
}
