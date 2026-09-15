'use client';

// The card form for a token pack, plus the "pay some other way" fallback.
// Cards are charged in place through payTokenPackWithCard. OXXO, SPEI and
// account money still exist for whoever wants them: that link opens the
// Mercado Pago-hosted checkout, which is the only place those methods live.

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import { useWorkspace } from '@/lib/workspace/store';
import {
  createTokenPackCheckout,
  payTokenPackWithCard,
} from '@/lib/payments/token-checkout-actions';
import { MpCardBrick } from '@/components/payments/mp-card-brick';

interface Props {
  packId: string;
  packLabel: string;
  publicKey: string;
  amountMajor: number;
  payerEmail: string | null;
}

export function PackCheckout({ packId, packLabel, publicKey, amountMajor, payerEmail }: Props) {
  const router = useRouter();
  const showToast = useWorkspace((s) => s.showToast);
  const [otherPending, startOther] = useTransition();
  const [otherError, setOtherError] = useState<string | null>(null);

  function payAnotherWay() {
    setOtherError(null);
    startOther(async () => {
      const res = await createTokenPackCheckout(packId);
      if (!res.ok || !res.url) {
        setOtherError(res.error ?? 'No pudimos abrir el pago en Mercado Pago.');
        return;
      }
      window.location.href = res.url;
    });
  }

  return (
    <div>
      <MpCardBrick
        publicKey={publicKey}
        amount={amountMajor}
        payerEmail={payerEmail}
        maxInstallments={12}
        submitLabel={`Pagar ${packLabel}`}
        onSubmit={async (card) => {
          const res = await payTokenPackWithCard({
            packId,
            token: card.token,
            paymentMethodId: card.paymentMethodId,
            issuerId: card.issuerId,
            installments: card.installments,
            paymentTypeId: card.paymentTypeId,
            identification: card.identification,
          });
          if (!res.ok) return { ok: false, error: res.error ?? 'No pudimos procesar el pago.' };
          if (res.status !== 'approved') {
            // pending / in_process: honest wait, no toast, no redirect.
            return {
              ok: true,
              outcome: 'pending',
              message: res.error ?? 'Mercado Pago dejó el pago en revisión.',
            };
          }
          showToast(`<b>${packLabel}</b> acreditado.`);
          setTimeout(() => {
            router.push('/app/usage');
            router.refresh();
          }, 1800);
          return { ok: true, outcome: 'approved' };
        }}
        success={
          <div
            style={{
              padding: '14px 18px',
              border: '1px solid var(--cc-green)',
              background: 'var(--cc-green-g)',
              borderRadius: 'var(--cc-r-l)',
              color: 'var(--cc-txt-2)',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            ● <b style={{ color: 'var(--cc-green)' }}>Pago aprobado</b> — tus tokens ya están en tu
            balance. Te llevamos a tu uso…
          </div>
        }
        pending={
          <div
            style={{
              padding: '14px 18px',
              border: '1px solid var(--cc-amber)',
              background: 'var(--cc-amber-g)',
              borderRadius: 'var(--cc-r-l)',
              color: 'var(--cc-txt-2)',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            ● <b style={{ color: 'var(--cc-amber)' }}>Pago en revisión</b> — Mercado Pago todavía no
            lo aprueba. No se ha activado nada; en cuanto lo confirme los tokens aparecen en
            /app/usage. Puedes cerrar esta página.
          </div>
        }
      />

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--cc-line)' }}>
        <button
          type="button"
          onClick={payAnotherWay}
          disabled={otherPending}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'var(--cc-txt-3)',
            fontFamily: 'inherit',
            fontSize: 12.5,
            cursor: otherPending ? 'wait' : 'pointer',
            textDecoration: 'underline',
          }}
        >
          {otherPending
            ? 'Abriendo Mercado Pago…'
            : '¿Prefieres OXXO, SPEI o saldo de Mercado Pago? Pagar en Mercado Pago →'}
        </button>
        {otherError && (
          <p style={{ fontSize: 11.5, color: 'var(--cc-red)', marginTop: 6 }}>▸ {otherError}</p>
        )}
      </div>
    </div>
  );
}
