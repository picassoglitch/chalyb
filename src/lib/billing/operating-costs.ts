// Monthly operating costs — the spend side of the platform P&L.
//
// Hardcoded mocks until we wire up real metering:
//   - Anthropic: pull from console.anthropic.com Usage API monthly
//   - Resend: usually <$20/mo on the free tier, $20 starter
//   - Supabase: $25 Pro base + storage/egress overage
//   - Vercel: $20 Pro base (only when we deploy)
//   - Mercado Pago fees: ~3.99% + IVA per Mexican transaction (auto-deducted)
//
// To replace with real data later: create a `platform_costs` table
// populated by cron jobs that pull from each provider's billing API, then
// query the most-recent month here. The shape can stay identical.

export interface CostLine {
  /** Stable id for sorting / future DB sync */
  id: string;
  provider: string;
  label: string;
  amountCents: number;
  /** ISO 4217 currency code. We render USD costs as-is even though MRR is MXN
   *  — most infra is invoiced in USD and trying to convert at runtime adds
   *  exchange-rate uncertainty to a number we mostly need for trend. */
  currency: 'USD' | 'MXN';
  note: string;
}

export const MONTHLY_OPERATING_COSTS: CostLine[] = [
  {
    id: 'anthropic',
    provider: 'Anthropic',
    label: 'Claude API · todas las llamadas',
    amountCents: 4200, // $42 USD — placeholder; replace with real Usage API pull
    currency: 'USD',
    note: 'usado por engines + chat interno',
  },
  {
    id: 'supabase',
    provider: 'Supabase',
    label: 'Postgres + Auth + Storage (Pro)',
    amountCents: 2500, // $25 USD base
    currency: 'USD',
    note: 'base Pro · overage cuando supere los caps',
  },
  {
    id: 'resend',
    provider: 'Resend',
    label: 'Email transaccional',
    amountCents: 2000, // $20 USD starter
    currency: 'USD',
    note: 'starter tier · escala con volumen',
  },
  {
    id: 'vercel',
    provider: 'Vercel',
    label: 'Hosting + edge (Pro)',
    amountCents: 2000, // $20 USD — only post-deploy
    currency: 'USD',
    note: 'aplica cuando lanzamos a producción',
  },
  {
    id: 'mp_fees',
    provider: 'Mercado Pago',
    label: 'Comisión por transacción (~4% + IVA)',
    amountCents: 0, // calculated from real payments below
    currency: 'MXN',
    note: 'se deduce automáticamente — calculado abajo',
  },
];

/** MP fee estimate: 3.99% + 16% IVA on the fee = effective ~4.63% of gross. */
export const MP_EFFECTIVE_FEE_RATE = 0.0399 * 1.16;

/** Convert USD cents to MXN cents at a fixed conversion rate. We hardcode
 *  ~17 MXN/USD instead of fetching live FX — the P&L view is for direction,
 *  not bookkeeping precision. Update if the rate moves significantly. */
const USD_TO_MXN = 17;

export function toMxnCents(amountCents: number, currency: 'USD' | 'MXN'): number {
  return currency === 'MXN' ? amountCents : amountCents * USD_TO_MXN;
}

export function formatMxn(amountCents: number): string {
  const major = (amountCents / 100).toFixed(2);
  return `$${Number(major).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}
