import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  SubscriptionActions,
  type ActiveSubscription,
} from '@/components/workspace/subscription-actions';
import { normalizePreapprovalStatus } from '@/lib/payments/subscription-reference';
import {
  TIER_CAPS,
  effectiveTier,
  isAdminRole,
  isChalybclipTrialActive,
  isChalybclipGraceActive,
} from '@/lib/billing/tiers';
import { checkoutNotReadyError, missingCheckoutVars } from '@/lib/payments/mercadopago';
import { listEngines } from '@/lib/data/engines';
import { getTokenBalance } from '@/lib/usage/tokens';
import { deriveEngineViews, liveCapacityLabel, summarizeFleet } from '@/lib/billing/readiness';
import { entitlementSource, getEntitlementEvidence } from '@/lib/billing/entitlement';

export const metadata = { title: 'Suscripción' };

// /app/subscription — sells the kit unlock first (Free explores in
// simulation · Pro puts ONE tool of your choice live · VIP opens the whole
// kit), then shows the plan's real billing state. Tokens are a detail of the
// plan, not the headline.

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSessionUser();
  if (!session) redirect('/sign-in?next=/app/subscription');
  const storedTier = session.tier;
  const role = session.role;
  const isAdmin = isAdminRole(role);
  const tier = effectiveTier(role, storedTier);
  const caps = TIER_CAPS[tier];
  const storedCaps = TIER_CAPS[storedTier];
  const missingPaymentVars = missingCheckoutVars();
  const paymentsNotReadyMessage = missingPaymentVars.length ? checkoutNotReadyError() : null;

  const supabase = await createClient();
  const [{ data: subRow }, evidence, engines, balance] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('status, next_payment_date, tier')
      .eq('user_id', session.user.id)
      .in('status', ['pending', 'authorized', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getEntitlementEvidence(session.user.id),
    listEngines().catch(() => []),
    getTokenBalance(session.user.id).catch(() => null),
  ]);
  const source = entitlementSource({ storedTier, role, evidence });
  const isComped = source === 'comped';
  const isPartner = source === 'partner';

  const subscription: ActiveSubscription | null =
    subRow && storedTier !== 'FREE'
      ? {
          status: normalizePreapprovalStatus(subRow.status as string),
          nextPaymentDate: (subRow.next_payment_date as string | null) ?? null,
        }
      : null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Mexico_City',
    });
  const renewsOn =
    subscription?.status === 'authorized' && subscription.nextPaymentDate && !session.tierEndsAt
      ? fmt(subscription.nextPaymentDate)
      : null;
  const endsOn = session.tierEndsAt ? fmt(session.tierEndsAt) : null;

  // The fleet, through the same readiness model as Inicio / Mis engines, so
  // "herramientas en vivo" here is the same number as there.
  const nowMs = new Date().getTime();
  const trialActive = isChalybclipTrialActive(session.chalybclipTrialStartedAt, nowMs);
  const graceActive =
    tier === 'FREE' &&
    isChalybclipGraceActive(
      session.chalybclipTrialStartedAt,
      nowMs,
      balance && !balance.unlimited ? balance.bonus : 0,
    );
  const fleet = summarizeFleet(
    deriveEngineViews(engines, {
      tier,
      userId: session.user.id,
      selectedEngineId: session.selectedEngineId,
      trialActive,
      graceActive,
    }),
  );

  const tokensAvailable = balance
    ? balance.unlimited
      ? null
      : balance.monthlyAllocation + balance.bonus
    : caps.tokensPerMonth;
  const tokensUsed = balance?.monthlyUsed ?? 0;
  const tokensPct =
    tokensAvailable && tokensAvailable > 0
      ? Math.min(100, Math.round((tokensUsed / tokensAvailable) * 100))
      : 0;

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
          manda sobre el plan guardado. Tienes acceso a todo el kit sin importar el plan que veas
          abajo. La columna <code>profiles.tier</code> sigue ahí para que pruebes lo que ven los
          suscriptores; cambiarla no te quita acceso.
        </div>
      )}

      {/* ── The kit story, first ─────────────────────────────────────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Un plan, todo el kit</div>
        <div
          className="cc-mod-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          {[
            {
              name: 'Free',
              line: 'Explora el kit en simulación',
              sub: 'Sin tarjeta. Conoce cada herramienta con datos de prueba.',
              on: tier === 'FREE',
            },
            {
              name: 'Pro',
              line: 'Una herramienta en vivo, la que tú elijas',
              sub: 'Cámbiala cuando quieras. Las demás siguen en simulación.',
              on: tier === 'PRO' || tier === 'PARTNER',
            },
            {
              name: 'VIP',
              line: 'Todo el kit en vivo',
              sub: 'Cada herramienta que se publique corre con tu plan.',
              on: tier === 'VIP',
            },
          ].map((k) => (
            <div
              key={k.name}
              className="cc-mod-card"
              style={{
                borderColor: k.on ? 'var(--cc-green)' : undefined,
                background: k.on ? 'rgba(158,234,58,.04)' : undefined,
              }}
            >
              <div className="cc-mod-card-head">
                <span className="cc-mod-tag" style={{ color: 'var(--cc-txt)', fontSize: 12 }}>
                  {k.name}
                </span>
                {k.on && <span className="cc-mod-badge gr">Tu plan</span>}
              </div>
              <h4 style={{ fontSize: 14.5 }}>{k.line}</h4>
              <p>{k.sub}</p>
            </div>
          ))}
        </div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--cc-txt-3)',
            marginTop: 10,
            paddingLeft: 4,
            lineHeight: 1.5,
            maxWidth: '72ch',
          }}
        >
          Hoy el kit tiene <b style={{ color: 'var(--cc-txt-2)' }}>{fleet.runnable}</b> herramienta
          {fleet.runnable === 1 ? '' : 's'} lista{fleet.runnable === 1 ? '' : 's'} y{' '}
          <b style={{ color: 'var(--cc-txt-2)' }}>{fleet.upcoming}</b> en construcción. Tu plan
          aplica a todas en cuanto se publican; nada se cobra aparte por herramienta.
        </p>
      </div>

      {/* ── Your plan, honestly ──────────────────────────────────────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Tu plan</div>
        <div className="cc-mod-statgrid">
          <div className="cc-mod-stat">
            <div className="cc-mod-stat-l">{isAdmin ? 'Plan almacenado' : 'Plan actual'}</div>
            <div className={`cc-mod-stat-v ${isComped ? 'am' : 'gr'}`}>
              {storedCaps.label}
              {isComped && <small>cortesía</small>}
              {isPartner && <small>programa</small>}
            </div>
            <div className="cc-mod-stat-sub">
              {storedTier === 'FREE'
                ? 'Sin cargo · sin tarjeta'
                : isComped
                  ? 'asignado por el equipo · sin cobro'
                  : isPartner
                    ? 'programa Partner · sin cobro'
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
                {storedTier === 'FREE' || isComped || isPartner ? '—' : (endsOn ?? renewsOn ?? '—')}
              </div>
              <div className="cc-mod-stat-sub">
                {storedTier === 'FREE'
                  ? 'Free nunca vence'
                  : isComped || isPartner
                    ? 'no se renueva ni se cobra'
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
              {storedTier === 'FREE' || isComped || isPartner || isAdmin
                ? '—'
                : subscription
                  ? 'Mercado Pago'
                  : evidence.approvedPayments > 0
                    ? 'Pago único'
                    : '—'}
            </div>
            <div className="cc-mod-stat-sub">
              {storedTier === 'FREE'
                ? isAdmin
                  ? 'Como admin no pagas'
                  : 'En Free no necesitas tarjeta'
                : isAdmin || isComped
                  ? 'plan asignado, sin cobro'
                  : isPartner
                    ? 'relación de partner, sin cobro'
                    : subscription
                      ? 'suscripción mensual con tarjeta'
                      : evidence.approvedPayments > 0
                        ? 'sin suscripción activa'
                        : 'sin pagos registrados'}
            </div>
          </div>

          <div className="cc-mod-stat">
            <div className="cc-mod-stat-l">Herramientas en vivo</div>
            <div className={`cc-mod-stat-v ${fleet.live > 0 ? 'gr' : ''}`}>{fleet.live}</div>
            <div className="cc-mod-stat-sub">{liveCapacityLabel(tier, fleet)}</div>
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

      {/* ── Real usage (tokens are measured; nothing invented) ───────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Uso este período · {caps.label}</div>
        <div className="cc-mod-list">
          <div className="cc-mod-row">
            <div className="cc-mod-body">
              <div className="cc-mod-name">Tokens IA · este mes</div>
              <div
                className="cc-mod-sub"
                style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}
              >
                {tokensAvailable === null ? (
                  <span>admin · sin límite · {tokensUsed.toLocaleString('es-MX')} usados</span>
                ) : (
                  <>
                    <span>
                      {tokensUsed.toLocaleString('es-MX')} /{' '}
                      {tokensAvailable.toLocaleString('es-MX')} tokens
                    </span>
                    <span className="cc-bar-track" style={{ maxWidth: 220 }}>
                      <span
                        className={`cc-bar-fill ${tokensPct > 85 ? 'r' : tokensPct > 60 ? 'am' : 'gr'}`}
                        style={{ width: `${tokensPct}%` }}
                      />
                    </span>
                    <span>{tokensPct}%</span>
                  </>
                )}
              </div>
            </div>
            <div className="cc-mod-right">
              <Link href={'/app/usage' as Route} style={{ color: 'var(--cc-txt-3)' }}>
                detalle →
              </Link>
            </div>
          </div>
          <div className="cc-mod-row">
            <div className="cc-mod-body">
              <div className="cc-mod-name">Herramientas en vivo</div>
              <div className="cc-mod-sub" style={{ marginTop: 6 }}>
                {fleet.live} ahora · {liveCapacityLabel(tier, fleet)}
              </div>
            </div>
            <div className="cc-mod-right">
              <Link href={'/app/engines' as Route} style={{ color: 'var(--cc-txt-3)' }}>
                mis engines →
              </Link>
            </div>
          </div>
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
          ▸ Trabajos y almacenamiento se miden por herramienta y aparecen aquí cuando la primera
          esté lista.
        </p>
      </div>
    </div>
  );
}
