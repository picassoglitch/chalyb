'use client';

// Re-reads the job every few seconds while it is being created. The page is a
// server component; refreshing it re-runs the job policy on the server.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh({ everyMs = 2000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), everyMs);
    return () => window.clearInterval(id);
  }, [router, everyMs]);
  return null;
}
