// "Empezar de cero" for Chalito: a person with no approved device left (and no recovery code)
// proves it's them with a one-time code emailed to their Chalyb account. On the right code every
// Chalito device of the account is retired right away (owner decision 2026-10-19: no waiting
// period, people may need to get in to work), and this browser activates as the first device. Old
// end-to-end encrypted chats stay locked: only the retired devices had their keys.
//
// This file is the flow; the routes (src/app/api/tools/chalito/reset/*) wire the database
// (supabase/migrations/0069_chalito_reset_codes.sql), the email and the Chalito api.

import { createHmac, randomInt } from 'node:crypto';

export const RESET_CODE_TTL_MS = 10 * 60_000;

export type ConsumeResult = 'ok' | 'bad_code' | 'expired' | 'too_many' | 'none';

export interface ResetStore {
  /** A new code for the person, replacing any earlier one; 'rate_limited' after three in an hour. */
  issue(
    userId: string,
    hash: string,
    expiresAt: number,
    now: number,
  ): Promise<'ok' | 'rate_limited'>;
  /** Atomic and single use (five wrong tries lock the code). */
  consume(userId: string, hash: string, now: number): Promise<ConsumeResult>;
}

/** Only the HMAC is stored, keyed to the person: a leaked row can't be replayed for anyone else. */
export const hashResetCode = (secret: string, userId: string, code: string): string =>
  createHmac('sha256', secret).update(`chalito-reset:${userId}:${code}`).digest('hex');

/** The code as typed: six digits, spaces and dashes ignored; null otherwise. */
export const cleanResetCode = (raw: string): string | null => {
  const code = raw.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(code) ? code : null;
};

export type StartResult =
  | { ok: true }
  | { ok: false; reason: 'no_email' | 'rate_limited' | 'send_failed' };

export const startReset = async (d: {
  userId: string;
  email: string | null;
  store: ResetStore;
  secret: string;
  now: () => number;
  send: (to: string, code: string) => Promise<boolean>;
}): Promise<StartResult> => {
  if (!d.email) return { ok: false, reason: 'no_email' };
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const now = d.now();
  const issued = await d.store.issue(
    d.userId,
    hashResetCode(d.secret, d.userId, code),
    now + RESET_CODE_TTL_MS,
    now,
  );
  if (issued === 'rate_limited') return { ok: false, reason: 'rate_limited' };
  if (!(await d.send(d.email, code))) return { ok: false, reason: 'send_failed' };
  return { ok: true };
};

export type ConfirmResult =
  | { ok: true }
  | { ok: false; reason: 'format' | Exclude<ConsumeResult, 'ok'> | 'failed' };

export const confirmReset = async (d: {
  userId: string;
  raw: string;
  store: ResetStore;
  secret: string;
  now: () => number;
  /** Chalito's POST /tenants/:id/reset-devices; false when it didn't happen. */
  resetDevices: (userId: string) => Promise<boolean>;
}): Promise<ConfirmResult> => {
  const code = cleanResetCode(d.raw);
  if (!code) return { ok: false, reason: 'format' };
  const r = await d.store.consume(d.userId, hashResetCode(d.secret, d.userId, code), d.now());
  if (r !== 'ok') return { ok: false, reason: r };
  // The code is used up either way: if Chalito didn't take it, the person asks for a new one.
  if (!(await d.resetDevices(d.userId))) return { ok: false, reason: 'failed' };
  return { ok: true };
};
