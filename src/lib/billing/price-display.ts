// What the plan cards show around the amounts, decided on the server: the
// reference price (Law §16.5, behind SHOW_REFERENCE_PRICE and its dates) and
// which tax footer applies (Law §16.7). Both are per request: the reference
// switches itself off at REFERENCE_PRICE_UNTIL, and the footer follows the
// visitor's country (geo-IP picks the display; the billing address decides
// the charge).

import 'server-only';
import { headers } from 'next/headers';
import {
  isGrandfatheredAmount,
  referencePriceState,
  taxRegion,
  type ReferencePriceState,
} from '@/config/pricing';
import { usdMarketEnabled } from '@/lib/config/flags';

export type TaxFooterKey = 'tax' | 'taxUS' | 'taxCA';

export interface PriceDisplay {
  reference: ReferencePriceState;
  /** billing.price.<key> */
  taxKey: TaxFooterKey;
}

export async function loadPriceDisplay(opts: {
  /** The signed-in subscriber's current charge, if any. */
  currentAmountCents?: number | null;
}): Promise<PriceDisplay> {
  const h = await headers().catch(() => null);
  const region = taxRegion(h?.get('x-vercel-ip-country') ?? null, usdMarketEnabled());
  return {
    reference: referencePriceState(new Date(), process.env, {
      grandfathered: isGrandfatheredAmount(opts.currentAmountCents),
    }),
    taxKey: region === 'US' ? 'taxUS' : region === 'CA' ? 'taxCA' : 'tax',
  };
}
