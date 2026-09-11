// Branded transactional email templates.
//
// All templates share a single shell (`wrap()`) that renders the Chalyb
// header + body + footer with consistent styling. We use inline styles
// because Gmail strips <style> tags and many clients don't apply external
// CSS. Dark-mode media query at the top inverts colors automatically in
// modern Gmail / Apple Mail; older clients fall back to the light theme.
//
// Color palette is the brand: acid green (#c6f24e) accent on near-black bg.
// We use system fonts (no Google Fonts in email — too unreliable).

import { escapeHtml } from './escape';

const BRAND_ACCENT = '#c6f24e';
const BG_DARK = '#06070b';
const BG_PANEL = '#0f1218';
const INK_PRIMARY = '#f4f3ee';
const INK_DIM = '#b9b9c4';
const INK_FAINT = '#6c6d7c';
const LINE = '#1f2230';

/** Wrap content in the branded shell. `preview` shows in the inbox preview text. */
function wrap(opts: { title: string; preview: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
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
                Chalyb · tu equipo de AI que trabaja solo · <a href="https://chalyb.com" style="color:${INK_FAINT};text-decoration:underline;">chalyb.com</a>
                <br />
                Si este correo te llegó por error, ignóralo — no tienes que hacer nada.
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
export function contactConfirmTemplate(opts: {
  name: string;
  subject: string;
  message: string;
}): { html: string; text: string } {
  const body = `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:600;letter-spacing:-0.015em;color:${INK_PRIMARY};">
      Recibimos tu mensaje
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${INK_DIM};line-height:1.55;">
      Gracias por escribirnos, <strong style="color:${INK_PRIMARY};">${escapeHtml(opts.name)}</strong>. Tu mensaje ya nos llegó con el asunto:
    </p>

    <div style="padding:14px 18px;background:${BG_DARK};border:1px solid ${LINE};border-radius:8px;margin-bottom:24px;">
      <div style="font-size:11px;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Asunto</div>
      <div style="font-size:14.5px;color:${INK_PRIMARY};font-weight:500;">${escapeHtml(opts.subject)}</div>
    </div>

    <p style="margin:0 0 8px;font-size:11px;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:0.08em;text-transform:uppercase;">
      Tu mensaje
    </p>
    <div style="border-left:3px solid ${BRAND_ACCENT};padding:12px 16px;background:${BG_DARK};border-radius:0 8px 8px 0;color:${INK_DIM};font-size:13.5px;line-height:1.6;white-space:pre-wrap;margin-bottom:24px;">${escapeHtml(opts.message)}</div>

    <p style="margin:0;font-size:14px;color:${INK_PRIMARY};line-height:1.55;">
      Te respondemos en <strong style="color:${BRAND_ACCENT};">menos de 24 horas hábiles</strong>.
    </p>

    <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${LINE};font-size:12px;color:${INK_FAINT};line-height:1.55;">
      Si tú no enviaste este mensaje, quizá alguien escribió tu correo por error. Puedes ignorar este correo sin hacer nada — no te abrimos cuenta ni te suscribimos a nada.
    </p>
  `;

  const text = `Hola ${opts.name},

Recibimos tu mensaje con el asunto "${opts.subject}".

Tu mensaje:
${opts.message}

Te respondemos en menos de 24 horas hábiles.

— Chalyb · chalyb.com`;

  return {
    html: wrap({
      title: 'Recibimos tu mensaje · Chalyb',
      preview: `Tu mensaje "${opts.subject}" llegó. Respondemos en menos de 24h.`,
      body,
    }),
    text,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// PAYMENT SUCCESS — sent from MP webhook when tier activates
// ──────────────────────────────────────────────────────────────────────────
export function paymentSuccessTemplate(opts: {
  tier: string; // 'Pro' | 'VIP' (pretty label)
  amountMajor: string; // e.g. '749.00'
  currency: string; // 'MXN'
  paymentId: string;
  appUrl: string; // for the "Abrir mi cuenta" button
}): { html: string; text: string } {
  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;padding:6px 14px;background:rgba(198,242,78,0.12);border:1px solid ${BRAND_ACCENT};border-radius:100px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:${BRAND_ACCENT};">
        ● Pago aprobado
      </div>
    </div>

    <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;letter-spacing:-0.015em;color:${INK_PRIMARY};text-align:center;">
      Tu plan <span style="color:${BRAND_ACCENT};">${escapeHtml(opts.tier)}</span> está activo
    </h1>

    <p style="margin:0 0 28px;font-size:14px;color:${INK_DIM};line-height:1.55;text-align:center;">
      Mercado Pago confirmó tu pago. Ya puedes usar todo lo que trae tu nuevo plan.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${BG_DARK};border-radius:10px;margin-bottom:28px;">
      <tr>
        <td style="padding:14px 18px;border-bottom:1px solid ${LINE};">
          <div style="font-size:11px;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Monto</div>
          <div style="font-size:18px;color:${INK_PRIMARY};font-weight:600;">$${escapeHtml(opts.amountMajor)} ${escapeHtml(opts.currency)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 18px;">
          <div style="font-size:11px;color:${INK_FAINT};font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">ID de pago Mercado Pago</div>
          <div style="font-size:13px;color:${INK_DIM};font-family:'SF Mono',Menlo,Consolas,monospace;">${escapeHtml(opts.paymentId)}</div>
        </td>
      </tr>
    </table>

    <!-- CTA button — bulletproof button pattern for max client support -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
      <tr>
        <td style="background:${BRAND_ACCENT};border-radius:9px;">
          <a href="${escapeHtml(opts.appUrl)}/app/billing" style="display:inline-block;padding:13px 28px;color:#070809;text-decoration:none;font-weight:600;font-size:14px;">
            Ver mi cuenta →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${LINE};font-size:12px;color:${INK_FAINT};line-height:1.55;text-align:center;">
      ¿Necesitas factura fiscal o tienes una duda sobre el cobro? Escríbenos respondiendo este correo o desde <a href="${escapeHtml(opts.appUrl)}/contacto" style="color:${INK_DIM};text-decoration:underline;">/contacto</a>.
    </p>
  `;

  const text = `¡Tu plan ${opts.tier} está activo!

Mercado Pago confirmó tu pago de $${opts.amountMajor} ${opts.currency}.
ID de pago: ${opts.paymentId}

Ver mi cuenta: ${opts.appUrl}/app/billing

— Chalyb`;

  return {
    html: wrap({
      title: `Tu plan ${opts.tier} está activo · Chalyb`,
      preview: `Mercado Pago confirmó tu pago. Plan ${opts.tier} activado.`,
      body,
    }),
    text,
  };
}
