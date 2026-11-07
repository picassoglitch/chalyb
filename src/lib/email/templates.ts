// Branded transactional email templates.
//
// All templates share a single shell (`wrap()`) that renders the Chalyb
// header + body + footer with consistent styling. We use inline styles
// because Gmail strips <style> tags and many clients don't apply external
// CSS. Dark-mode media query at the top inverts colors automatically in
// modern Gmail / Apple Mail; older clients fall back to the light theme.
//
// Color palette is the brand: the mark's gold (#e8bb7f) on near-black bg.
// We use system fonts (no Google Fonts in email — too unreliable).

import { escapeHtml } from './escape';

/** The language of a customer email: the account's (profiles.preferred_locale)
 *  or the page it came from. Anything else is Spanish, the default. */
export type EmailLocale = 'es' | 'en';

export function emailLocale(raw: unknown): EmailLocale {
  return raw === 'en' ? 'en' : 'es';
}

/** An app path in the email's language (English lives under /en). */
function appPath(appUrl: string, path: string, locale: EmailLocale): string {
  return `${appUrl}${locale === 'en' ? '/en' : ''}${path}`;
}

const FOOTER: Record<EmailLocale, { tagline: string; ignore: string }> = {
  es: {
    tagline: 'tu equipo de AI que trabaja solo',
    ignore: 'Si este correo te llegó por error, ignóralo — no tienes que hacer nada.',
  },
  en: {
    tagline: 'your AI team that works on its own',
    ignore: 'If this email reached you by mistake, ignore it — there is nothing you need to do.',
  },
};

const BRAND_ACCENT = '#e8bb7f';
const BG_DARK = '#06070b';
const BG_PANEL = '#0f1218';
const INK_PRIMARY = '#f4f3ee';
const INK_DIM = '#b9b9c4';
const INK_FAINT = '#6c6d7c';
const LINE = '#1f2230';

