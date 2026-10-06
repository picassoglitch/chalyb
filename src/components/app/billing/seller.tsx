// "Quién vende" (art. 76 Bis fr. III LFPC; P2-13): the seller's legal name,
// RFC, address, phone, email, hours and complaint channel, one tap from the
// payment step and at /quien-vende. Values come from LEGAL_ENTITY_* (OPS-10);
// the trial can't open while any is missing.

import { getTranslations } from 'next-intl/server';
import { legalEntity } from '@/lib/billing/legal-entity';
import { SellerSheetButton } from './seller-sheet';

export async function SellerDetails() {
  const t = await getTranslations('seller');
  const entity = legalEntity();
  const rows = (
    ['name', 'rfc', 'address', 'phone', 'email', 'hours', 'complaints'] as const
  ).filter((k) => entity[k]);
  if (rows.length === 0) return <p className="ch-muted">{t('pending')}</p>;
  return (
    <dl style={{ display: 'grid', gap: 10 }}>
      {rows.map((k) => (
        <div key={k}>
          <dt className="ch-muted" style={{ fontSize: 15 }}>
            {t(k)}
          </dt>
          <dd style={{ fontSize: 17 }}>{entity[k]}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SellerSheet({ label }: { label: string }) {
  return (
    <SellerSheetButton label={label}>
      <SellerDetails />
    </SellerSheetButton>
  );
}
