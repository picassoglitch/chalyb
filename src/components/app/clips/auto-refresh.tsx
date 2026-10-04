'use client';

// Re-reads the job every few seconds while it is being created. The page is a
// server component; refreshing it re-runs the job policy on the server.
//
// The next refresh is scheduled only after the previous one has rendered. A
// fixed setInterval fired a new router.refresh() every 2 s whatever happened
// to the last one; when the server took longer than that (e2e load: eight
// workers, the ready job's settlement writes), each refresh was superseded
// by the next before it rendered, and the page sat on "creating" past the
// test's 30 s (clips-flow.spec.ts:29).

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh({ everyMs = 2000 }: { everyMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (pending) return;
    const id = window.setTimeout(() => startTransition(() => router.refresh()), everyMs);
    return () => window.clearTimeout(id);
  }, [pending, router, everyMs]);
  return null;
}
