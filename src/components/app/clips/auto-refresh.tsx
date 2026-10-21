'use client';

// Re-reads the job every few seconds while it is being created. The page is a
// server component; refreshing it re-runs the job policy on the server.
//
// The next refresh is scheduled only after the previous one has rendered,
// or retried if it stays pending (armRefresh). A fixed setInterval fired a
// new router.refresh() every 2 s whatever happened to the last one; when the
// server took longer than that (e2e load: eight workers, the ready job's
// settlement writes), each refresh was superseded by the next before it
// rendered, and the page sat on "creating" past the test's 30 s
// (clips-flow.spec.ts:29).
//
// Only while the tab is visible: a hidden tab doesn't re-render the whole
// page on the server every few seconds (and doesn't compete with the clicks
// of the tab the person is using). Coming back re-reads right away.

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { armRefresh } from '@/lib/tools/clips-refresh';

export function AutoRefresh({ everyMs = 2000 }: { everyMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);
  const wasHidden = useRef(false);
  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  useEffect(() => {
    if (hidden) {
      wasHidden.current = true;
      return;
    }
    const cameBack = wasHidden.current;
    wasHidden.current = false;
    return armRefresh({ pending, cameBack, everyMs }, () =>
      startTransition(() => router.refresh()),
    );
  }, [pending, hidden, router, everyMs]);
  return null;
}
