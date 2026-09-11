'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type Path = 'client' | 'partner' | 'earn';

export const PATH_META: Record<Path, { accent: string; glow: string; order: string[] }> = {
  client: {
    accent: '#3df5e0',
    glow: 'rgba(61,245,224,0.4)',
    order: ['proof', 'client-world', 'partner-world', 'earn-world'],
  },
  partner: {
    accent: '#7a5cff',
    glow: 'rgba(122,92,255,0.4)',
    order: ['partner-world', 'proof', 'client-world', 'earn-world'],
  },
  earn: {
    accent: '#c6f24e',
    glow: 'rgba(198,242,78,0.4)',
    order: ['earn-world', 'proof', 'client-world', 'partner-world'],
  },
};

const NEUTRAL_ACCENT = '#c6f24e';
const NEUTRAL_GLOW = 'rgba(198,242,78,0.4)';
const DEFAULT_ORDER = ['proof', 'client-world', 'partner-world', 'earn-world'];

function isPath(v: string | null): v is Path {
  return v === 'client' || v === 'partner' || v === 'earn';
}

interface PathContextValue {
  path: Path | null;
  setPath: (next: Path | null, opts?: { scroll?: boolean }) => void;
  sectionOrder: string[];
}

const PathContext = createContext<PathContextValue | null>(null);

export function PathProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Derive path from URL on every render — single source of truth.
  // Locale switches preserve ?view= via the nav, so the URL is the canonical state.
  const urlView = searchParams.get('view');
  const path: Path | null = isPath(urlView) ? urlView : null;

  // Ref-based scroll request. Decoupled from setPath so the actual
  // scroll fires from a useEffect that watches `path` — only AFTER React
  // has committed the URL change + the section grid has re-rendered with
  // the new sectionOrder. Without this, the scroll fires while the DOM
  // is still in the OLD order: the user lands in the wrong place and has
  // to click again. Was a setTimeout(120ms) — too fragile across devices.
  const pendingScrollTargetRef = useRef<Path | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const accent = path ? PATH_META[path].accent : NEUTRAL_ACCENT;
    const glow = path ? PATH_META[path].glow : NEUTRAL_GLOW;
    root.style.setProperty('--path', accent);
    root.style.setProperty('--path-glow', glow);

    // If the user clicked a door that requested a scroll AND the path
    // we're now rendering matches that intent, fire the scroll. We're
    // guaranteed to be running AFTER React's commit phase here, so any
    // dependent component that uses `sectionOrder` (landing-page.tsx in
    // particular) has already re-ordered the DOM. One more rAF gives the
    // browser a paint cycle for layout to settle before we measure
    // element positions in scrollIntoView.
    if (pendingScrollTargetRef.current && pendingScrollTargetRef.current === path) {
      const firstId = PATH_META[path].order[0];
      pendingScrollTargetRef.current = null;
      if (firstId) {
        requestAnimationFrame(() => {
          const el = document.getElementById(firstId);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }
  }, [path]);

  const setPath = useCallback(
    (next: Path | null, opts?: { scroll?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set('view', next);
      else params.delete('view');
      const qs = params.toString();

      // Record scroll intent BEFORE router.replace. When React commits the
      // path change, the useEffect above sees the ref + path match and
      // fires the scroll — same logical flow, but the timing now derives
      // from React's lifecycle instead of a guessed millisecond budget.
      if (opts?.scroll && next) {
        pendingScrollTargetRef.current = next;
      }

      router.replace(qs ? `?${qs}` : '?', { scroll: false });

      // Edge case — if `next === path` already (re-click on the same
      // door), the useEffect won't fire because `path` didn't change.
      // Scroll immediately in that case so a re-click still lands the
      // user on the target section.
      if (opts?.scroll && next && next === path) {
        const firstId = PATH_META[next].order[0];
        pendingScrollTargetRef.current = null;
        if (firstId) {
          requestAnimationFrame(() => {
            const el = document.getElementById(firstId);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          });
        }
      }
    },
    [router, searchParams, path],
  );

  const sectionOrder = path ? PATH_META[path].order : DEFAULT_ORDER;
  const value = useMemo(() => ({ path, setPath, sectionOrder }), [path, setPath, sectionOrder]);

  return <PathContext.Provider value={value}>{children}</PathContext.Provider>;
}

export function usePath() {
  const ctx = useContext(PathContext);
  if (!ctx) throw new Error('usePath must be used inside <PathProvider>');
  return ctx;
}
