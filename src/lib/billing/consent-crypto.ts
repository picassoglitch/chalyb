// IP and user agent in consent_events are personal data (aceptacion-ux
// §10.4.6): encrypted at rest with AES-256-GCM before they reach the
// database. CONSENT_ENCRYPTION_KEY is 32 random bytes, base64 (OPS).

import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key(): Buffer | null {
  const raw = process.env.CONSENT_ENCRYPTION_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  return buf.length === 32 ? buf : null;
}

export function consentEncryptionReady(): boolean {
  return key() !== null;
}

/** "v1.<iv>.<tag>.<ciphertext>" (base64url), or null when there is no value. */
export function sealPersonal(value: string | null): string | null {
  if (!value) return null;
  const k = key();
  if (!k) throw new Error('CONSENT_ENCRYPTION_KEY is missing or not 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
    .join('.');
}

export function openPersonal(sealed: string | null): string | null {
  if (!sealed) return null;
  const k = key();
  if (!k) throw new Error('CONSENT_ENCRYPTION_KEY is missing or not 32 bytes');
  const [, iv, tag, data] = sealed.split('.');
  const decipher = createDecipheriv('aes-256-gcm', k, Buffer.from(iv!, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag!, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(data!, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
