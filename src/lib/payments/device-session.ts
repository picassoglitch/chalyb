// MP's device fingerprint (security.js → MP_DEVICE_SESSION_ID), sent as
// X-meli-session-id so its anti-fraud engine sees the buyer's device. Pure.

/** Opaque id from Mercado Pago; anything else is dropped, never forwarded.
 *  Real ids are "armor." + 225 hex (231 chars, 2026-11-07); 128 dropped them all. */
const DEVICE_SESSION_RE = /^[A-Za-z0-9._:-]{8,512}$/;

export function cleanDeviceSessionId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return DEVICE_SESSION_RE.test(v) ? v : null;
}

/** SDK requestOptions carrying the header (the SDK names it meliSessionId). */
export function meliSessionOptions(deviceSessionId: unknown): {
  meliSessionId?: string;
} {
  const id = cleanDeviceSessionId(deviceSessionId);
  return id ? { meliSessionId: id } : {};
}

/** For the log: did the browser send one, and did it survive the check. No value. */
export function deviceSessionAudit(raw: unknown): {
  sent: boolean;
  kept: boolean;
  length: number;
} {
  const sent = typeof raw === 'string' && raw.trim() !== '';
  return {
    sent,
    kept: cleanDeviceSessionId(raw) !== null,
    length: typeof raw === 'string' ? raw.trim().length : 0,
  };
}
