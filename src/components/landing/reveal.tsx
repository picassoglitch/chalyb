'use client';

import { useEffect } from 'react';

/**
 * Mounts a single global IntersectionObserver that toggles `.in` on any element
 * with class `.reveal` once it enters the viewport. Re-observes new nodes added
 * later via a MutationObserver (path reorder, locale rebuilds).
 */
export function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('in');
        });
      },
      { threshold: 0.1 },
    );

    const observeAll = () => {
      document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));
    };
    observeAll();

    const mo = new MutationObserver(() => observeAll());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
