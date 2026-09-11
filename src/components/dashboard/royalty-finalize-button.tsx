'use client';

// "Finalize period" button at the top of /dashboard/royalties.
// Snapshots current period accruals as engine_royalty_payouts rows.
// Idempotent on (engine_id, period_start), so re-clicks just add any newly
// accruing engines without double-paying old ones.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import { finalizeCurrentPeriod } from '@/lib/usage/royalty-actions';

interface Props {
  /** How many engines have accruable balance — drives whether we show the
   *  big "Finalizar X payouts" CTA or a muted disabled state. */
  accruableCount: number;
}

export function RoyaltyFinalizeButton({ accruableCount }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function finalize() {
    startTransition(async () => {
      const res = await finalizeCurrentPeriod();
      if (!res.ok) {
        showToast(`<b>No se pudo finalizar</b> · ${res.error ?? 'sin detalle'}`);
        return;
      }
      const r = res.finalized!;
      showToast(
        `Listo · ${r.created} payouts creados · total $${(r.totalAmountCents / 100).toLocaleString('es-MX')} MXN`,
      );
      setConfirming(false);
      router.refresh();
    });
  }

  const disabled = accruableCount === 0;

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled}
        style={{
          padding: '9px 16px',
          borderRadius: 8,
          border: 'none',
          background: disabled ? 'var(--cc-bg-3)' : 'var(--cc-green)',
          color: disabled ? 'var(--cc-txt-4)' : '#070809',
          fontFamily: 'inherit',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {disabled
          ? 'Nada por finalizar'
          : `Finalizar ${accruableCount} payout${accruableCount === 1 ? '' : 's'}`}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--cc-txt-3)' }}>
        ¿Cierras el período y dejas estos payouts como pendientes?
      </span>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        style={{
          padding: '8px 12px',
          borderRadius: 7,
          border: '1px solid var(--cc-line-2)',
          background: 'transparent',
          color: 'var(--cc-txt-3)',
          fontFamily: 'inherit',
          fontSize: 12,
          cursor: pending ? 'default' : 'pointer',
        }}
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={finalize}
        disabled={pending}
        style={{
          padding: '8px 14px',
          borderRadius: 7,
          border: 'none',
          background: pending ? 'var(--cc-bg-3)' : 'var(--cc-green)',
          color: pending ? 'var(--cc-txt-4)' : '#070809',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          cursor: pending ? 'default' : 'pointer',
        }}
      >
        {pending ? 'Guardando…' : 'Sí, finalizar'}
      </button>
    </div>
  );
}
