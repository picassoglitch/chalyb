import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMercadoPagoSignature, type SignatureInput } from './webhook-signature';

const SECRET = 'a-test-webhook-secret';
const PAYMENT_ID = '1234567890';
const REQUEST_ID = 'req-abc-123';
const TS = '1733520000';

/** Build the header Mercado Pago would actually send. */
function signedHeader(
  secret = SECRET,
  paymentId = PAYMENT_ID,
  requestId = REQUEST_ID,
  ts = TS,
): string {
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

function input(overrides: Partial<SignatureInput> = {}): SignatureInput {
  return {
    secret: SECRET,
    signatureHeader: signedHeader(),
    requestId: REQUEST_ID,
    paymentId: PAYMENT_ID,
    nodeEnv: 'production',
    allowUnsignedFlag: undefined,
    ...overrides,
  };
}

describe('verifyMercadoPagoSignature', () => {
  it('accepts a correctly signed payload', () => {
    expect(verifyMercadoPagoSignature(input())).toEqual({ ok: true, reason: 'verified' });
  });

  // THE regression. The old inline check opened with
  // `if (!secret) return true`, which made a single missing env var enough for
  // anyone to POST themselves a VIP tier.
  describe('when no secret is configured', () => {
    it('refuses in production', () => {
      const verdict = verifyMercadoPagoSignature(input({ secret: undefined }));
      expect(verdict.ok).toBe(false);
      expect(verdict.ok === false && verdict.reason).toBe('secret_missing');
    });

    it('refuses in production even with the dev escape hatch set', () => {
      const verdict = verifyMercadoPagoSignature(
        input({ secret: undefined, allowUnsignedFlag: 'true' }),
      );
      expect(verdict.ok).toBe(false);
    });

    it('refuses in development unless the escape hatch is set', () => {
      const verdict = verifyMercadoPagoSignature(
        input({ secret: undefined, nodeEnv: 'development' }),
      );
      expect(verdict.ok).toBe(false);
    });

    it('allows an unsigned payload in development with the escape hatch', () => {
      const verdict = verifyMercadoPagoSignature(
        input({ secret: undefined, nodeEnv: 'development', allowUnsignedFlag: 'true' }),
      );
      expect(verdict).toEqual({ ok: true, reason: 'dev_unsigned_allowed' });
    });
  });

  describe('rejects a payload it cannot verify', () => {
    it('with no x-signature header', () => {
      const verdict = verifyMercadoPagoSignature(input({ signatureHeader: null }));
      expect(verdict.ok === false && verdict.reason).toBe('header_missing');
    });

    it('with no x-request-id header', () => {
      const verdict = verifyMercadoPagoSignature(input({ requestId: null }));
      expect(verdict.ok === false && verdict.reason).toBe('header_missing');
    });

    it('with an x-signature missing v1', () => {
      const verdict = verifyMercadoPagoSignature(input({ signatureHeader: `ts=${TS}` }));
      expect(verdict.ok === false && verdict.reason).toBe('header_malformed');
    });

    it('when the signature was made with a different secret', () => {
      const verdict = verifyMercadoPagoSignature(
        input({ signatureHeader: signedHeader('the-wrong-secret') }),
      );
      expect(verdict.ok === false && verdict.reason).toBe('mismatch');
    });

    // Replaying another payment's signature against this payment id is the
    // cheapest forgery available, since signatures travel in the clear.
    it('when a valid signature is replayed for a different payment id', () => {
      const verdict = verifyMercadoPagoSignature(
        input({ signatureHeader: signedHeader(SECRET, '9999999999') }),
      );
      expect(verdict.ok === false && verdict.reason).toBe('mismatch');
    });

    it('when the ts in the header does not match the ts that was signed', () => {
      // Sign with one ts, then advertise another — the manifest changes, so
      // the digest no longer lines up.
      const signed = signedHeader(SECRET, PAYMENT_ID, REQUEST_ID, '1733520000');
      const tampered = signed.replace('ts=1733520000', 'ts=1733529999');
      const verdict = verifyMercadoPagoSignature(input({ signatureHeader: tampered }));
      expect(verdict.ok === false && verdict.reason).toBe('mismatch');
    });

    it('when v1 is a truncated digest rather than a full-length one', () => {
      const signed = signedHeader();
      const truncated = signed.slice(0, signed.length - 10);
      const verdict = verifyMercadoPagoSignature(input({ signatureHeader: truncated }));
      expect(verdict.ok).toBe(false);
    });

    it('when v1 is not hex at all', () => {
      const verdict = verifyMercadoPagoSignature(
        input({ signatureHeader: `ts=${TS},v1=not-a-digest` }),
      );
      expect(verdict.ok).toBe(false);
    });
  });

  it('tolerates whitespace around the header parts', () => {
    const [ts, v1] = signedHeader().split(',');
    const spaced = ` ${ts} ,  ${v1} `;
    expect(verifyMercadoPagoSignature(input({ signatureHeader: spaced }))).toEqual({
      ok: true,
      reason: 'verified',
    });
  });
});
