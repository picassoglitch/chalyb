'use client';

import { useEffect } from 'react';

/**
 * Defense-in-depth against the "logged out, hit Back, still see my account"
 * hole. Protected layouts render this. If the page is ever restored from the
 * browser's back/forward cache (bfcache) — an in-memory snapshot that does NOT
 * re-hit the server — we force a full reload so the server-side requireUser()
 * guard re-runs and redirects to /sign-in when the session is gone.
 *
 * `event.persisted` is true only on a genuine bfcache restore, so a logged-in
 * user navigating back just gets a fast warm reload; an unauthenticated one
 * gets bounced. Pairs with `Cache-Control: no-store` set in middleware.
 */
export function BfcacheGuard() {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return null;
}
