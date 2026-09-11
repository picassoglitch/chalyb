'use client';

import { useState, useTransition } from 'react';
import { useWorkspace } from '@/lib/workspace/store';
import { changeUserTier } from '@/lib/auth/tier-actions';
import { createTierCheckout } from '@/lib/payments/checkout-actions';
import { TIER_CAPS } from '@/lib/billing/tiers';
import type { SubscriptionTier } from '@/lib/auth/session';

// Pull display labels straight from TIER_CAPS — single source of truth for
// names. Pricing strings ALSO come from TIER_CAPS below in the cards array.
const TIER_LABELS: Record<SubscriptionTier, string> = {
  FREE: TIER_CAPS.FREE.label,
  PRO: TIER_CAPS.PRO.label,
  PARTNER: TIER_CAPS.PARTNER.label,
  VIP: TIER_CAPS.VIP.label,
};

// Marketing copy that DOESN'T live in TIER_CAPS (taglines, feature bullets,
// "featured" flag for the recommended card). Pricing + name come from caps.
const TIER_MARKETING: Record<
  SubscriptionTier,
  { tagline: string; features: string[]; featured?: boolean }
> = {
  FREE: {
    tagline: 'Crea tu cuenta y prueba toda la plataforma gratis.',
    features: [
      'ChalybClip gratis 7 días',
      '50,000 tokens IA de regalo',
      'Acceso a la comunidad',
      'Clips con marca de agua · descarga manual',
    ],
  },
  PRO: {
    tagline: 'Enciende el engine que quieras, en vivo.',
    featured: true,
    features: [
      'Todo lo de Free',
      '1 engine en vivo · tú eliges cuál',
      '1,000,000 de tokens / mes (se regeneran)',
      'ChalybClip Pro: sin marca de agua · ~12 streams/mes · 1 brand kit',
      'Comunidad premium',
    ],
  },
  // PARTNER tier is admin-granted only — never shown as a buyable card.
  // We still need the entry so Record<SubscriptionTier, ...> typechecks
  // and the labels map can be indexed by any tier. The card-filtering
  // ORDER array below excludes it.
  PARTNER: {
    tagline: 'Programa de partners · solo por invitación.',
    features: [
      'Todo lo de Pro',
      'Tu propio engine siempre activo + 1 a elegir',
      'Historial extendido (180 días)',
      'Soporte prioritario',
      'Acceso anticipado a nuevas herramientas',
    ],
  },
  VIP: {
    tagline: 'Todo Chalyb abierto — IA + Clip, sin límites.',
    features: [
      'Todo lo de Pro',
      'Todos los engines en vivo',
      '5× los tokens de Pro (5,000,000 / mes)',
      'Paquete completo de streamer de ChalybClip',
      'Soporte prioritario · el equipo Chalyb te ayuda a construir tu idea',
    ],
  },
};

interface Props {
  initialTier: SubscriptionTier;
  userId: string;
  isAdmin: boolean;
}

