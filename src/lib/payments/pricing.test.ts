import { describe, expect, it } from 'vitest';
import {
  TIER_PRICING,
  TOKEN_PACKS,
  checkTierPayment,
  checkTokenPackPayment,
  formatMoney,
  getTokenPack,
} from './pricing';

// external_reference tells the webhook WHICH sku a payment is for, and it is
// just a string we put on the Preference. The amount is the only part MP
// vouches for, so comparing it to the catalog is what stops a hand-built
// Preference from buying VIP for five pesos.

describe('checkTierPayment', () => {
  it('accepts the exact catalog price', () => {
    const pro = TIER_PRICING.PRO!;
    expect(checkTierPayment('PRO', pro.amountCents, pro.currency)).toEqual({ ok: true });
  });

  it('accepts an overpayment', () => {
    // Currency conversion and MP rounding can land a few centavos high, and
    // refusing to deliver something someone overpaid for is the worse bug.
    const vip = TIER_PRICING.VIP!;
    expect(checkTierPayment('VIP', vip.amountCents + 150, vip.currency)).toEqual({ ok: true });
  });

  it('refuses a payment one centavo short', () => {
    const vip = TIER_PRICING.VIP!;
    const verdict = checkTierPayment('VIP', vip.amountCents - 1, vip.currency);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe('underpaid');
  });

  it('refuses a token amount paid against a tier', () => {
    const verdict = checkTierPayment('VIP', 500, 'MXN');
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.expectedCents).toBe(TIER_PRICING.VIP!.amountCents);
  });

  it('refuses the right number in the wrong currency', () => {
    // 2,499 of a stronger currency is not 2,499 MXN.
    const verdict = checkTierPayment('VIP', TIER_PRICING.VIP!.amountCents, 'USD');
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe('currency_mismatch');
  });

  it('is case-insensitive about the currency code', () => {
    const pro = TIER_PRICING.PRO!;
    expect(checkTierPayment('PRO', pro.amountCents, 'mxn')).toEqual({ ok: true });
  });

  it.each(['FREE', 'PARTNER'] as const)('refuses %s, which has no price', (tier) => {
    const verdict = checkTierPayment(tier, 100_000, 'MXN');
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe('unknown_sku');
  });
});

describe('checkTokenPackPayment', () => {
  it.each(TOKEN_PACKS)('accepts the catalog price of $id', (pack) => {
    expect(checkTokenPackPayment(pack.id, pack.amountCents, pack.currency)).toEqual({ ok: true });
  });

  it('refuses the cheap pack price for the expensive pack', () => {
    const cheapest = TOKEN_PACKS.at(0)!;
    const dearest = TOKEN_PACKS.at(-1)!;
    const verdict = checkTokenPackPayment(dearest.id, cheapest.amountCents, cheapest.currency);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe('underpaid');
  });

  it('refuses a pack id that is not in the catalog', () => {
    const verdict = checkTokenPackPayment('tokens_1b', 100, 'MXN');
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe('unknown_sku');
  });
});

describe('the catalog itself', () => {
  it('prices every pack above zero and keeps the ids unique', () => {
    expect(TOKEN_PACKS.length).toBeGreaterThan(0);
    for (const pack of TOKEN_PACKS) {
      expect(pack.amountCents).toBeGreaterThan(0);
      expect(pack.tokens).toBeGreaterThan(0);
    }
    expect(new Set(TOKEN_PACKS.map((p) => p.id)).size).toBe(TOKEN_PACKS.length);
  });

  it('gets cheaper per token as the pack gets bigger, as the copy claims', () => {
    const rates = TOKEN_PACKS.map((p) => p.amountCents / p.tokens);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]!).toBeLessThan(rates[i - 1]!);
    }
  });

  it('looks a pack up by id and returns undefined otherwise', () => {
    expect(getTokenPack('tokens_100k')?.tokens).toBe(100_000);
    expect(getTokenPack('nope')).toBeUndefined();
  });
});

describe('formatMoney', () => {
  it('renders minor units as major with the currency', () => {
    expect(formatMoney(74900, 'MXN')).toBe('$749.00 MXN');
    expect(formatMoney(0, 'USD')).toBe('$0.00 USD');
  });
});
