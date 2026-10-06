// The rules a credit-pack checkout must pass before Mercado Pago is touched,
// pure over injected readers so the tests run them as they run in prod
// (token-checkout-actions.ts wires the real ones).
//
//   1. The person ticked the Paquetes checkbox (Términos de los Paquetes §9.1).
//      Unticked, missing or anything but `true` → refused, nothing charged.
//   2. The owner's pack prices can be read. Missing or malformed → refused.
//   3. The amount the page showed is the amount in force. A price changed
//      between page load and click → refused; the page reloads and shows
//      the new one.
//   4. The Paquetes text the person accepted shows that amount (a published
//      version is frozen with its prices; a price change needs a new one).
//
// Only then is the amount handed to the order, and it is THAT amount: the
// one the person saw, accepted and is recorded as accepting.

import { formatMXN } from '@/lib/billing/format';
import type { PackId } from '@/config/pricing';
import { getTokenPack, type PackTotals, type TokenPackDef } from './pricing';
import { orderAmount } from './order-charge';

export type PackGateRefusal =
  | 'unknown_pack'
  | 'consent_required'
  | 'not_configured'
  | 'price_changed'
  | 'terms_mismatch';

export interface PackGateInput {
  packId: string;
  /** The checkbox. Only literal `true` counts. */
  accepted: unknown;
  /** The total the page showed, in centavos. */
  shownCents: unknown;
}

export interface PackGateDeps {
  /** The owner's pack totals in force, or null when unreadable. */
  loadTotals: () => Promise<PackTotals | null>;
  /** The Paquetes text as the person sees it with these totals. */
  termsText: (totals: PackTotals) => string | null;
}

export type PackGateResult =
  | {
      ok: true;
      pack: TokenPackDef;
      /** What the order charges, in centavos: equals what the page showed. */
      cents: number;
      /** The same, as the Orders API string ("599.00"). */
      amount: string;
      totals: PackTotals;
      termsText: string;
    }
  | { ok: false; reason: PackGateRefusal };

/** Whether a legal text promises this pack total ("$599 MXN"). */
export function termsShowPrice(text: string, cents: number): boolean {
  return text.includes(`${formatMXN(cents)} MXN`);
}

export async function gatePackCharge(
  input: PackGateInput,
  deps: PackGateDeps,
): Promise<PackGateResult> {
  const pack = getTokenPack(input.packId);
  if (!pack) return { ok: false, reason: 'unknown_pack' };
  if (input.accepted !== true) return { ok: false, reason: 'consent_required' };
  const totals = await deps.loadTotals().catch(() => null);
  const cents = totals?.[pack.id as PackId];
  if (!totals || typeof cents !== 'number' || !Number.isInteger(cents) || cents <= 0) {
    return { ok: false, reason: 'not_configured' };
  }
  if (input.shownCents !== cents) return { ok: false, reason: 'price_changed' };
  const termsText = deps.termsText(totals);
  if (!termsText || !termsShowPrice(termsText, cents)) return { ok: false, reason: 'terms_mismatch' };
  return { ok: true, pack, cents, amount: orderAmount(cents), totals, termsText };
}

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The checkbox sentence (packCheckout.consent), with <b>/<terms> markup:
 *  the page renders it, the evidence stores it stripped. */
export function packConsentSentence(
  t: Translate,
  input: { cents: number; tokens: number; locale: string },
): string {
  return t('consent', {
    monto: formatMXN(input.cents),
    n: input.tokens.toLocaleString(input.locale === 'es' ? 'es-MX' : 'en-US'),
  });
}
