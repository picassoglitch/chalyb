// MP's device fingerprint (security.js → MP_DEVICE_SESSION_ID), sent as
// X-meli-session-id so its anti-fraud engine sees the buyer's device. Pure.

/** Opaque id from Mercado Pago; anything else is dropped, never forwarded. */
const DEVICE_SESSION_RE = /^[A-Za-z0-9._:-]{8,128}$/;

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
