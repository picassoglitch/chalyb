// /app/billing — the subscriber's own receipts.
//
// TWO THINGS THIS PAGE USED TO GET WRONG, both of which made a real,
// webhook-confirmed payment look like it never happened:
//
//   1. The query's `error` was discarded. `const { data } = await ...` with
//      no error branch means an RLS refusal, a missing column or a dropped
//      connection all render as `[]` — under copy that says "tus pagos se
//      actualizan solos", which reads as "we looked, there is nothing".
//      The operator saw 0 pagos / $0.00 while the admin top bar showed the
//      same charge as revenue. Now a failed read says so.
//
//   2. Every row was labelled "Plan <tier>". A token pack carries the
//      buyer's CURRENT tier in that column (see migration 0039), so a $149
//      pack bought on Free rendered as "Plan Free · $149.00". Rows are now
//      described by `kind`.
//
// The totals go through the same summariseMoney() the admin surfaces use,
// so "aprobados" here and "Dinero hoy" there can never disagree about what
// counts as settled.

import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { getTokenPack } from '@/lib/payments/pricing';
import { formatMxn, isSettledPaymentStatus, summariseMoney } from '@/lib/billing/money';
import { loadPayments, paymentKind, type PaymentLedgerRow } from '@/lib/billing/payments-data';
import type { SubscriptionTier } from '@/lib/auth/session';

export const metadata = { title: 'Facturación' };

const TIER_LABEL: Record<SubscriptionTier, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  PARTNER: 'Partner',
  VIP: 'VIP',
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Aprobado', cls: 'gr' },
  accredited: { label: 'Aprobado', cls: 'gr' },
  processed: { label: 'Aprobado', cls: 'gr' },
  pending: { label: 'Pendiente', cls: 'am' },
  in_process: { label: 'Procesando', cls: 'am' },
  rejected: { label: 'Rechazado', cls: 'r' },
  cancelled: { label: 'Cancelado', cls: 'r' },
  refunded: { label: 'Reembolsado', cls: 'pu' },
  charged_back: { label: 'Contracargo', cls: 'r' },
};

/** What this charge bought, in the buyer's words. `kind` is authoritative;
 *  the fallbacks below keep rows written before migration 0039 readable. */
function describe(p: PaymentLedgerRow): { title: string; detail: string | null } {
  const kind = paymentKind(p);

  if (kind === 'pack') {
    const pack = p.pack_id ? getTokenPack(p.pack_id) : undefined;
    const tokens = p.tokens_granted ?? pack?.tokens ?? null;
    return {
      title: tokens
        ? `Tokens extra · +${tokens.toLocaleString('es-MX')}`
        : 'Tokens extra · paquete',
      detail: 'Compra de tokens — no cambia tu plan.',
    };
  }
  if (kind === 'subscription') {
    return {
      title: `Plan ${TIER_LABEL[p.tier]} · cobro mensual`,
      detail: 'Cobro recurrente de tu suscripción.',
    };
  }
  return { title: `Plan ${TIER_LABEL[p.tier]}`, detail: null };
}

