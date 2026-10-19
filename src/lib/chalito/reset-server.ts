// Server wiring for "Empezar de cero" (src/lib/chalito/reset.ts): the code store (migration 0069),
// the email, and Chalito's POST {admin_api_base}/tenants/:id/reset-devices.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';
import { chalitoResetCodeTemplate } from '@/lib/email/templates';
import type { ConsumeResult, ResetStore } from './reset';

/** HMAC key for the stored codes (domain-separated inside hashResetCode). */
export const resetSecret = (): string | null => process.env.CHALITO_SSO_SECRET || null;

const rpcText = async (fn: string, args: Record<string, unknown>): Promise<string> => {
  const { data, error } = await createAdminClient().rpc(fn, args);
  if (error || typeof data !== 'string') throw new Error(`[chalito-reset] ${fn} failed`);
  return data;
};

export const resetStore: ResetStore = {
  issue: async (userId, hash, expiresAt, now) =>
    (await rpcText('chalito_reset_issue', {
      p_user: userId,
      p_hash: hash,
      p_expires: new Date(expiresAt).toISOString(),
      p_now: new Date(now).toISOString(),
    })) as 'ok' | 'rate_limited',
  consume: async (userId, hash, now) =>
    (await rpcText('chalito_reset_consume', {
      p_user: userId,
      p_hash: hash,
      p_now: new Date(now).toISOString(),
    })) as ConsumeResult,
};

export const sendResetCode = async (to: string, code: string): Promise<boolean> => {
  const { html, text } = chalitoResetCodeTemplate({ code });
  const r = await sendEmail({ to, subject: `Tu código de Chalito: ${code}`, html, text });
  return r.ok;
};

/** Chalito retires every device of the account; false when it didn't (not configured, refused, down). */
export const resetChalitoDevices = async (userId: string): Promise<boolean> => {
  const token = process.env.CHALITO_ADMIN_TOKEN;
  const { data: engine } = await createAdminClient()
    .from('engines')
    .select('admin_api_base')
    .eq('slug', 'chalito')
    .maybeSingle();
  const base = (engine?.admin_api_base as string | null | undefined)?.replace(/\/+$/, '');
  if (!token || !base) return false;
  try {
    const r = await fetch(`${base}/tenants/${encodeURIComponent(userId)}/reset-devices`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    return r.ok;
  } catch {
    return false;
  }
};
