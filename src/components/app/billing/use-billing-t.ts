'use client';

// The billing translator in the shape billing-copy.ts expects, keeping the
// <b>/<terms> tags as text so <Markup> renders them (and the server's
// evidence strips them) — one set of strings for both.

import { useTranslations } from 'next-intl';
import type { Translate } from '@/lib/billing/billing-copy';

export function useBillingT(): Translate {
  const t = useTranslations('billing');
  return (key, values) =>
    t.markup(key as never, {
      ...(values ?? {}),
      b: (c: string) => `<b>${c}</b>`,
      terms: (c: string) => `<terms>${c}</terms>`,
    } as never);
}
