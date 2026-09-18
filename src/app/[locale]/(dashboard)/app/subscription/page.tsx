import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  SubscriptionActions,
  type ActiveSubscription,
} from '@/components/workspace/subscription-actions';
import { normalizePreapprovalStatus } from '@/lib/payments/subscription-reference';
import { syncSubscription } from '@/lib/payments/subscription-sync';
import { TIER_CAPS, buildQuotaRows, effectiveTier, isAdminRole } from '@/lib/billing/tiers';
import { checkoutNotReadyError, missingCheckoutVars } from '@/lib/payments/mercadopago';

export const metadata = { title: 'Suscripción' };

export default async function SubscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status: returnStatus } = await searchParams;

  const session = await getSessionUser();
  if (!session) redirect('/sign-in?next=/app/subscription');
  // For admins, quotas + capabilities follow the EFFECTIVE tier (VIP).
  // The stored tier is still shown in the "Plan card" so the billing row is
  // honest — admins are simply not gated by it.
  const storedTier = session.tier;
  const role = session.role;
  const isAdmin = isAdminRole(role);
  const tier = effectiveTier(role, storedTier);
  const caps = TIER_CAPS[tier];
  const storedCaps = TIER_CAPS[storedTier];
  const quotaRows = buildQuotaRows(tier);
  // Decided here, on the server, so the client can fail soft before calling
  // the checkout action at all. Only names are sent down, never values.
  const missingPaymentVars = missingCheckoutVars();
  const paymentsNotReadyMessage = missingPaymentVars.length ? checkoutNotReadyError() : null;

  // The Mercado Pago subscription behind a paid tier, if there is one. Read
  // through the user's own client (RLS: select self). Null for FREE, for an
  // admin grant, and for the legacy one-off purchases — those have no
  // renewal date because nothing renews them.
  const supabase = await createClient();

  // Back from the Mercado Pago-hosted authorisation (?status=success on the
  // preapproval's back_url): refresh the pending preapproval now instead of
  // waiting for the webhook, so the plan shows active on this very render.
  if (returnStatus) {
    const { data: pendingRow } = await supabase
      .from('subscriptions')
      .select('mp_preapproval_id')
      .eq('user_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingRow?.mp_preapproval_id) {
      try {
        await syncSubscription(pendingRow.mp_preapproval_id as string);
      } catch (err) {
        // The webhook finishes the job; the page just shows "pending" meanwhile.
        console.error('[mp/subscription] sync on return failed', err);
      }
    }
  }

  const { data: subRow } = await supabase
    .from('subscriptions')
    .select('status, next_payment_date, tier')
    .eq('user_id', session.user.id)
    .in('status', ['pending', 'authorized', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const subscription: ActiveSubscription | null =
    subRow && storedTier !== 'FREE'
      ? {
          status: normalizePreapprovalStatus(subRow.status as string),
          nextPaymentDate: (subRow.next_payment_date as string | null) ?? null,
        }
      : null;
  const renewsOn =
    subscription?.status === 'authorized' && subscription.nextPaymentDate && !session.tierEndsAt
      ? new Date(subscription.nextPaymentDate).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          timeZone: 'America/Mexico_City',
        })
      : null;
  const endsOn = session.tierEndsAt
    ? new Date(session.tierEndsAt).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        timeZone: 'America/Mexico_City',
      })
    : null;

  return (
    <div className="cc-scroll">
      {isAdmin && (
        <div
          style={{
            padding: '12px 16px',
            border: '1px solid var(--cc-purple)',
            background: 'var(--cc-purple-g)',
            borderRadius: 'var(--cc-r-l)',
            marginBottom: 18,
            fontSize: 12.5,
            color: 'var(--cc-txt-2)',
            lineHeight: 1.55,
          }}
        >
          ● <b style={{ color: 'var(--cc-purple)' }}>Modo {role.replace('_', ' ')}</b> — tu rol
          manda sobre el plan guardado. Tienes acceso completo a todos los sistemas, sin importar el
          plan que veas abajo. La columna <code>profiles.tier</code> sigue ahí para que pruebes lo
          que ven los suscriptores; cambiarla no te quita acceso.
        </div>
      )}

      <div className="cc-mod-section">
        <div className="cc-mod-statgrid">
          <div className="cc-mod-stat">
            <div className="cc-mod-stat-l">{isAdmin ? 'Plan almacenado' : 'Plan actual'}</div>
            <div className="cc-mod-stat-v gr">{storedCaps.label}</div>
            <div className="cc-mod-stat-sub">
              {storedTier === 'FREE'
                ? 'Sin cargo · sin tarjeta'
                : `${storedCaps.price} / ${storedCaps.per}`}
            </div>
          </div>
          {isAdmin ? (
            <div className="cc-mod-stat">
              <div className="cc-mod-stat-l">Acceso efectivo</div>
              <div className="cc-mod-stat-v pu">VIP</div>
              <div className="cc-mod-stat-sub">gracias a tu rol {role.replace('_', ' ')}</div>
            </div>
          ) : (
            <div className="cc-mod-stat">
              <div className="cc-mod-stat-l">{endsOn ? 'Termina' : 'Renovación'}</div>
              <div className={`cc-mod-stat-v ${endsOn ? 'am' : ''}`}>
                {storedTier === 'FREE' ? '—' : (endsOn ?? renewsOn ?? '—')}
              </div>
              <div className="cc-mod-stat-sub">
                {storedTier === 'FREE'
                  ? 'Free nunca vence'
                  : endsOn
                    ? 'cancelado · después pasas a Free'
                    : renewsOn
                      ? 'se cobra solo cada mes'
                      : subscription?.status === 'paused'
                        ? 'cobro fallido · revisa tu tarjeta en Mercado Pago'
                        : subscription?.status === 'pending'
                          ? 'esperando que autorices el cobro'
                          : 'sin renovación automática'}
              </div>
            </div>
          )}
          <div className="cc-mod-stat">
            <div className="cc-mod-stat-l">Método de pago</div>
            <div className="cc-mod-stat-v">
              {storedTier === 'FREE'
                ? '—'
                : subscription
                  ? 'Mercado Pago'
                  : isAdmin
                    ? '—'
                    : 'Pago único'}
            </div>
            <div className="cc-mod-stat-sub">
              {storedTier === 'FREE'
                ? isAdmin
                  ? 'Como admin no pagas'
                  : 'En Free no necesitas tarjeta'
                : subscription
                  ? 'suscripción mensual con tarjeta'
                  : isAdmin
                    ? 'plan asignado, sin cobro'
                    : 'sin suscripción activa'}
            </div>
          </div>
          <div className="cc-mod-stat">
            <div className="cc-mod-stat-l">Engines en vivo</div>
            <div className="cc-mod-stat-v gr">
              {caps.liveEnginesCount === Infinity ? '∞' : caps.liveEnginesCount}
            </div>
            <div className="cc-mod-stat-sub">
              {tier === 'FREE'
                ? 'solo en modo prueba'
                : tier === 'PRO'
                  ? 'tú eliges cuáles'
                  : 'todos los engines'}
            </div>
          </div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Cambia tu plan</div>
        <SubscriptionActions
          initialTier={tier}
          userId={session.user.id}
          isAdmin={isAdmin}
          subscription={subscription}
          initialEndsAt={session.tierEndsAt}
          missingPaymentVars={missingPaymentVars}
          paymentsNotReadyMessage={paymentsNotReadyMessage}
        />
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Uso este período · {caps.label}</div>
        <div className="cc-mod-list">
          {quotaRows.map((row) => {
            const pct = row.cap > 0 ? Math.min(100, (row.used / row.cap) * 100) : 0;
            const fill = pct > 85 ? 'r' : pct > 60 ? 'am' : 'gr';
            return (
              <div key={row.label} className="cc-mod-row">
                <div className="cc-mod-body">
                  <div className="cc-mod-name">{row.label}</div>
                  <div
                    className="cc-mod-sub"
                    style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}
                  >
                    <span>
                      {row.used.toLocaleString()} / {row.cap.toLocaleString()} {row.unit}
                    </span>
                    <span className="cc-bar-track" style={{ maxWidth: 220 }}>
                      <span className={`cc-bar-fill ${fill}`} style={{ width: `${pct}%` }} />
                    </span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p
          style={{
            fontSize: 11.5,
            color: 'var(--cc-txt-4)',
            fontFamily: 'var(--cc-mono), monospace',
            marginTop: 10,
            paddingLeft: 4,
          }}
        >
          ▸ Los contadores reales se conectan al motor de telemetry en el paso 05.
        </p>
      </div>
    </div>
  );
}
