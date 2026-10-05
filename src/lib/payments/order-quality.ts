// What a token-pack order tells Mercado Pago beyond the amount: who is paying,
// what the item is, and what shows on the card statement. Mercado Pago's
// "Calidad de integración" scores these, and its fraud engine approves more
// payments when they are present. Pure; token-checkout-actions.ts is the
// only caller.

import type { TokenPackDef } from './pricing';

/** On the buyer's card statement. Mercado Pago allows about 10 characters. */
export const STATEMENT_DESCRIPTOR = 'CHALYB';

/** Mercado Pago's item category for what a pack is: usage of an online service. */
export const PACK_CATEGORY_ID = 'services';

interface OrderUser {
  created_at?: string;
  user_metadata?: Record<string, unknown>;
}

/** payer.first_name / payer.last_name from the name the user signed up with.
 *  Absent parts are left out rather than sent empty. */
export function payerName(user: OrderUser): { first_name?: string; last_name?: string } {
  const meta = user.user_metadata ?? {};
  const raw = [meta.full_name, meta.name].find((v) => typeof v === 'string' && v.trim());
  if (typeof raw !== 'string') return {};
  const [first, ...rest] = raw.trim().split(/\s+/);
  const last = rest.join(' ');
  return { first_name: first, ...(last ? { last_name: last } : {}) };
}

/** Orders API additional_info: flat "payer.*" keys (a nested `payer` object
 *  is a 400). authentication_type only takes WEB or MOBILE. */
export function orderAdditionalInfo(user: OrderUser): Record<string, string> {
  return {
    'payer.authentication_type': 'WEB',
    ...(user.created_at ? { 'payer.registration_date': user.created_at } : {}),
  };
}

/** The one line item of a pack order. */
export function packItem(pack: TokenPackDef, unitPrice: string) {
  return {
    title: `Chalyb · ${pack.label}`,
    description: `${pack.tokens.toLocaleString('es-MX')} tokens de uso para las herramientas de Chalyb`,
    category_id: PACK_CATEGORY_ID,
    unit_price: unitPrice,
    quantity: 1,
    external_code: `pack-${pack.id}`,
  };
}
