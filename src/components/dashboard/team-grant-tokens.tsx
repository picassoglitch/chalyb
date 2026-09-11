'use client';

// Inline token-grant control for /dashboard/team rows.
//
// UX: shows current bonus balance as a chip ("+2.5k bonus"). Clicking opens
// a small inline popover with:
//   - delta input (number, can be negative to revoke)
//   - quick-amount buttons: +100k, +500k, +2M (the same packs we sell)
//   - optional reason textbox (goes into audit metadata)
//   - apply button
//
// The popover is just absolute-positioned divs — no headlessui dep, no
// portal. Click outside / Escape closes it. The amount field accepts
// shorthand like "500k" or "1m" so the admin doesn't type six zeros.

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import { grantTokensToUser } from '@/lib/usage/token-grant-actions';

interface Props {
  userId: string;
  /** Display name for the toast. */
  userName: string;
  /** Current bonus balance — shown on the trigger chip. */
  bonusBalance: number;
}

const QUICK_AMOUNTS: Array<{ label: string; value: number }> = [
  { label: '+100k', value: 100_000 },
  { label: '+500k', value: 500_000 },
  { label: '+2M', value: 2_000_000 },
];

/** Parse user input like "500k", "1.5m", "2,000" → integer tokens.
 *  Returns NaN for non-parseable input. */
function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[\s,_]/g, '').toLowerCase();
  if (!cleaned) return NaN;
  // Match optional sign, digits/decimal, optional k/m/b suffix.
  const m = /^(-?\d+(?:\.\d+)?)([kmb])?$/.exec(cleaned);
  if (!m) return NaN;
  const base = parseFloat(m[1]!);
  const suffix = m[2];
  const factor = suffix === 'b' ? 1e9 : suffix === 'm' ? 1e6 : suffix === 'k' ? 1e3 : 1;
  const n = base * factor;
  if (!Number.isFinite(n)) return NaN;
  return Math.trunc(n);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}

export function TeamGrantTokens({ userId, userName, bonusBalance }: Props) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-outside / Escape to close. Wrapping the whole thing in a ref means
  // we can detect "click landed outside this subtree" without a portal.
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

  function apply(deltaOverride?: number) {
    const parsed = deltaOverride ?? parseAmount(raw);
    if (!Number.isFinite(parsed) || parsed === 0) {
      showToast('<b>Error</b> · cantidad no válida (escribe 100k, 1.5M, etc.)');
      return;
    }
    startTransition(async () => {
      const res = await grantTokensToUser(userId, parsed, reason.trim() || null);
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error ?? 'no se pudo aplicar'}`);
        return;
      }
      const verb = parsed > 0 ? 'Otorgaste' : 'Revocaste';
      showToast(
        `${verb} <b>${formatTokens(Math.abs(parsed))}</b> tokens a <b>${userName}</b>. Nuevo balance: ${formatTokens(res.newBalance ?? 0)}.`,
      );
      setRaw('');
      setReason('');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Dar o quitar tokens bonus"
        style={{
          padding: '6px 10px',
          borderRadius: 7,
          border: '1px solid var(--cc-line-2)',
          background: bonusBalance > 0 ? 'var(--cc-cyan-g)' : 'var(--cc-bg-2)',
          color: bonusBalance > 0 ? 'var(--cc-cyan)' : 'var(--cc-txt-3)',
          fontFamily: 'var(--cc-mono), monospace',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.04em',
        }}
      >
        {bonusBalance > 0 ? `+${formatTokens(bonusBalance)}` : '+ tokens'}
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
            gap: 10,
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
            Tokens bonus · {userName.split(' ')[0]}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 6,
            }}
          >
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => apply(q.value)}
                disabled={pending}
                style={{
                  flex: 1,
                  padding: '7px 6px',
                  borderRadius: 7,
                  border: '1px solid var(--cc-line-2)',
                  background: 'var(--cc-bg-3)',
                  color: 'var(--cc-txt)',
                  fontFamily: 'var(--cc-mono), monospace',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: pending ? 'default' : 'pointer',
                  opacity: pending ? 0.5 : 1,
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Cantidad: 250k, -1M, 500000…"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 7,
              border: '1px solid var(--cc-line-2)',
              background: 'var(--cc-bg-1)',
              color: 'var(--cc-txt)',
              fontFamily: 'var(--cc-mono), monospace',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Motivo (opcional, queda en el registro)"
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: '7px 14px',
                borderRadius: 7,
                border: '1px solid var(--cc-line-2)',
                background: 'transparent',
                color: 'var(--cc-txt-3)',
                fontFamily: 'inherit',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => apply()}
              disabled={pending || !raw.trim()}
              style={{
                padding: '7px 14px',
                borderRadius: 7,
                border: 'none',
                background: pending || !raw.trim() ? 'var(--cc-bg-3)' : 'var(--cc-green)',
                color: pending || !raw.trim() ? 'var(--cc-txt-4)' : '#070809',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                cursor: pending || !raw.trim() ? 'default' : 'pointer',
              }}
            >
              {pending ? 'Aplicando…' : 'Aplicar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
