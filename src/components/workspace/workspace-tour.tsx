'use client';

// First-run onboarding tour for the /app workspace. A small spotlight + tooltip
// walks new users through the chrome: the menu, where their engines live, their
// token balance, and where they edit their info. Dependency-free — anchors to
// elements tagged with `data-tour="..."` in the sidebar.
//
// Shown once, gated by a localStorage flag (no DB column needed). On mobile the
// sidebar is off-canvas, so we open it for the duration of the tour. If a target
// is ever missing the step gracefully falls back to a centered card.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/lib/workspace/store';

const STORAGE_KEY = 'chalyb.tour.app.v1';
const MOBILE_BP = 920;
const RING_PAD = 6;

type Step = { key: string; target: string | null };

// Order matches the chrome top-to-bottom. `target` is a CSS selector for the
// element to spotlight; null = a centered card (the welcome step).
const STEPS: Step[] = [
  { key: 'welcome', target: null },
  { key: 'nav', target: '[data-tour="nav"]' },
  { key: 'engines', target: '[data-tour="nav-myengines"]' },
  { key: 'tokens', target: '[data-tour="nav-usage"]' },
  { key: 'plan', target: '[data-tour="nav-subscription"]' },
  { key: 'account', target: '[data-tour="nav-profile"]' },
  { key: 'help', target: '[data-tour="nav-help"]' },
];

interface Pos {
  top: number;
  left: number;
  width: number;
}

