// MP checks a preapproval's payer_email against the payer's own MP account and
// rejects a mismatch, sometimes as cc_rejected_high_risk (sdk-nodejs#421).

const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[A-Za-z]{2,}$/;

/** A plausible email from the form, or null. Never trusted for anything else. */
export function cleanPayerEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length > 254 || !EMAIL_RE.test(v)) return null;
  return v;
}

export type PayerEmailSource = 'account' | 'form';

/** The account's email unless the flag is on, MP is `prod` (test uses MP's
 *  test buyer) and the buyer typed a valid, different one. */
export function choosePayerEmail(input: {
  accountPayerEmail: string;
  formEmail: unknown;
  editable: boolean;
  mpEnv: 'test' | 'prod';
}): { email: string; source: PayerEmailSource } {
  const typed = input.editable && input.mpEnv === 'prod' ? cleanPayerEmail(input.formEmail) : null;
  if (typed && typed.toLowerCase() !== input.accountPayerEmail.toLowerCase()) {
    return { email: typed, source: 'form' };
  }
  return { email: input.accountPayerEmail, source: 'account' };
}

/** Is the payer the seller itself (MP refuses to charge a seller its own card)?
 *  null when the seller's email is unknown. */
export function payerIsSeller(payerEmail: string, sellerEmail: string | null): boolean | null {
  if (!sellerEmail) return null;
  return payerEmail.trim().toLowerCase() === sellerEmail.trim().toLowerCase();
}
