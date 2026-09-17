'use client';

// The card form for a monthly plan. Renders the Brick, sends the token to
// authorizeTierSubscription, and shows the result. Price and tier are
// server-decided (props from the page); the browser cannot change them.

import { useRouter } from '@/i18n/routing';
import { useWorkspace } from '@/lib/workspace/store';
import { authorizeTierSubscription } from '@/lib/payments/subscription-actions';
import { MpCardBrick } from '@/components/payments/mp-card-brick';
import type { SubscriptionTier } from '@/lib/auth/session';

interface Props {
  tier: SubscriptionTier;
  tierLabel: string;
  publicKey: string;
  amountMajor: number;
  payerEmail: string | null;
}

export function SubscriptionCheckout({
  tier,
  tierLabel,
  publicKey,
  amountMajor,
  payerEmail,
}: Props) {
  const router = useRouter();
  const showToast = useWorkspace((s) => s.showToast);

  return (
    <div data-mp-subscriptions-page="without-plan-authorized">
      <MpCardBrick
        publicKey={publicKey}
        amount={amountMajor}
        payerEmail={payerEmail}
        maxInstallments={1}
        submitLabel={`Activar ${tierLabel} · cobro mensual`}
        onSubmit={async (card) => {
          const res = await authorizeTierSubscription({ tier, cardTokenId: card.token });
          if (!res.ok) {
            return { ok: false, error: res.error ?? 'No pudimos activar la suscripción.' };
          }
          if (res.status !== 'authorized') {
            // Mercado Pago left the preapproval pending: no plan yet.
            return {
              ok: true,
              outcome: 'pending',
              message: res.error ?? 'Mercado Pago dejó la suscripción pendiente de confirmación.',
            };
          }
          showToast(`Plan <b>${tierLabel}</b> activado.`);
          // Let the success state show, then land on the subscription page
          // with the fresh tier (router.refresh re-runs the server render).
          setTimeout(() => {
            router.push('/app/subscription');
            router.refresh();
          }, 1800);
          return { ok: true, outcome: 'approved', message: res.error };
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
            ● <b style={{ color: 'var(--cc-green)' }}>Plan {tierLabel} activo</b> — Mercado Pago
            autorizó el cobro mensual. Te llevamos a tu suscripción…
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
            lo aprueba. No se ha activado nada; en cuanto lo confirme se activa tu plan. Puedes
            cerrar esta página.
          </div>
        }
      />
    </div>
  );
}
