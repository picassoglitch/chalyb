// Verifying Resend's webhooks (Svix scheme). Pure.
//
//   signed content: `${svix-id}.${svix-timestamp}.${raw body}`
//   signature:      base64(HMAC-SHA256(secret, content))
//   secret:         RESEND_WEBHOOK_SECRET, "whsec_<base64 key>"
//   header:         "v1,<sig> v1,<sig2>" (any match passes)

import { createHmac, timingSafeEqual } from 'node:crypto';
import { MANDATORY_NOTICE_EMAIL_KINDS } from '@/lib/billing/reminders';

const TOLERANCE_S = 5 * 60;

export function verifyResendSignature(input: {
  secret: string | undefined;
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  body: string;
  nowS?: number;
}): boolean {
  const { secret, id, timestamp, signatureHeader, body } = input;
  if (!secret || !id || !timestamp || !signatureHeader) return false;
  const ts = Number(timestamp);
  const now = input.nowS ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TOLERANCE_S) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  return signatureHeader.split(' ').some((part) => {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) return false;
    const got = Buffer.from(sig, 'base64');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** Notices whose delivery gates the next charge (the bounce rule): the
 *  same list the cron sends them from. */
export const MANDATORY_NOTICE_KINDS = MANDATORY_NOTICE_EMAIL_KINDS;
