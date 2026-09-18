'use client';

import { usePathname } from '@/i18n/routing';
import { ActivityFeedLive } from './activity-feed';

/**
 * The right-hand rail. HOME ONLY.
 *
 * It used to hang off every admin page, so a third of the screen was a live
 * ticker while you were trying to read a P&L or edit someone's role. It
 * belongs on the Centro de mando, where watching the platform breathe IS the
 * task; everywhere else it is noise competing with the page you opened.
 *
 * `cc-shell--no-rail` on the shell collapses the grid column when this
 * returns null, so the main column gets the space back.
 */
export function ActivityRail() {
  const pathname = usePathname();
  if (pathname !== '/dashboard') return null;

  return (
    <aside className="cc-rail">
      <div className="cc-rail-h">
        <span className="cc-rail-t">Actividad de IA</span>
        <span className="cc-live">
          <i />
          En vivo
        </span>
      </div>
      <ActivityFeedLive />
    </aside>
  );
}
