'use client';

// Per-row "Mark paid" / "Cancel" actions for pending payouts in the
// /dashboard/royalties history table. Renders as a tiny pair of links
// to keep the row compact; clicking "Mark paid" opens an inline form to
// capture the payment reference + optional notes.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/lib/dashboard/store';
import { cancelPayout, markPayoutPaid } from '@/lib/usage/royalty-actions';

interface Props {
  payoutId: number;
}

export function RoyaltyPayoutActions({ payoutId }: Props) {
  const [mode, setMode] = useState<'idle' | 'paying' | 'cancelling'>('idle');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useDashboard((s) => s.showToast);

  function submitPaid() {
    if (!reference.trim()) {
      showToast('<b>Falta la referencia</b> · pega el id de la transferencia');
      return;
    }
    startTransition(async () => {
      const res = await markPayoutPaid({
        payoutId,
        paymentReference: reference,
        notes,
      });
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error ?? 'no se pudo completar'}`);
        return;
      }
      showToast('Pago marcado como hecho');
      setMode('idle');
      setReference('');
      setNotes('');
      router.refresh();
    });
  }

  function submitCancel() {
    startTransition(async () => {
      const res = await cancelPayout(payoutId, notes.trim() || 'cancelled');
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error ?? 'no se pudo completar'}`);
        return;
      }
      showToast('Pago cancelado');
      setMode('idle');
      setNotes('');
      router.refresh();
    });
  }

  if (mode === 'idle') {
    return (
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button
          type="button"
          onClick={() => setMode('paying')}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--cc-line-2)',
            background: 'var(--cc-green-g)',
            color: 'var(--cc-green)',
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ✓ Marcar pagado
        </button>
        <button
          type="button"
          onClick={() => setMode('cancelling')}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--cc-line-2)',
            background: 'transparent',
            color: 'var(--cc-txt-4)',
            fontFamily: 'inherit',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          ✕ Cancelar
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 10,
        background: 'var(--cc-bg-1)',
        border: '1px solid var(--cc-line-2)',
        borderRadius: 7,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 260,
      }}
    >
      {mode === 'paying' ? (
        <>
          <input
            type="text"
            placeholder="Referencia del pago (transferencia, id de MP, etc.)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setMode('idle');
                setReference('');
                setNotes('');
              }}
              style={btnGhost}
              disabled={pending}
            >
              Cancelar
            </button>
            <button type="button" onClick={submitPaid} disabled={pending} style={btnPrimary}>
              {pending ? 'Guardando…' : 'Confirmar pago'}
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="Motivo de la cancelación (opcional, pero ayuda)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setMode('idle');
                setNotes('');
              }}
              style={btnGhost}
              disabled={pending}
            >
              Volver
            </button>
            <button type="button" onClick={submitCancel} disabled={pending} style={btnPrimary}>
              {pending ? 'Cancelando…' : 'Sí, cancelar el pago'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '6px 9px',
  borderRadius: 6,
  border: '1px solid var(--cc-line-2)',
  background: 'var(--cc-bg-2)',
  color: 'var(--cc-txt)',
  fontFamily: 'inherit',
  fontSize: 11.5,
  outline: 'none',
};

const btnGhost: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid var(--cc-line-2)',
  background: 'transparent',
  color: 'var(--cc-txt-3)',
  fontFamily: 'inherit',
  fontSize: 11,
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  border: 'none',
  background: 'var(--cc-green)',
  color: '#070809',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};
