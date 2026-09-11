'use client';

// First-time welcome banner shown at the top of /app while the user hasn't
// accepted yet (server passes `claimed`). On accept:
//   1. call claimWelcomeGift() (marks claimed + starts the ChalybClip trial)
//   2. hide the banner + fire confetti
//   3. after the confetti settles, router.refresh() so the stat cards (Tokens
//      IA balance, Engines en vivo count, engine cards) re-render with the
//      trial live — refreshing AFTER the animation instead of unmounting it
//      mid-flight.
//
// The component owns its own visibility so a refresh that flips `claimed` to
// true doesn't yank the confetti out from under itself.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/lib/workspace/store';
import { claimWelcomeGift } from '@/lib/usage/welcome-actions';
import { Confetti } from './confetti';

const CONFETTI_MS = 2400;

export function WelcomeGiftBanner({ claimed }: { claimed: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useWorkspace((s) => s.showToast);

  // Already accepted (server state) or accepted this session → render only the
  // confetti overlay if we're mid-celebration, nothing otherwise.
  if (claimed || dismissed) {
    return celebrating ? <Confetti durationMs={CONFETTI_MS} /> : null;
  }

  function accept() {
    startTransition(async () => {
      const res = await claimWelcomeGift();
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error ?? 'no se pudo activar tu regalo'}`);
        return;
      }
      setDismissed(true);
      setCelebrating(true);
      // Let the confetti play, then refresh server state (trial now live).
      window.setTimeout(() => {
        setCelebrating(false);
        router.refresh();
      }, CONFETTI_MS);
    });
  }

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
          Tu regalo de bienvenida está listo
        </div>
        <div style={{ fontSize: 13, color: 'var(--cc-txt-2)', lineHeight: 1.55, maxWidth: '60ch' }}>
          <b style={{ color: 'var(--cc-green)' }}>50,000 tokens IA</b> para usar en cualquier
          engine este mes, más{' '}
          <b style={{ color: 'var(--cc-cyan)' }}>ChalybClip Pro gratis por 7 días</b> — corriendo en
          vivo, sin tarjeta. Acepta para activarlo.
        </div>
      </div>
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
        {pending ? 'Activando…' : 'Aceptar mi regalo →'}
      </button>
    </div>
  );
}
