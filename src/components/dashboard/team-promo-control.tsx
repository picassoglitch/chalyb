'use client';

// Inline promotions control for /dashboard/team rows. Lets an admin grant,
// extend, or revoke the onboarding promos per user:
//   - ChalybClip 7-day live trial  (grant / reset to fresh 7d / end now)
//   - first-time welcome banner   (reset so it shows again)
//
// Same popover pattern as team-grant-tokens.tsx (absolute div, click-outside /
// Escape close, useDashboard toast, router.refresh on success). The trigger
// chip shows the live trial state at a glance.

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import {
  grantChalybclipTrial,
  revokeChalybclipTrial,
  resetWelcomeGift,
} from '@/lib/usage/promo-admin-actions';

interface Props {
  userId: string;
  userName: string;
  /** Whether the ChalybClip trial is currently active (computed server-side). */
  trialActive: boolean;
  /** Whole days left on the trial (0 when inactive). */
  trialDaysLeft: number;
  /** Whether the user has accepted the welcome banner. */
  welcomeClaimed: boolean;
}

export function TeamPromoControl({
  userId,
  userName,
  trialActive,
  trialDaysLeft,
  welcomeClaimed,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function run(
    fn: (userId: string, reason: string | null) => Promise<{ ok: boolean; error?: string }>,
    successMsg: string,
  ) {
    startTransition(async () => {
      const res = await fn(userId, reason.trim() || null);
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error ?? 'no se pudo'}`);
        return;
      }
      showToast(successMsg);
      setReason('');
      setOpen(false);
      router.refresh();
    });
  }

  const firstName = userName.split(' ')[0];

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Gestionar promociones (prueba ChalybClip · bienvenida)"
        style={{
          padding: '6px 10px',
          borderRadius: 7,
          border: '1px solid var(--cc-line-2)',
          background: trialActive ? 'var(--cc-cyan-g)' : 'var(--cc-bg-2)',
          color: trialActive ? 'var(--cc-cyan)' : 'var(--cc-txt-3)',
          fontFamily: 'var(--cc-mono), monospace',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.04em',
        }}
      >
        {trialActive ? `prueba ${trialDaysLeft}d` : '🎁 promos'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 50,
            width: 280,
            padding: 14,
            background: 'var(--cc-panel-2)',
            border: '1px solid var(--cc-line-2)',
            borderRadius: 9,
            boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--cc-mono), monospace',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--cc-txt-4)',
              textTransform: 'uppercase',
            }}
          >
            Promociones · {firstName}
          </div>

          {/* ChalybClip trial */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--cc-txt-2)' }}>
              Prueba ChalybClip ·{' '}
              {trialActive ? (
                <b style={{ color: 'var(--cc-cyan)' }}>{trialDaysLeft}d restantes</b>
              ) : (
                <span style={{ color: 'var(--cc-txt-4)' }}>inactiva</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() =>
                  run(
                    grantChalybclipTrial,
                    `Prueba ChalybClip activada (7d) para <b>${firstName}</b>.`,
                  )
                }
                disabled={pending}
                style={btnStyle('var(--cc-green)', '#070809', pending)}
              >
                {trialActive ? 'Reiniciar 7d' : 'Iniciar 7d'}
              </button>
              {trialActive && (
                <button
                  type="button"
                  onClick={() =>
                    run(
                      revokeChalybclipTrial,
                      `Prueba ChalybClip terminada para <b>${firstName}</b>.`,
                    )
                  }
                  disabled={pending}
                  style={btnStyle('var(--cc-bg-3)', 'var(--cc-txt-2)', pending)}
                >
                  Terminar
                </button>
              )}
            </div>
          </div>

          {/* Welcome banner */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderTop: '1px solid var(--cc-line-soft)',
              paddingTop: 10,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--cc-txt-2)' }}>
              Bienvenida ·{' '}
              {welcomeClaimed ? (
                <b style={{ color: 'var(--cc-green)' }}>aceptada</b>
              ) : (
                <span style={{ color: 'var(--cc-txt-4)' }}>pendiente</span>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                run(resetWelcomeGift, `Banner de bienvenida reiniciado para <b>${firstName}</b>.`)
              }
              disabled={pending || !welcomeClaimed}
              style={btnStyle('var(--cc-bg-3)', 'var(--cc-txt-2)', pending || !welcomeClaimed)}
            >
              Reiniciar banner
            </button>
          </div>

          <input
            type="text"
            placeholder="Razón (opcional, va al audit log)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 7,
              border: '1px solid var(--cc-line-2)',
              background: 'var(--cc-bg-1)',
              color: 'var(--cc-txt)',
              fontFamily: 'inherit',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string, color: string, disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '7px 10px',
    borderRadius: 7,
    border: 'none',
    background: disabled ? 'var(--cc-bg-3)' : bg,
    color: disabled ? 'var(--cc-txt-4)' : color,
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
  };
}
