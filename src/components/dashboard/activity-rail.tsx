'use client';

import { ActivityFeedLive } from './activity-feed';

export function ActivityRail() {
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
