'use server';

// Public contact form server action.
//
// Sends two emails per submission:
//   1. To the inbox (RESEND_CONTACT_TO) — the actual lead notification
//   2. To the sender — confirmation that we got it
//
// ANTI-SPAM:
//   - Honeypot field "company" — bots fill every input; humans never see this one.
//     If non-empty, we silently return ok=true (so the bot thinks it worked)
//     and never send anything.
//   - Soft rate limit: max 5 submissions per IP per 10 minutes, in-memory.
//     Reset on server restart — enough for v1 to deter casual abuse without
//     a Redis dependency.
//
// VALIDATION: simple string length checks. No external schema lib to keep the
// dependency surface tight. If a field is missing, return a field-specific
// error so the form can highlight it.

import { sendEmail, getContactInbox, isResendConfigured } from '@/lib/email/resend';
import { contactInboxTemplate, contactConfirmTemplate } from '@/lib/email/templates';
import { createAdminClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';

type ContactPane = 'client' | 'partner' | 'earn';
const VALID_PANES: ContactPane[] = ['client', 'partner', 'earn'];

export interface ContactResult {
  ok: boolean;
  /** Field name that failed validation, if any. */
  fieldError?: 'name' | 'email' | 'subject' | 'message';
  /** General error for toast display. */
  error?: string;
}

// In-memory rate-limit bucket. Key = IP, value = array of timestamps within window.
const rateBucket = new Map<string, number[]>();
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 min
const RATE_MAX = 5;

function checkRate(ip: string): boolean {
  const now = Date.now();
  const hist = (rateBucket.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hist.length >= RATE_MAX) return false;
  hist.push(now);
  rateBucket.set(ip, hist);
  return true;
}

// Basic email shape check — not full RFC, but rejects obvious garbage.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitContactForm(formData: FormData): Promise<ContactResult> {
  // Honeypot — silently swallow bot submissions.
  if (String(formData.get('company') ?? '').trim() !== '') {
    return { ok: true };
  }

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  // Pane tags the lead source (client / partner / earn). The contact form
  // can include a hidden <input name="pane"> set from the URL or the
  // currently-active landing tab. Default to 'client' for forms that don't
  // specify so behavior stays backward-compatible.
  const paneRaw = String(formData.get('pane') ?? 'client').trim().toLowerCase();
  const pane: ContactPane = VALID_PANES.includes(paneRaw as ContactPane)
    ? (paneRaw as ContactPane)
    : 'client';

  if (name.length < 2 || name.length > 120) {
    return { ok: false, fieldError: 'name', error: 'Nombre requerido (2–120 caracteres).' };
  }
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return { ok: false, fieldError: 'email', error: 'Correo inválido.' };
  }
  if (subject.length < 3 || subject.length > 200) {
    return { ok: false, fieldError: 'subject', error: 'Asunto requerido (3–200 caracteres).' };
  }
  if (message.length < 10 || message.length > 5000) {
    return { ok: false, fieldError: 'message', error: 'Mensaje requerido (10–5000 caracteres).' };
  }

  // Rate limit by best-guess IP. x-forwarded-for is what Vercel/most proxies set;
  // fall back to a literal so dev (no proxy) doesn't return undefined.
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'local';
  const userAgent = h.get('user-agent') ?? null;
  if (!checkRate(ip)) {
    return {
      ok: false,
      error: 'Recibimos muchos mensajes desde tu conexión. Espera unos minutos y vuelve a intentarlo.',
    };
  }

  // Templates live in src/lib/email/templates.ts — branded shell with dark
  // theme, Chalyb wordmark, acid-green accents. HTML escaping is handled inside.
  const inbox = contactInboxTemplate({ name, email, subject, message, ip });
  const confirm = contactConfirmTemplate({ name, subject, message });

  const inboxResult = await sendEmail({
    to: getContactInbox(),
    subject: `[Contacto] ${subject}`,
    html: inbox.html,
    text: inbox.text,
    replyTo: email,
  });

  // The confirmation is best-effort — if it fails we still mark the form as
  // successful because the lead made it to the inbox (the important half).
  await sendEmail({
    to: email,
    subject: 'Recibimos tu mensaje · Chalyb',
    html: confirm.html,
    text: confirm.text,
  });

  if (!inboxResult.ok && inboxResult.reason !== 'not_configured') {
    return { ok: false, error: 'No pudimos enviar tu mensaje. Vuelve a intentarlo en unos minutos.' };
  }

  // Persist to partner_inquiries so the admin inbox shows it even if the
  // notification email goes to spam / Resend is down. The table holds every
  // pane (client / partner / earn) — the pane column tags origin. We use
  // the service-role client because anon writes are blocked by RLS (only
  // admins read, only this server action writes).
  //
  // Best-effort: log + ignore failures. Losing the row is bad UX but the
  // email is the primary delivery channel — don't fail the submission
  // because a DB blip happened.
  try {
    const admin = createAdminClient();
    const { error: dbError } = await admin.from('partner_inquiries').insert({
      name,
      email,
      message: subject ? `${subject}\n\n${message}` : message,
      pane,
      ip_addr: ip === 'local' ? null : ip,
      user_agent: userAgent,
    });
    if (dbError) {
      console.warn('[contact] partner_inquiries insert failed:', dbError.message);
    }
  } catch (e) {
    console.warn(
      '[contact] partner_inquiries insert threw:',
      e instanceof Error ? e.message : String(e),
    );
  }

  // If Resend isn't configured (dev), still return ok — the warning in the
  // server log makes it visible. UX wise the user gets the success state.
  if (!isResendConfigured()) {
    console.warn('[contact] Resend not configured — form submission accepted but no email sent.');
  }

  return { ok: true };
}