export function WorkspaceTour() {
  const t = useTranslations('tour');
  const setMobileSidebarOpen = useWorkspace((s) => s.setMobileSidebarOpen);

  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const openedSidebar = useRef(false);

  // Start once per browser, after layout settles. Guarded so SSR + repeat
  // visits render nothing.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      seen = false;
    }
    if (seen) return;
    const id = window.setTimeout(() => {
      if (window.innerWidth < MOBILE_BP) {
        setMobileSidebarOpen(true);
        openedSidebar.current = true;
      }
      setActive(true);
    }, 500);
    return () => window.clearTimeout(id);
  }, [setMobileSidebarOpen]);

  // Close the tour. `persist: true` ("Close" / finishing) writes the flag so it
  // never auto-shows again. `persist: false` ("Ver más tarde" / Esc) just hides
  // it — it pops back up on the next login until the user truly closes it.
  const close = useCallback(
    (persist: boolean) => {
      if (persist) {
        try {
          window.localStorage.setItem(STORAGE_KEY, '1');
        } catch {
          /* private mode — tour re-shows next visit, acceptable */
        }
      }
      if (openedSidebar.current) setMobileSidebarOpen(false);
      setActive(false);
    },
    [setMobileSidebarOpen],
  );

  // Resolve the current step's target rect (scrolling it into view first so a
  // long sidebar still spotlights an item below the fold).
  const measure = useCallback(() => {
    if (!active) return;
    const sel = STEPS[step]?.target ?? null;
    if (!sel) {
      setRect(null);
      return;
    }
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
    setRect(el.getBoundingClientRect());
  }, [active, step]);

  useLayoutEffect(() => {
    // Measure-then-position: reading layout and setting the rect synchronously
    // in a layout effect is the sanctioned pattern (avoids a flicker frame).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
  }, [measure]);

  // Keep the spotlight glued to its target through resize / scroll.
  useEffect(() => {
    if (!active) return;
    const onMove = () => measure();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [active, measure]);

  // Place the tooltip relative to the target (right → below → above → center),
  // clamped to the viewport. Runs after the card renders so we know its size.
  useLayoutEffect(() => {
    if (!active) return;
    const tip = tipRef.current;
    if (!tip) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = 12;
    const width = Math.min(480, vw - 2 * M);
    const th = tip.offsetHeight;

    if (!rect) {
      setPos({ width, left: (vw - width) / 2, top: Math.max(M, (vh - th) / 2) });
      return;
    }
    const clampTop = (v: number) => Math.min(Math.max(v, M), vh - th - M);
    const clampLeft = (v: number) => Math.min(Math.max(v, M), vw - width - M);

    let left: number;
    let top: number;
    if (rect.right + 14 + width <= vw - M) {
      left = rect.right + 14; // to the right (sidebar case)
      top = clampTop(rect.top);
    } else if (rect.bottom + 14 + th <= vh - M) {
      left = clampLeft(rect.left);
      top = rect.bottom + 14; // below
    } else if (rect.top - 14 - th >= M) {
      left = clampLeft(rect.left);
      top = rect.top - 14 - th; // above
    } else {
      left = clampLeft(rect.left);
      top = clampTop(rect.top);
    }
    setPos({ width, left, top });
  }, [active, rect, step]);

  // Esc skips, Enter / → advances.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false); // Esc = see later, not permanent
      else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        if (step >= STEPS.length - 1) close(true);
        else setStep((s) => s + 1);
      } else if (e.key === 'ArrowLeft') {
        setStep((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, step, close]);

  const current = STEPS[step];
  if (!active || !current) return null;

  const isLast = step === STEPS.length - 1;
  const key = current.key;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000 }} aria-live="polite">
      {/* Dim + spotlight. The ring's huge box-shadow dims everything except the
          target hole; for the centered welcome step we dim the whole screen. */}
      {rect ? (
        <div
          style={{
            position: 'fixed',
            top: rect.top - RING_PAD,
            left: rect.left - RING_PAD,
            width: rect.width + RING_PAD * 2,
            height: rect.height + RING_PAD * 2,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(3,4,7,0.74)',
            border: '2px solid var(--cc-green)',
            pointerEvents: 'none',
            transition: 'top .2s ease, left .2s ease, width .2s ease, height .2s ease',
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,4,7,0.74)', pointerEvents: 'none' }} />
      )}

      {/* Click catcher — blocks the page behind so the tour stays in control. */}
      <div style={{ position: 'fixed', inset: 0 }} onClick={(e) => e.stopPropagation()} />

      {/* Tooltip card */}
      <div
        ref={tipRef}
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          width: pos?.width ?? 480,
          visibility: pos ? 'visible' : 'hidden',
        }}
        className="rounded-[20px] border border-[var(--cc-line-2)] bg-[var(--cc-panel)] p-8 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.8)]"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cc-green)] [font-family:var(--cc-mono),monospace]">
            {t('step', { current: step + 1, total: STEPS.length })}
          </span>
          {/* Permanent close — the only action that stops the tour for good. */}
          <button
            type="button"
            onClick={() => close(true)}
            aria-label={t('close')}
            title={t('close')}
            className="-mr-1 -mt-1 grid size-7 place-items-center rounded-lg text-[var(--cc-txt-4)] transition-colors hover:bg-white/[0.04] hover:text-[var(--cc-txt-2)]"
          >
            ✕
          </button>
        </div>

        <h3
          className="text-[19px] font-bold tracking-tight text-[var(--cc-txt)]"
          style={{ fontFamily: 'var(--cc-disp), sans-serif' }}
        >
          {t(`steps.${key}.title`)}
        </h3>
        <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--cc-txt-2)]">
          {t(`steps.${key}.body`)}
        </p>

        {/* Progress dots */}
        <div className="mt-5 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-4 bg-[var(--cc-green)]' : 'w-1.5 bg-[var(--cc-line-2)]'
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          {/* See later — postpone; reappears on next login. */}
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-lg px-1 py-1.5 text-[12px] font-semibold text-[var(--cc-txt-4)] transition-colors hover:text-[var(--cc-txt-2)]"
          >
            {t('later')}
          </button>

          <div className="flex items-center gap-1">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--cc-txt-3)] transition-colors hover:text-[var(--cc-txt)]"
              >
                {t('back')}
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? close(true) : setStep((s) => s + 1))}
              style={{ color: '#0a0c0e' }}
              className="rounded-lg bg-[var(--cc-green)] px-4 py-2 text-[12.5px] font-bold transition-[filter] hover:brightness-110"
            >
              {isLast ? t('done') : t('next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