export default async function WorkspaceBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status: returnedStatus } = await searchParams;
  setRequestLocale(locale);

  const session = await getSessionUser();
  if (!session) redirect('/sign-in?next=/app/billing');

  const { rows: payments, failure } = await loadPayments({
    userId: session.user.id,
    logTag: '/app/billing',
  });

  // Same rules as every admin money surface: summariseMoney decides what
  // counts as settled and how currencies are kept apart.
  const settled = summariseMoney(payments);
  const approvedCount = payments.filter((p) => isSettledPaymentStatus(p.status)).length;

  return (
    <div className="cc-scroll">
      {/* The read failed. Say so — a confident "0 pagos" here is the bug
          this page was reported for. */}
      {failure && (
        <div
          style={{
            padding: '14px 18px',
            border: '1px solid var(--cc-red)',
            background: 'rgba(233,84,84,.08)',
            borderRadius: 'var(--cc-r-l)',
            marginBottom: 18,
            color: 'var(--cc-txt-2)',
            fontSize: 13,
          }}
        >
          ● <b style={{ color: 'var(--cc-red)' }}>No pudimos leer tu historial</b> — esto <b>no</b>{' '}
          significa que no tengas pagos. Si acabas de pagar, tu plan y tus tokens no se ven
          afectados. Vuelve a cargar en un minuto y, si sigue igual, escríbenos desde{' '}
          <Link href={'/app/messages' as Route} style={{ color: 'var(--cc-txt-2)' }}>
            Mensajes
          </Link>
          .
        </div>
      )}

      {/* Post-checkout return banner — MP redirects here with ?status= */}
      {returnedStatus === 'success' && (
        <div
          style={{
            padding: '14px 18px',
            border: '1px solid var(--cc-green)',
            background: 'var(--cc-green-g)',
            borderRadius: 'var(--cc-r-l)',
            marginBottom: 18,
            color: 'var(--cc-txt-2)',
            fontSize: 13,
          }}
        >
          ● <b style={{ color: 'var(--cc-green)' }}>Pago recibido</b> — tu plan se activa en cuanto
          Mercado Pago confirma el cobro (de segundos a minutos). Si autorizaste una suscripción, el
          cobro se repite cada mes hasta que la canceles desde /app/subscription. Esta página se
          actualiza sola.
        </div>
      )}
      {returnedStatus === 'pending' && (
        <div
          style={{
            padding: '14px 18px',
            border: '1px solid var(--cc-amber)',
            background: 'var(--cc-amber-g)',
            borderRadius: 'var(--cc-r-l)',
            marginBottom: 18,
            color: 'var(--cc-txt-2)',
            fontSize: 13,
          }}
        >
          ● <b style={{ color: 'var(--cc-amber)' }}>Pago pendiente</b> — Mercado Pago todavía no lo
          confirma. Si pagaste en efectivo (OXXO, ticket), el dinero se acredita cuando lo procesan.
        </div>
      )}

      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Pagos registrados</div>
          <div className={`cc-mod-stat-v ${payments.length > 0 ? 'gr' : ''}`}>
            {failure ? '—' : payments.length}
          </div>
          <div className="cc-mod-stat-sub">{failure ? 'sin datos' : 'últimos 50'}</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Aprobados</div>
          <div className="cc-mod-stat-v">{failure ? '—' : approvedCount}</div>
          <div className="cc-mod-stat-sub">los que mantienen tu plan activo</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Total pagado</div>
          <div className="cc-mod-stat-v">
            {failure || settled.count === 0
              ? '—'
              : settled.byCurrency.length === 1
                ? `${formatMxn(settled.byCurrency[0]!.amountCents)} ${settled.byCurrency[0]!.currency}`
                : formatMxn(settled.totalMxnCents)}
          </div>
          <div className="cc-mod-stat-sub">
            {failure
              ? 'sin datos'
              : settled.count === 0
                ? 'todavía sin pagos aprobados'
                : settled.usedManualFx
                  ? 'aprobados · FX estimado (tipo de cambio manual)'
                  : 'solo los pagos aprobados'}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Plan activo</div>
          <div className="cc-mod-stat-v gr">{TIER_LABEL[session.tier]}</div>
          <div className="cc-mod-stat-sub">
            <Link href={'/app/subscription' as Route} style={{ color: 'var(--cc-txt-3)' }}>
              gestionar →
            </Link>
          </div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Historial de pagos</div>
        {payments.length === 0 ? (
          <div
            style={{
              padding: '40px 24px',
              border: '1px dashed var(--cc-line-2)',
              borderRadius: 'var(--cc-r-l)',
              textAlign: 'center',
              color: 'var(--cc-txt-3)',
              fontSize: 13,
            }}
          >
            {failure
              ? 'Sin datos — no pudimos leer tu historial.'
              : 'Todavía no tienes pagos registrados.'}
            <br />
            <span
              style={{
                color: 'var(--cc-txt-4)',
                fontSize: 12,
                fontFamily: 'var(--cc-mono), monospace',
                marginTop: 6,
                display: 'inline-block',
              }}
            >
              {failure
                ? 'Esto es una falla de lectura, no la ausencia de pagos.'
                : 'Cuando actives Pro o VIP, o compres tokens extra, tu pago aparece aquí.'}
            </span>
          </div>
        ) : (
          <div className="cc-mod-list">
            {payments.map((p) => {
              const meta = STATUS_LABEL[p.status] ?? { label: p.status, cls: '' };
              const { title, detail } = describe(p);
              const date = new Date(p.created_at).toLocaleDateString(
                locale === 'es' ? 'es-MX' : 'en-US',
                {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                },
              );
              return (
                <div key={p.id} className="cc-mod-row">
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">
                      {title} <span className={`cc-mod-badge ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="cc-mod-sub">
                      {date} · MP #{p.mp_payment_id}
                      {detail && (
                        <>
                          <br />
                          {detail}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="cc-mod-right">
                    <b>{formatMxn(p.amount_cents)}</b>
                    <span>{p.currency}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p
          style={{
            fontSize: 11.5,
            color: 'var(--cc-txt-4)',
            fontFamily: 'var(--cc-mono), monospace',
            marginTop: 10,
            paddingLeft: 4,
          }}
        >
          ▸ Tus pagos se actualizan solos cada vez que Mercado Pago avisa de un cambio de estado.
        </p>
      </div>
    </div>
  );
}
