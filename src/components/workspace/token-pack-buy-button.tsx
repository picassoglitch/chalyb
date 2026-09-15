'use client';

// Buy button for a token top-up pack. It only navigates: the card form and
// the charge live on /app/usage/checkout, so no server action runs from the
// tile and nothing is created at Mercado Pago until the buyer submits a card.

import type { Route } from 'next';
import { Link } from '@/i18n/routing';

interface Props {
  packId: string;
  packLabel: string;
}

export function TokenPackBuyButton({ packId, packLabel }: Props) {
  return (
    <div style={{ marginTop: 'auto' }}>
      <Link
        href={`/app/usage/checkout?pack=${encodeURIComponent(packId)}` as Route}
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '11px 18px',
          borderRadius: 9,
          background: 'var(--cc-green)',
          color: '#070809',
          fontFamily: 'inherit',
          fontSize: 13.5,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Comprar {packLabel} →
      </Link>
    </div>
  );
}
