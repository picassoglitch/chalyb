import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/payments/pricing';
import type { SubscriptionTier } from '@/lib/auth/session';

export const metadata = { title: 'Facturación' };

interface PaymentRow {
  id: string;
  tier: SubscriptionTier;
  mp_payment_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
}

const TIER_LABEL: Record<SubscriptionTier, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  PARTNER: 'Partner',
  VIP: 'VIP',
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Aprobado', cls: 'gr' },
  pending: { label: 'Pendiente', cls: 'am' },
  in_process: { label: 'Procesando', cls: 'am' },
  rejected: { label: 'Rechazado', cls: 'r' },
  cancelled: { label: 'Cancelado', cls: 'r' },
  refunded: { label: 'Reembolsado', cls: 'pu' },
  charged_back: { label: 'Contracargo', cls: 'r' },
};

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

  const supabase = await createClient();
  const { data: paymentsRaw } = await supabase
    .from('payments')
    .select('id, tier, mp_payment_id, amount_cents, currency, status, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  const payments = (paymentsRaw ?? []) as PaymentRow[];

  return (
    <div className="cc-scroll">
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
          ● <b style={{ color: 'var(--cc-green)' }}>Pago recibido</b> — tu plan se activa en
          cuanto Mercado Pago confirma el pago (de segundos a minutos). Esta página se actualiza
          sola.
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
          ● <b style={{ color: 'var(--cc-amber)' }}>Pago pendiente</b> — Mercado Pago todavía no
          lo confirma. Si pagaste en efectivo (OXXO, ticket), el dinero se acredita cuando lo
          procesan.
        </div>
      )}

      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Pagos registrados</div>
          <div className="cc-mod-stat-v gr">{payments.length}</div>
          <div className="cc-mod-stat-sub">últimos 50</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Aprobados</div>
          <div className="cc-mod-stat-v">
            {payments.filter((p) => p.status === 'approved').length}
          </div>
          <div className="cc-mod-stat-sub">los que mantienen tu plan activo</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Total pagado</div>
          <div className="cc-mod-stat-v">
            {formatMoney(
              payments
                .filter((p) => p.status === 'approved')
                .reduce((sum, p) => sum + p.amount_cents, 0),
              payments[0]?.currency ?? 'USD',
            )}
          </div>
          <div className="cc-mod-stat-sub">solo los pagos aprobados</div>
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
            Todavía no tienes pagos registrados.
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
              Cuando actives Pro o VIP desde /app/subscription, tu pago aparece aquí.
            </span>
          </div>
        ) : (
          <div className="cc-mod-list">
            {payments.map((p) => {
              const meta = STATUS_LABEL[p.status] ?? { label: p.status, cls: '' };
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
                      Plan {TIER_LABEL[p.tier]}{' '}
                      <span className={`cc-mod-badge ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="cc-mod-sub">
                      {date} · MP #{p.mp_payment_id}
                    </div>
                  </div>
                  <div className="cc-mod-right">
                    <b>{formatMoney(p.amount_cents, p.currency)}</b>
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
