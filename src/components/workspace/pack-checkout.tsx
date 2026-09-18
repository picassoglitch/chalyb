'use client';

// The card form for a token pack, plus the "pay some other way" fallback.
// Cards are charged in place through payTokenPackWithCard. OXXO, SPEI and
// account money still exist for whoever wants them: that link opens the
// Mercado Pago-hosted checkout, which is the only place those methods live.

import { useRouter } from '@/i18n/routing';
import { useWorkspace } from '@/lib/workspace/store';
import {
  createTokenPackCheckout,
  payTokenPackWithCard,
} from '@/lib/payments/token-checkout-actions';
import { MpCardBrick } from '@/components/payments/mp-card-brick';
import { HostedCheckoutButton } from '@/components/payments/hosted-checkout-button';

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
        fallback={
          <HostedCheckoutButton
            hint="¿Prefieres OXXO, SPEI o saldo de Mercado Pago? Esos viven en la página de Mercado Pago."
            label={`Pagar ${packLabel} en Mercado Pago →`}
            start={() => createTokenPackCheckout(packId)}
          />
        }
      />
    </div>
  );
}
