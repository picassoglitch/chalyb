'use client';

// Wizard step in the URL (?paso=N, P3-1): the browser's back button goes to
// the previous step and a refresh stays on the same one. Focus moves to the
// step's h1 so screen readers and keyboards start at the top.

import { useCallback, useEffect, useState } from 'react';

function fromUrl<S extends string | number>(allowed: readonly S[], fallback: S): S {
  if (typeof window === 'undefined') return fallback;
  const raw = new URLSearchParams(window.location.search).get('paso');
  return (allowed.find((s) => String(s) === raw) ?? fallback) as S;
}

function focusHeading() {
  requestAnimationFrame(() => {
    const h = document.querySelector<HTMLElement>('#main h1');
    if (!h) return;
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: false });
  });
}

/**
 * `canEnter(step)` guards a step restored from the URL whose prerequisites
 * aren't met (e.g. step 3 after a refresh with nothing saved) — the wizard
 * falls back to `initial`.
 */
export function useWizardStep<S extends string | number>(
  allowed: readonly S[],
  initial: S,
  canEnter: (step: S) => boolean = () => true,
): [S, (next: S) => void] {
  const [step, setStep] = useState<S>(initial);

  useEffect(() => {
    const restored = fromUrl(allowed, initial);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the URL once after mount
    if (restored !== initial && canEnter(restored)) setStep(restored);
    const onPop = () => {
      const s = fromUrl(allowed, initial);
      setStep(canEnter(s) ? s : initial);
      focusHeading();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const go = useCallback((next: S) => {
    const url = new URL(window.location.href);
    url.searchParams.set('paso', String(next));
    window.history.pushState(null, '', url);
    setStep(next);
    focusHeading();
  }, []);

  return [step, go];
}
