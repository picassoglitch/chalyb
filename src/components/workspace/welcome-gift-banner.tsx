'use client';

// First-time welcome banner shown at the top of /app while the user hasn't
// accepted yet (server passes `claimed`). On accept:
//   1. call claimWelcomeGift() (marks claimed; starts the ChalyClip trial only
//      when ChalyClip is actually runnable — see welcome-actions.ts)
//   2. hide the banner + fire confetti
//   3. after the confetti settles, router.refresh() so the stat cards re-render
//      — refreshing AFTER the animation instead of unmounting it mid-flight.
//
// COPY IS HONEST ABOUT THE FLEET. The 50,000 tokens are the Free monthly
// allocation (a real balance, rendered from getTokenBalance). The 7-day
// ChalyClip Pro trial is described as running only when `clipRunnable`; while
// ChalyClip is being rebuilt the banner says the trial is reserved and starts
// the day ChalyClip is ready — which is exactly what the server action does.
//
// PERSISTENCE. Accepting is recorded in the database (welcome_gift_claimed_at).
// "Ahora no" is remembered in a cookie scoped to this user id (see
// WELCOME_DISMISSED_COOKIE) that the server page reads before rendering, so the
// banner never mounts open again on a client navigation, a reload, or a new
// tab, for 30 days. The same cookie is also set on accept as a belt-and-braces.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/lib/workspace/store';
import { claimWelcomeGift } from '@/lib/usage/welcome-actions';
import { WELCOME_DISMISSED_COOKIE } from '@/lib/usage/welcome-dismissal';
import { Confetti } from './confetti';

const CONFETTI_MS = 2400;
const DISMISS_MAX_AGE_S = 60 * 60 * 24 * 30;

function rememberDismissal(userId: string) {
  try {
    document.cookie =
      `${WELCOME_DISMISSED_COOKIE}=${encodeURIComponent(userId)}; Path=/; ` +
      `Max-Age=${DISMISS_MAX_AGE_S}; SameSite=Lax` +
      (window.location.protocol === 'https:' ? '; Secure' : '');
  } catch {
    /* cookie blocked: the in-memory `dismissed` state still covers this page */
  }
}

export function WelcomeGiftBanner({
  claimed,
  initiallyDismissed,
  userId,
  clipRunnable,
  monthlyTokens,
}: {
  claimed: boolean;
  /** Server-side read of the dismissal cookie for this user, so the banner is
   *  hidden from the first paint instead of flashing and then hiding. */
  initiallyDismissed: boolean;
  userId: string;
  /** ChalyClip can actually be opened today (engineIsRunnable). */
  clipRunnable: boolean;
  /** The Free monthly allocation, from TIER_CAPS — what the "gift" really is. */
  monthlyTokens: number;
}) {
  const [dismissed, setDismissed] = useState(initiallyDismissed);
  const [celebrating, setCelebrating] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useWorkspace((s) => s.showToast);

  if (claimed || dismissed) {
    return celebrating ? <Confetti durationMs={CONFETTI_MS} /> : null;
  }

  function dismiss() {
    rememberDismissal(userId);
    setDismissed(true);
  }

  function accept() {
    startTransition(async () => {
      const res = await claimWelcomeGift();
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error ?? 'no se pudo activar tu regalo'}`);
        return;
      }
      rememberDismissal(userId);
      setDismissed(true);
      setCelebrating(true);
      if (!res.trialStarted) {
        showToast(
          'Listo. Tu prueba de <b>ChalyClip Pro</b> queda reservada y arranca el día que ChalyClip esté listo.',
        );
      }
      window.setTimeout(() => {
        setCelebrating(false);
        router.refresh();
      }, CONFETTI_MS);
    });
  }

  const tokens = monthlyTokens.toLocaleString('es-MX');

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '20px 24px',
        marginBottom: 22,
        border: '1px solid var(--cc-green)',
        background:
          'linear-gradient(120deg, var(--cc-green-g), rgba(82,229,208,0.06) 60%, transparent)',
        borderRadius: 'var(--cc-r-l)',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 260 }}>
        <div
          style={{
            fontFamily: 'var(--cc-mono), monospace',
            fontSize: 10.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--cc-green)',
            marginBottom: 8,
          }}
        >
          🎁 Bienvenido a Chalyb
        </div>
        <div
          style={{
            fontFamily: 'var(--cc-disp), sans-serif',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            marginBottom: 6,
          }}
        >
          Tu kit viene con un regalo de bienvenida
        </div>
        <div style={{ fontSize: 13, color: 'var(--cc-txt-2)', lineHeight: 1.55, maxWidth: '62ch' }}>
          <b style={{ color: 'var(--cc-green)' }}>{tokens} tokens IA</b> incluidos cada mes en Free,
          para cualquier herramienta del kit.{' '}
          {clipRunnable ? (
            <>
              Además, <b style={{ color: 'var(--cc-cyan)' }}>ChalyClip Pro gratis 7 días</b>, en
              vivo y sin tarjeta. Acepta para activarlo.
            </>
          ) : (
            <>
              Además, <b style={{ color: 'var(--cc-cyan)' }}>7 días de ChalyClip Pro</b> que quedan
              reservados: arrancan el día que ChalyClip esté listo, no antes. Acepta para
              apartarlos.
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid var(--cc-line-2)',
            background: 'transparent',
            color: 'var(--cc-txt-3)',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: pending ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Ahora no
        </button>
        <button
          type="button"
          onClick={accept}
          disabled={pending}
          style={{
            padding: '12px 22px',
            borderRadius: 10,
            border: 'none',
            background: pending ? 'var(--cc-bg-3)' : 'var(--cc-green)',
            color: pending ? 'var(--cc-txt-3)' : '#070809',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 700,
            cursor: pending ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {pending ? 'Activando…' : clipRunnable ? 'Aceptar mi regalo →' : 'Apartar mi regalo →'}
        </button>
      </div>
    </div>
  );
}
