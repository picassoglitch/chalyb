'use client';

// "Pay on Mercado Pago's page": the button under both card forms. It asks a
// server function for the hosted checkout's URL (a pending preapproval's
// init_point for a plan, a Checkout Pro order for a pack) and sends the
// browser there. Same plan or pack, same server-decided price; it is the
// way to pay when the in-app card form cannot load in someone's browser,
// and the only place OXXO, SPEI and account money live.

import { useState, useTransition } from 'react';

interface Props {
  label: string;
  hint?: string;
  start: () => Promise<{ ok: boolean; url?: string; error?: string }>;
}

export function HostedCheckoutButton({ label, hint, start }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const res = await start();
      if (!res.ok || !res.url) {
        setError(res.error ?? 'No pudimos abrir el pago en Mercado Pago.');
        return;
      }
      window.location.href = res.url;
    });
  }

  return (
    <div>
      {hint && (
        <p style={{ fontSize: 12.5, color: 'var(--cc-txt-3)', marginBottom: 8, lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
      <button
        type="button"
        onClick={go}
        disabled={pending}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          borderRadius: 9,
          border: '1px solid var(--cc-line)',
          background: 'var(--cc-bg-2, transparent)',
          color: 'var(--cc-txt)',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? 'Abriendo Mercado Pago…' : label}
      </button>
      {error && <p style={{ fontSize: 11.5, color: 'var(--cc-red)', marginTop: 6 }}>▸ {error}</p>}
    </div>
  );
}
