'use client';

// Post-trial grace banner. Shown on /app once a FREE user's 7-day ChalybClip
// trial has run out BUT they still have tokens left — we keep ChalybClip live
// until those tokens are gone ("sabemos que tu tiempo se acabó, pero nos caes
// bien"). The live gate itself lives in engineIsLiveForUser via
// isChalybclipGraceActive; this component is purely the heads-up.
//
// Dismiss is local/session-only on purpose: there's no "claimed" state to
// persist — while the grace window holds (tokens > 0) the banner is allowed to
// reappear on a fresh load. Once tokens hit 0 the server stops rendering it.

import { useState } from 'react';
import { Link } from '@/i18n/routing';
import type { Route } from 'next';

export function ChalybclipGraceBanner({ tokensRemaining }: { tokensRemaining: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '20px 24px',
        marginBottom: 22,
        border: '1px solid var(--cc-cyan)',
        background:
          'linear-gradient(120deg, rgba(82,229,208,0.10), rgba(82,229,208,0.04) 60%, transparent)',
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
            color: 'var(--cc-cyan)',
            marginBottom: 8,
          }}
        >
          ⏳ Tu prueba de ChalybClip terminó
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
          Sabemos que tu tiempo se acabó… pero nos caes bien
        </div>
        <div
          style={{ fontSize: 13, color: 'var(--cc-txt-2)', lineHeight: 1.55, maxWidth: '60ch' }}
        >
          Sigue usando <b style={{ color: 'var(--cc-cyan)' }}>ChalybClip</b> en vivo hasta que se te
          acaben los tokens — te quedan{' '}
          <b style={{ color: 'var(--cc-cyan)' }}>{tokensRemaining.toLocaleString('es-MX')}</b>. ¿Lo
          quieres para siempre, sin que se acabe? Pasa a Pro.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <Link
          href={'/app/subscription' as Route}
          style={{
            padding: '12px 22px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--cc-cyan)',
            color: '#070809',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Ver planes →
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--cc-txt-3)',
            fontSize: 16,
            cursor: 'pointer',
            padding: '4px 6px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
