// Resend transactional email wrapper.
//
// CONFIGURATION:
//   RESEND_API_KEY      — your Resend API key (re_...).
//                         Get from https://resend.com/api-keys
//   RESEND_FROM_EMAIL   — verified sender, e.g. "Chalyb <noreply@chalyb.com>".
//                         The production default below assumes chalyb.com is
//                         verified at Resend (DNS records green). If you're
//                         still in sandbox, override with onboarding@resend.dev
//                         (Resend's sandbox sender, limited to your own email).
//   RESEND_CONTACT_TO   — where the public /contacto form lands.
//                         Defaults to RESEND_FROM_EMAIL if unset.
//
// DEMO-MODE FALLBACK: if RESEND_API_KEY is missing, sendEmail() returns
// { ok: false, reason: 'not_configured' } instead of throwing. The contact
// form treats this as a "logged but not delivered" state so dev work isn't
// blocked on having credentials.
//
// SUPABASE AUTH EMAILS: those (signup confirm, reset password, magic link,
// invite, change email) go out via Supabase's custom-SMTP relay configured
// to point at Resend's SMTP endpoint. See docs/email/supabase-auth-setup.md.
// This wrapper handles ONLY emails sent from our own server code (contact
// form, payment receipts, future engine notifications).

import 'server-only';
import { Resend } from 'resend';

let cached: Resend | null = null;

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY missing');
  cached = new Resend(key);
  return cached;
}

// Production default — chalyb.com is verified at Resend. Keep this in
// sync with the sender set in Supabase Dashboard → Auth → SMTP so the
// "From" header looks identical across server-sent + auth-sent emails.
// Pre-domain-verification you can override via RESEND_FROM_EMAIL env var
// (set to "onboarding@resend.dev" for the sandbox limited-to-you mode).
const DEFAULT_FROM = 'Chalyb <noreply@chalyb.com>';

export function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM;
}

export function getContactInbox(): string {
  return process.env.RESEND_CONTACT_TO ?? getFromAddress();
}

interface SendParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  reason?: 'not_configured' | 'send_failed';
  error?: string;
}

export async function sendEmail(params: SendParams): Promise<SendResult> {
  if (!isResendConfigured()) {
    // Surface in dev so it's obvious why nothing arrived. Don't throw —
    // forms should still appear to succeed in dev when MP/Resend aren't set.
    console.warn('[resend] RESEND_API_KEY not set — email skipped:', params.subject);
    return { ok: false, reason: 'not_configured' };
  }
  try {
    const { data, error } = await getResend().emails.send({
      from: getFromAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });
    if (error) {
      console.error('[resend] send failed', error);
      return { ok: false, reason: 'send_failed', error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[resend] threw', err);
    return { ok: false, reason: 'send_failed', error: message };
  }
}
