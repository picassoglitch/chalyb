// The line under Pro mensual's price (Law §16.5). With SHOW_REFERENCE_PRICE
// on (decided on the server: referencePriceState), the struck $1,662 and
// label A, verbatim. Off (the default): "Precio de lanzamiento: $997 MXN al
// mes". Only ever next to the Pro monthly price on the plan cards, never near
// a payment form or consent text. This is the one place a struck price may
// render (tests/public-site.test.ts).

import { useTranslations } from 'next-intl';
import { planPrice, type ReferencePriceState } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';

export function ReferencePrice({ state }: { state: ReferencePriceState }) {
  const t = useTranslations('billing.price.ref');
  const b = (c: React.ReactNode) => <b>{c}</b>;
  if (!state.show || state.refCents === undefined) {
    return (
      <p className="ch-muted" data-ref-price="off">
        {t('launch', { monto: formatMXN(planPrice('pro_month').totalCents) })}
      </p>
    );
  }
  return (
    <div className="ch-muted" data-ref-price="on" style={{ display: 'grid', gap: 2 }}>
      <p>
        <span className="ch-sr">{t('wasSr')} </span>
        <s>{formatMXN(state.refCents)}</s>
      </p>
      <p>
        {t.rich('labelA1', {
          sitio: state.site ?? '',
          fecha: state.date ?? '',
          pct: state.pct ?? 0,
          b,
        })}
      </p>
      <p>{t.rich('labelA2', { fecha_fin_promo: state.promoEnd ?? '', b })}</p>
    </div>
  );
}
