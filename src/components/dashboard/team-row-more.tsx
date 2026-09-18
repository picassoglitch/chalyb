'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The "Más" menu on a Personas row.
 *
 * A row used to carry six controls side by side — plan, owner engine, token
 * grant, promotions, re-link, role — so the thing an operator opens Personas
 * to see (who is this, what can they do, what are they paying) competed for
 * space with four maintenance tools, and the row wrapped onto three lines on
 * a laptop. Identity, plan and role stay on the row. Everything that acts ON
 * a person lives in here, one click away.
 *
 * Dangerous actions confirm inside their own control (re-link and the token
 * grant both do); this component only decides what is visible by default.
 */
export function TeamRowMore({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape, like the other row popovers.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const firstName = userName.split(' ')[0];

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={`Acciones sobre ${firstName}: tokens, promociones, re-vinculación`}
        style={{
          padding: '6px 10px',
          borderRadius: 7,
          border: '1px solid var(--cc-line-2)',
          background: open ? 'var(--cc-hover)' : 'var(--cc-bg-2)',
          color: 'var(--cc-txt-3)',
          fontFamily: 'var(--cc-mono), monospace',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.04em',
        }}
      >
        Más {open ? '▴' : '▾'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 60,
            minWidth: 260,
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
            Acciones · {firstName}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