export function SubscriptionActions({ initialTier, userId, isAdmin }: Props) {
  const [tier, setTier] = useState<SubscriptionTier>(initialTier);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [isPending, startTransition] = useTransition();
  // Sticky error banner for the checkout failure path. The toast only
  // shows for ~2.5s and users miss it; this stays until they retry or
  // refresh. Common reason in production: MP_ACCESS_TOKEN unset on the
  // server, which returns reason='not_configured'.
  const [stickyError, setStickyError] = useState<string | null>(null);
  const showToast = useWorkspace((s) => s.showToast);

  async function changeTier(next: SubscriptionTier) {
    if (next === tier || isPending) return;
    setPendingTier(next);
    setStickyError(null);

    // Branch 1: Downgrades and admins go through direct tier-actions write.
    //  - Downgrade to FREE: no money changes hands, direct write.
    //  - Admin: their changes bypass MP (admin override).
    if (next === 'FREE' || isAdmin) {
      startTransition(async () => {
        const prev = tier;
        setTier(next); // optimistic
        const res = await changeUserTier(userId, next);
        setPendingTier(null);
        if (!res.ok) {
          setTier(prev);
          const msg = res.error ?? 'No pudimos cambiar tu plan.';
          showToast(`<b>Error</b> · ${msg}`);
          setStickyError(msg);
          return;
        }
        showToast(
          next === 'FREE'
            ? `Listo, tu plan ahora es <b>${TIER_LABELS[next]}</b>.`
            : `Plan <b>${TIER_LABELS[next]}</b> activado.`,
        );
      });
      return;
    }

    // Branch 2: Non-admin upgrading → Mercado Pago checkout.
    //  Returns a URL we redirect the browser to. After payment, MP fires the
    //  webhook which writes profiles.tier asynchronously; this user lands on
    //  /app/billing?status=success.
    startTransition(async () => {
      // Client-side timeout: if MP hangs and Vercel kills the function
      // (10s Hobby, 60s Pro), the useTransition would stay pending forever.
      // 18s = generous for a slow-but-working MP call, short enough that
      // we report the failure before Vercel's generic 500 page appears.
      const CLIENT_TIMEOUT_MS = 18_000;
      let timedOut = false;
      const timeoutPromise = new Promise<{ ok: false; error: string }>((resolve) => {
        setTimeout(() => {
          timedOut = true;
          resolve({
            ok: false,
            error:
              'Mercado Pago no respondió en 18s. Posible causa: ' +
              'MP_ACCESS_TOKEN inválido o no configurado en Vercel.',
          });
        }, CLIENT_TIMEOUT_MS);
      });
      const res = await Promise.race([createTierCheckout(next), timeoutPromise]);
      if (!res.ok || !('url' in res) || !res.url) {
        setPendingTier(null);
        const msg =
          ('error' in res && res.error) || 'No pudimos abrir el pago.';
        showToast(`<b>Error</b> · ${msg}`);
        setStickyError(msg);
        console.error('[tier-checkout] failed', {
          targetTier: next,
          response: res,
          timedOut,
        });
        return;
      }
      // Don't reset pendingTier — the browser is about to navigate away.
      showToast(`Te llevamos a Mercado Pago…`);
      window.location.href = res.url;
    });
  }

  function cancelSubscription() {
    if (tier === 'FREE') {
      showToast('Ya tienes el plan Free.');
      return;
    }
    if (
      !confirm(
        '¿Cancelar tu suscripción? Conservas el plan hasta que termine el período que ya pagaste.',
      )
    ) {
      return;
    }
    void changeTier('FREE');
  }

  // Build cards by composing TIER_CAPS (name + price + per) with TIER_MARKETING
  // (tagline + features + featured). To change a price, only edit:
  //   - TIER_CAPS in src/lib/billing/tiers.ts  (display string)
  //   - TIER_PRICING in src/lib/payments/pricing.ts  (real MP cents)
  // To change feature bullets, edit TIER_MARKETING above.
  const ORDER: SubscriptionTier[] = ['FREE', 'PRO', 'VIP'];
  const cards = ORDER.map((id) => ({
    id,
    name: TIER_CAPS[id].label,
    price: TIER_CAPS[id].price,
    per: `/${TIER_CAPS[id].per}`,
    tagline: TIER_MARKETING[id].tagline,
    features: TIER_MARKETING[id].features,
    featured: TIER_MARKETING[id].featured,
  }));

  return (
    <>
      {isAdmin && (
        <div
          style={{
            padding: '10px 14px',
            border: '1px solid var(--cc-purple)',
            background: 'var(--cc-purple-g)',
            borderRadius: 9,
            fontSize: 12,
            color: 'var(--cc-txt-2)',
            marginBottom: 16,
          }}
        >
          ▸ <b>Modo admin</b> — los cambios de plan se aplican al instante, sin pasar por el
          pago.
        </div>
      )}

      {stickyError && (
        <div
          style={{
            padding: '12px 14px',
            border: '1px solid var(--cc-red, #ff5d5d)',
            background: 'rgba(255, 93, 93, 0.08)',
            borderRadius: 9,
            fontSize: 12.5,
            color: 'var(--cc-red, #ff5d5d)',
            marginBottom: 16,
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>▸</span>
          <div style={{ flex: 1 }}>
            <b style={{ display: 'block', marginBottom: 3 }}>
              No pudimos abrir el pago
            </b>
            <span>{stickyError}</span>
          </div>
          <button
            type="button"
            onClick={() => setStickyError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cc-red, #ff5d5d)',
              fontSize: 14,
              cursor: 'pointer',
              padding: 0,
              opacity: 0.7,
            }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}

      <div
        className="cc-mod-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
      >
        {cards.map((c) => {
          const isCurrent = c.id === tier;
          const isPendingHere = pendingTier === c.id;
          return (
            <div
              key={c.id}
              className="cc-mod-card"
              style={{
                borderColor: isCurrent
                  ? 'var(--cc-green)'
                  : c.featured
                    ? 'rgba(158,234,58,.3)'
                    : undefined,
                background: c.featured && !isCurrent ? 'rgba(158,234,58,.04)' : undefined,
                position: 'relative',
              }}
            >
              <div className="cc-mod-card-head">
                <span
                  className="cc-mod-tag"
                  style={{ fontSize: 13, color: 'var(--cc-txt)', fontWeight: 600 }}
                >
                  {c.name}
                </span>
                {isCurrent && <span className="cc-mod-badge gr">Tu plan</span>}
                {!isCurrent && c.featured && <span className="cc-mod-badge gr">El más elegido</span>}
              </div>
              <div
                style={{
                  fontFamily: 'var(--cc-disp), sans-serif',
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                {c.price}
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--cc-txt-3)',
                    fontWeight: 500,
                    marginLeft: 4,
                  }}
                >
                  {c.per}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--cc-txt-3)', minHeight: 36 }}>
                {c.tagline}
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 0,
                }}
              >
                {c.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      gap: 8,
                      fontSize: 12.5,
                      color: 'var(--cc-txt-2)',
                      lineHeight: 1.45,
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--cc-green)',
                        fontFamily: 'var(--cc-mono), monospace',
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => changeTier(c.id)}
                disabled={isCurrent || isPending}
                style={{
                  marginTop: 'auto',
                  padding: '11px 14px',
                  borderRadius: 9,
                  border: isCurrent ? '1px solid var(--cc-line-2)' : 'none',
                  background: isCurrent
                    ? 'transparent'
                    : c.featured
                      ? 'var(--cc-green)'
                      : 'var(--cc-bg-3)',
                  color: isCurrent ? 'var(--cc-txt-3)' : c.featured ? '#070809' : 'var(--cc-txt)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: isCurrent || isPending ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: isPending && !isPendingHere ? 0.5 : 1,
                }}
              >
                {isPendingHere
                  ? 'Procesando…'
                  : isCurrent
                    ? 'Plan actual'
                    : c.id === 'FREE'
                      ? 'Bajar a Free'
                      : `Cambiar a ${c.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {tier !== 'FREE' && (
        <div className="cc-mod-section">
          <div className="cc-mod-toggle">
            <div className="cc-mod-toggle-text">
              <span className="t">Cancelar suscripción</span>
              <span className="s">
                Conservas tu acceso a {TIER_LABELS[tier]} hasta que termine el período que ya pagaste.
              </span>
            </div>
            <button
              type="button"
              onClick={cancelSubscription}
              style={{
                background: 'transparent',
                border: '1px solid var(--cc-red)',
                color: 'var(--cc-red)',
                padding: '8px 14px',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar plan
            </button>
          </div>
        </div>
      )}
    </>
  );
}