/** Wrap content in the branded shell. `preview` shows in the inbox preview text. */
export function wrap(opts: {
  title: string;
  preview: string;
  body: string;
  locale?: EmailLocale;
}): string {
  const locale = opts.locale ?? 'es';
  const foot = FOOTER[locale];
  return `<!DOCTYPE html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <title>${escapeHtml(opts.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BG_DARK};color:${INK_PRIMARY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <!-- Inbox preview text (hidden in body, visible in client list) -->
    <div style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;overflow:hidden;opacity:0;color:${BG_DARK};">${escapeHtml(opts.preview)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_DARK};">
      <tr>
        <td align="center" style="padding:36px 16px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

            <!-- Header: brand mark + wordmark -->
            <tr>
              <td style="padding:0 28px 24px;">
                <div style="font-size:16px;font-weight:700;letter-spacing:-0.01em;color:${INK_PRIMARY};">
                  CHALYB
                </div>
              </td>
            </tr>

            <!-- Body panel -->
            <tr>
              <td style="background:${BG_PANEL};border:1px solid ${LINE};border-radius:14px;padding:32px 28px;">
                ${opts.body}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 28px 40px;font-size:11.5px;color:${INK_FAINT};line-height:1.55;font-family:'SF Mono',Menlo,Consolas,monospace;">
                Chalyb · ${foot.tagline} · <a href="https://chalyb.com" style="color:${INK_FAINT};text-decoration:underline;">chalyb.com</a>
                <br />
                ${foot.ignore}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────────────
// CONTACT FORM — inbox notification (to RESEND_CONTACT_TO)
// ──────────────────────────────────────────────────────────────────────────
export function contactInboxTemplate(opts: {
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string;
}): { html: string; text: string } {
  const body = `
    <h1 style="margin:0 0 4px;font-size:20px;font-weight:600;letter-spacing:-0.01em;color:${INK_PRIMARY};">
      Nuevo mensaje de contacto
    </h1>
    <p style="margin:0 0 24px;font-size:13px;color:${INK_DIM};">
      Llegó desde el formulario de /contacto
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:13.5px;">
      <tr>
        <td style="padding:8px 0;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;width:90px;vertical-align:top;">De</td>
        <td style="padding:8px 0;color:${INK_PRIMARY};">
          <strong>${escapeHtml(opts.name)}</strong> &nbsp;
          <a href="mailto:${escapeHtml(opts.email)}" style="color:${BRAND_ACCENT};text-decoration:none;">${escapeHtml(opts.email)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;vertical-align:top;">Asunto</td>
        <td style="padding:8px 0;color:${INK_PRIMARY};">${escapeHtml(opts.subject)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:18px 0 8px;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;">
          Mensaje
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:0 0 8px;">
          <div style="border-left:3px solid ${BRAND_ACCENT};padding:12px 16px;background:${BG_DARK};border-radius:0 8px 8px 0;color:${INK_PRIMARY};font-size:13.5px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(opts.message)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 0 0;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;vertical-align:top;">IP</td>
        <td style="padding:18px 0 0;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;">${escapeHtml(opts.ip)}</td>
      </tr>
    </table>

    <p style="margin:24px 0 0;padding:14px 16px;background:${BG_DARK};border-radius:8px;font-size:11.5px;color:${INK_FAINT};line-height:1.5;">
      ▸ Responde directo a este correo y tu respuesta le llega a quien escribió.
    </p>
  `;

  const text = `Nuevo mensaje de contacto · Chalyb

De: ${opts.name} <${opts.email}>
Asunto: ${opts.subject}

${opts.message}

— IP: ${opts.ip}
Responde directo a este correo.`;

  return {
    html: wrap({
      title: `[Contacto] ${opts.subject}`,
      preview: `${opts.name}: ${opts.message.slice(0, 80)}`,
      body,
    }),
    text,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// CONTACT FORM — confirmation (to the sender)
// ──────────────────────────────────────────────────────────────────────────
const CONTACT_CONFIRM = {
  es: {
    h1: 'Recibimos tu mensaje',
    thanks: (name: string) =>
      `Gracias por escribirnos, <strong style="color:${INK_PRIMARY};">${name}</strong>. Tu mensaje ya nos llegó con el asunto:`,
    subject: 'Asunto',
    yours: 'Tu mensaje',
    reply: `Te respondemos en <strong style="color:${BRAND_ACCENT};">menos de 24 horas hábiles</strong>.`,
    notYou:
      'Si tú no enviaste este mensaje, quizá alguien escribió tu correo por error. Puedes ignorar este correo sin hacer nada — no te abrimos cuenta ni te suscribimos a nada.',
    text: (name: string, subject: string, message: string) => `Hola ${name},

Recibimos tu mensaje con el asunto "${subject}".

Tu mensaje:
${message}

Te respondemos en menos de 24 horas hábiles.

— Chalyb · chalyb.com`,
    title: 'Recibimos tu mensaje · Chalyb',
    preview: (subject: string) => `Tu mensaje "${subject}" llegó. Respondemos en menos de 24h.`,
  },
  en: {
    h1: 'We got your message',
    thanks: (name: string) =>
      `Thanks for writing to us, <strong style="color:${INK_PRIMARY};">${name}</strong>. Your message reached us with the subject:`,
    subject: 'Subject',
    yours: 'Your message',
    reply: `We’ll reply within <strong style="color:${BRAND_ACCENT};">24 business hours</strong>.`,
    notYou:
      'If you didn’t send this message, someone may have typed your email by mistake. You can ignore this email — we didn’t open an account or subscribe you to anything.',
    text: (name: string, subject: string, message: string) => `Hi ${name},

We got your message with the subject "${subject}".

Your message:
${message}

We’ll reply within 24 business hours.

— Chalyb · chalyb.com`,
    title: 'We got your message · Chalyb',
    preview: (subject: string) => `Your message "${subject}" arrived. We reply within 24h.`,
  },
} as const;

/** Subject line of the contact confirmation. */
export function contactConfirmSubject(locale: EmailLocale = 'es'): string {
  return CONTACT_CONFIRM[locale].title;
}

export function contactConfirmTemplate(opts: {
  name: string;
  subject: string;
  message: string;
  locale?: EmailLocale;
}): { html: string; text: string } {
  const locale = opts.locale ?? 'es';
  const c = CONTACT_CONFIRM[locale];
  const body = `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:600;letter-spacing:-0.015em;color:${INK_PRIMARY};">
      ${c.h1}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${INK_DIM};line-height:1.55;">
      ${c.thanks(escapeHtml(opts.name))}
    </p>

    <div style="padding:14px 18px;background:${BG_DARK};border:1px solid ${LINE};border-radius:8px;margin-bottom:24px;">
      <div style="font-size:11px;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">${c.subject}</div>
      <div style="font-size:14.5px;color:${INK_PRIMARY};font-weight:500;">${escapeHtml(opts.subject)}</div>
    </div>

    <p style="margin:0 0 8px;font-size:11px;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:0.08em;text-transform:uppercase;">
      ${c.yours}
    </p>
    <div style="border-left:3px solid ${BRAND_ACCENT};padding:12px 16px;background:${BG_DARK};border-radius:0 8px 8px 0;color:${INK_DIM};font-size:13.5px;line-height:1.6;white-space:pre-wrap;margin-bottom:24px;">${escapeHtml(opts.message)}</div>

    <p style="margin:0;font-size:14px;color:${INK_PRIMARY};line-height:1.55;">
      ${c.reply}
    </p>

    <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${LINE};font-size:12px;color:${INK_FAINT};line-height:1.55;">
      ${c.notYou}
    </p>
  `;

  return {
    html: wrap({ title: c.title, preview: c.preview(opts.subject), body, locale }),
    text: c.text(opts.name, opts.subject, opts.message),
  };
}

/** The copy is written for Mercado Pago; a Stripe charge gets the same words naming Stripe. */
function forGateway<T extends { html: string; text: string }>(
  gateway: 'mercadopago' | 'stripe' | undefined,
  out: T,
): T {
  if (gateway !== 'stripe') return out;
  return {
    ...out,
    html: out.html.replaceAll('Mercado Pago', 'Stripe'),
    text: out.text.replaceAll('Mercado Pago', 'Stripe'),
  };
}

// Shared bits of the payment emails.
const PAY = {
  es: {
    amount: 'Monto',
    mpPaymentId: 'ID de pago Mercado Pago',
    help: (contact: string) =>
      `¿Necesitas factura fiscal o tienes una duda sobre el cobro? Escríbenos respondiendo este correo o desde <a href="${contact}" style="color:${INK_DIM};text-decoration:underline;">/contacto</a>.`,
  },
  en: {
    amount: 'Amount',
    mpPaymentId: 'Mercado Pago payment ID',
    help: (contact: string) =>
      `Need a tax invoice (CFDI) or have a question about the charge? Reply to this email or write to us from <a href="${contact}" style="color:${INK_DIM};text-decoration:underline;">our contact page</a>.`,
  },
} as const;

function label(text: string): string {
  return `<div style="font-size:11px;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">${text}</div>`;
}

function pill(text: string, color = BRAND_ACCENT, bg = 'rgba(198,242,78,0.12)'): string {
  return `<div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;padding:6px 14px;background:${bg};border:1px solid ${color};border-radius:100px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:${color};">
        ● ${text}
      </div>
    </div>`;
}

function button(href: string, text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
      <tr>
        <td style="background:${BRAND_ACCENT};border-radius:9px;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 28px;color:#070809;text-decoration:none;font-weight:600;font-size:14px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

// ──────────────────────────────────────────────────────────────────────────
// PAYMENT SUCCESS — sent from MP webhook when tier activates
// ──────────────────────────────────────────────────────────────────────────
const PAYMENT_SUCCESS = {
  es: {
    pill: 'Pago aprobado',
    h1: (tier: string) => `Tu plan <span style="color:${BRAND_ACCENT};">${tier}</span> está activo`,
    lead: 'Mercado Pago confirmó tu pago. Ya puedes usar todo lo que trae tu nuevo plan.',
    cta: 'Ver mi cuenta →',
    text: (tier: string, amount: string, id: string, url: string) => `¡Tu plan ${tier} está activo!

Mercado Pago confirmó tu pago de ${amount}.
ID de pago: ${id}

Ver mi cuenta: ${url}

— Chalyb`,
    title: (tier: string) => `Tu plan ${tier} está activo · Chalyb`,
    preview: (tier: string) => `Mercado Pago confirmó tu pago. Plan ${tier} activado.`,
  },
  en: {
    pill: 'Payment approved',
    h1: (tier: string) => `Your <span style="color:${BRAND_ACCENT};">${tier}</span> plan is active`,
    lead: 'Mercado Pago confirmed your payment. You can now use everything your new plan includes.',
    cta: 'Go to my account →',
    text: (tier: string, amount: string, id: string, url: string) => `Your ${tier} plan is active!

Mercado Pago confirmed your payment of ${amount}.
Payment ID: ${id}

Go to my account: ${url}

— Chalyb`,
    title: (tier: string) => `Your ${tier} plan is active · Chalyb`,
    preview: (tier: string) => `Mercado Pago confirmed your payment. ${tier} plan activated.`,
  },
} as const;

export function paymentSuccessTemplate(opts: {
  tier: string; // 'Pro' | 'VIP' (pretty label)
  amountMajor: string; // e.g. '749.00'
  currency: string; // 'MXN'
  paymentId: string;
  appUrl: string; // for the "Abrir mi cuenta" button
  locale?: EmailLocale;
}): { html: string; text: string } {
  const locale = opts.locale ?? 'es';
  const c = PAYMENT_SUCCESS[locale];
  const p = PAY[locale];
  const accountUrl = appPath(opts.appUrl, '/app/billing', locale);
  const body = `
    ${pill(c.pill)}

    <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;letter-spacing:-0.015em;color:${INK_PRIMARY};text-align:center;">
      ${c.h1(escapeHtml(opts.tier))}
    </h1>

    <p style="margin:0 0 28px;font-size:14px;color:${INK_DIM};line-height:1.55;text-align:center;">
      ${c.lead}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${BG_DARK};border-radius:10px;margin-bottom:28px;">
      <tr>
        <td style="padding:14px 18px;border-bottom:1px solid ${LINE};">
          ${label(p.amount)}
          <div style="font-size:18px;color:${INK_PRIMARY};font-weight:600;">$${escapeHtml(opts.amountMajor)} ${escapeHtml(opts.currency)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 18px;">
          ${label(p.mpPaymentId)}
          <div style="font-size:13px;color:${INK_DIM};font-family:'SF Mono',Menlo,Consolas,monospace;">${escapeHtml(opts.paymentId)}</div>
        </td>
      </tr>
    </table>

    ${button(accountUrl, c.cta)}

    <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${LINE};font-size:12px;color:${INK_FAINT};line-height:1.55;text-align:center;">
      ${p.help(escapeHtml(appPath(opts.appUrl, '/contacto', locale)))}
    </p>
  `;

  return {
    html: wrap({ title: c.title(opts.tier), preview: c.preview(opts.tier), body, locale }),
    text: c.text(opts.tier, `$${opts.amountMajor} ${opts.currency}`, opts.paymentId, accountUrl),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION ACTIVE — sent from the MP webhook when a preapproval is
// authorised (the monthly charge is now on). Different from the one-off
// payment mail above: this one says what will be charged, when, and how to
// stop it.
// ──────────────────────────────────────────────────────────────────────────
const SUBSCRIPTION_ACTIVE = {
  es: {
    inAMonth: 'en un mes',
    pill: 'Suscripción activa',
    h1: (tier: string) =>
      `Tu plan <span style="color:${BRAND_ACCENT};">${tier}</span> ya está activo`,
    lead: 'Mercado Pago autorizó el cobro mensual. Se renueva solo; puedes cancelarlo cuando quieras desde tu cuenta y conservas el plan hasta el final del período que ya pagaste.',
    monthly: 'Cobro mensual',
    next: 'Próximo cobro',
    mpId: 'ID de suscripción Mercado Pago',
    cta: 'Ver mi suscripción →',
    text: (tier: string, amount: string, next: string, id: string, url: string) =>
      `Tu plan ${tier} ya está activo.

Mercado Pago autorizó el cobro mensual de ${amount}.
Próximo cobro: ${next}
ID de suscripción: ${id}

Se renueva solo; cancela cuando quieras desde ${url} y conservas el plan hasta el final del período pagado.

— Chalyb`,
    title: (tier: string) => `Tu plan ${tier} está activo · Chalyb`,
    preview: (tier: string) => `Mercado Pago autorizó el cobro mensual. Plan ${tier} activado.`,
  },
  en: {
    inAMonth: 'in one month',
    pill: 'Subscription active',
    h1: (tier: string) => `Your <span style="color:${BRAND_ACCENT};">${tier}</span> plan is now active`,
    lead: 'Mercado Pago authorized the monthly charge. It renews on its own; you can cancel anytime from your account and you keep the plan until the end of the period you already paid for.',
    monthly: 'Monthly charge',
    next: 'Next charge',
    mpId: 'Mercado Pago subscription ID',
    cta: 'See my subscription →',
    text: (tier: string, amount: string, next: string, id: string, url: string) =>
      `Your ${tier} plan is now active.

Mercado Pago authorized the monthly charge of ${amount}.
Next charge: ${next}
Subscription ID: ${id}

It renews on its own; cancel anytime from ${url} and you keep the plan until the end of the paid period.

— Chalyb`,
    title: (tier: string) => `Your ${tier} plan is active · Chalyb`,
    preview: (tier: string) => `Mercado Pago authorized the monthly charge. ${tier} plan activated.`,
  },
} as const;

/** Subject line of the subscription-active email. */
export function subscriptionActiveSubject(tier: string, locale: EmailLocale = 'es'): string {
  return SUBSCRIPTION_ACTIVE[locale].title(tier);
}

export function subscriptionActiveTemplate(opts: {
  tier: string; // 'Pro' | 'VIP' (pretty label)
  amountMajor: string; // monthly charge, e.g. '749.00'
  currency: string; // 'MXN'
  /** "15 de octubre de 2026" — already formatted in `locale`, or null when MP gave none. */
  nextChargeLabel: string | null;
  preapprovalId: string;
  appUrl: string;
  locale?: EmailLocale;
  /** The gateway; the copy names Mercado Pago unless it is Stripe. */
  gateway?: 'mercadopago' | 'stripe';
}): { html: string; text: string } {
  const locale = opts.locale ?? 'es';
  const c = SUBSCRIPTION_ACTIVE[locale];
  const next = opts.nextChargeLabel ?? c.inAMonth;
  const subUrl = appPath(opts.appUrl, '/app/subscription', locale);
  const body = `
    ${pill(c.pill)}

    <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;letter-spacing:-0.015em;color:${INK_PRIMARY};text-align:center;">
      ${c.h1(escapeHtml(opts.tier))}
    </h1>

    <p style="margin:0 0 28px;font-size:14px;color:${INK_DIM};line-height:1.55;text-align:center;">
      ${c.lead}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${BG_DARK};border-radius:10px;margin-bottom:28px;">
      <tr>
        <td style="padding:14px 18px;border-bottom:1px solid ${LINE};">
          ${label(c.monthly)}
          <div style="font-size:18px;color:${INK_PRIMARY};font-weight:600;">$${escapeHtml(opts.amountMajor)} ${escapeHtml(opts.currency)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 18px;border-bottom:1px solid ${LINE};">
          ${label(c.next)}
          <div style="font-size:13px;color:${INK_DIM};">${escapeHtml(next)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 18px;">
          ${label(c.mpId)}
          <div style="font-size:13px;color:${INK_DIM};font-family:'SF Mono',Menlo,Consolas,monospace;">${escapeHtml(opts.preapprovalId)}</div>
        </td>
      </tr>
    </table>

    ${button(subUrl, c.cta)}

    <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${LINE};font-size:12px;color:${INK_FAINT};line-height:1.55;text-align:center;">
      ${PAY[locale].help(escapeHtml(appPath(opts.appUrl, '/contacto', locale)))}
    </p>
  `;

  return forGateway(opts.gateway, {
    html: wrap({ title: c.title(opts.tier), preview: c.preview(opts.tier), body, locale }),
    text: c.text(
      opts.tier,
      `$${opts.amountMajor} ${opts.currency}`,
      next,
      opts.preapprovalId,
      subUrl,
    ),
  });
}

// ──────────────────────────────────────────────────────────────────────────
// PAYMENT REVERSED — sent from the MP webhook when a refund or chargeback
// takes back what a payment had bought (a token pack, or a plan).
// ──────────────────────────────────────────────────────────────────────────
const PAYMENT_REVERSED = {
  es: {
    why: { charged_back: 'tu banco revirtió el cargo (contracargo)', refunded: 'el pago fue reembolsado' },
    pill: 'Pago revertido',
    h1: (what: string) => `Retiramos ${what}`,
    lead: (why: string) =>
      `Mercado Pago nos avisó que ${why}. Como el dinero volvió a tu cuenta, lo que ese pago había comprado ya no está activo.`,
    amount: 'Monto revertido',
    mistake: (contact: string) =>
      `¿Fue un error? Escríbenos respondiendo este correo o desde <a href="${contact}" style="color:${INK_DIM};text-decoration:underline;">/contacto</a> y lo revisamos.`,
    text: (what: string, why: string, amount: string, id: string, contact: string) =>
      `Retiramos ${what}.

Mercado Pago nos avisó que ${why}: ${amount}, pago ${id}.
Como el dinero volvió a tu cuenta, lo que ese pago había comprado ya no está activo.

¿Fue un error? Escríbenos: ${contact}

— Chalyb`,
    title: 'Pago revertido · Chalyb',
    preview: (what: string) => `Mercado Pago revirtió un pago; retiramos ${what}.`,
  },
  en: {
    why: { charged_back: 'your bank reversed the charge (chargeback)', refunded: 'the payment was refunded' },
    pill: 'Payment reversed',
    h1: (what: string) => `We removed ${what}`,
    lead: (why: string) =>
      `Mercado Pago let us know that ${why}. Since the money went back to you, what that payment bought is no longer active.`,
    amount: 'Amount reversed',
    mistake: (contact: string) =>
      `Was this a mistake? Reply to this email or write to us from <a href="${contact}" style="color:${INK_DIM};text-decoration:underline;">our contact page</a> and we’ll look into it.`,
    text: (what: string, why: string, amount: string, id: string, contact: string) =>
      `We removed ${what}.

Mercado Pago let us know that ${why}: ${amount}, payment ${id}.
Since the money went back to you, what that payment bought is no longer active.

Was this a mistake? Write to us: ${contact}

— Chalyb`,
    title: 'Payment reversed · Chalyb',
    preview: (what: string) => `Mercado Pago reversed a payment; we removed ${what}.`,
  },
} as const;

export function paymentReversedTemplate(opts: {
  /** 'refunded' | 'charged_back' */
  reason: 'refunded' | 'charged_back';
  /** What was taken back, already worded in `locale`: "100,000 unused credits". */
  what: string;
  amountMajor: string;
  currency: string;
  paymentId: string;
  appUrl: string;
  locale?: EmailLocale;
  /** The gateway; the copy names Mercado Pago unless it is Stripe. */
  gateway?: 'mercadopago' | 'stripe';
}): { html: string; text: string } {
  const locale = opts.locale ?? 'es';
  const c = PAYMENT_REVERSED[locale];
  const why = c.why[opts.reason];
  const contact = appPath(opts.appUrl, '/contacto', locale);
  const body = `
    ${pill(c.pill, '#f5b13d', 'rgba(245,177,61,0.12)')}

    <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;letter-spacing:-0.015em;color:${INK_PRIMARY};text-align:center;">
      ${c.h1(escapeHtml(opts.what))}
    </h1>

    <p style="margin:0 0 28px;font-size:14px;color:${INK_DIM};line-height:1.55;text-align:center;">
      ${c.lead(why)}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${BG_DARK};border-radius:10px;margin-bottom:28px;">
      <tr>
        <td style="padding:14px 18px;border-bottom:1px solid ${LINE};">
          ${label(c.amount)}
          <div style="font-size:18px;color:${INK_PRIMARY};font-weight:600;">$${escapeHtml(opts.amountMajor)} ${escapeHtml(opts.currency)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 18px;">
          ${label(PAY[locale].mpPaymentId)}
          <div style="font-size:13px;color:${INK_DIM};font-family:'SF Mono',Menlo,Consolas,monospace;">${escapeHtml(opts.paymentId)}</div>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${LINE};font-size:12px;color:${INK_FAINT};line-height:1.55;text-align:center;">
      ${c.mistake(escapeHtml(contact))}
    </p>
  `;

  return forGateway(opts.gateway, {
    html: wrap({ title: c.title, preview: c.preview(opts.what), body, locale }),
    text: c.text(opts.what, why, `$${opts.amountMajor} ${opts.currency}`, opts.paymentId, contact),
  });
}

// ─────────────────────────────────────────────────────────────────────
// CHALITO — "Empezar de cero" code (src/lib/chalito/reset.ts)
// ─────────────────────────────────────────────────────────────────────
const CHALITO_RESET = {
  es: {
    h1: 'Tu código para empezar de cero en Chalito',
    lead: 'Escríbelo en Chalito para retirar todos tus dispositivos y activar el navegador que estás usando. Vence en 10 minutos.',
    chats:
      'Tus chats anteriores están cifrados con las llaves de esos dispositivos, así que no podrás verlos desde el nuevo.',
    notYou:
      'Si tú no lo pediste, no compartas este código con nadie y cambia la contraseña de tu cuenta de Chalyb. Sin el código nadie puede retirar tus dispositivos.',
    textNotYou:
      'Si tú no lo pediste, no compartas este código con nadie y cambia la contraseña de tu cuenta de Chalyb.',
    textHead: (code: string) => `Tu código para empezar de cero en Chalito: ${code}`,
    title: 'Tu código de Chalito',
    preview: (code: string) => `Tu código: ${code}`,
    subject: (code: string) => `Tu código de Chalito: ${code}`,
  },
  en: {
    h1: 'Your code to start over in Chalito',
    lead: 'Type it in Chalito to remove all your devices and activate the browser you are using. It expires in 10 minutes.',
    chats:
      'Your earlier chats are encrypted with those devices’ keys, so you won’t be able to see them from the new one.',
    notYou:
      'If you didn’t ask for this, don’t share this code with anyone and change your Chalyb password. Without the code, nobody can remove your devices.',
    textNotYou:
      'If you didn’t ask for this, don’t share this code with anyone and change your Chalyb password.',
    textHead: (code: string) => `Your code to start over in Chalito: ${code}`,
    title: 'Your Chalito code',
    preview: (code: string) => `Your code: ${code}`,
    subject: (code: string) => `Your Chalito code: ${code}`,
  },
} as const;

/** Subject line of the Chalito reset-code email. */
export function chalitoResetCodeSubject(code: string, locale: EmailLocale = 'es'): string {
  return CHALITO_RESET[locale].subject(code);
}

export function chalitoResetCodeTemplate(opts: { code: string; locale?: EmailLocale }): {
  html: string;
  text: string;
} {
  const locale = opts.locale ?? 'es';
  const c = CHALITO_RESET[locale];
  const body = `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:600;letter-spacing:-0.015em;color:${INK_PRIMARY};">
      ${c.h1}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${INK_DIM};line-height:1.55;">
      ${c.lead}
    </p>

    <div style="padding:18px;background:${BG_DARK};border:1px solid ${LINE};border-radius:8px;margin-bottom:24px;text-align:center;">
      <div style="font-size:32px;letter-spacing:0.3em;font-weight:700;color:${BRAND_ACCENT};font-family:'SF Mono',Menlo,Consolas,monospace;">${escapeHtml(opts.code)}</div>
    </div>

    <p style="margin:0;font-size:14px;color:${INK_PRIMARY};line-height:1.55;">
      ${c.chats}
    </p>

    <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${LINE};font-size:12px;color:${INK_FAINT};line-height:1.55;">
      ${c.notYou}
    </p>
  `;

  const text = `${c.textHead(opts.code)}

${c.lead}

${c.chats}

${c.textNotYou}`;

  return {
    html: wrap({ title: c.title, preview: c.preview(opts.code), body, locale }),
    text,
  };
}
