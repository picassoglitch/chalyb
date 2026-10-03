// Trial and billing emails (BUILD-SPEC §6.11; bodies from aceptacion-ux §3.6,
// §4, §5 and trial-to-paid-path §2). These are EVIDENCE: each has a template
// id and version that email_dispatches stores with the provider message id.
// Bump TEMPLATE_VERSION when any wording changes.
//
// Transactional only: no marketing in these. Spanish (legal texts are
// Spanish; Q29 covers English).

import { escapeHtml } from './escape';
import { wrap } from './templates';

export const TEMPLATE_VERSION = '1';

export type BillingEmailKind =
  | 'trial_welcome' // 1
  | 'trial_7d' // 2
  | 'charge_ok' // 3
  | 'charge_failed' // 3b
  | 'renew_7d' // 4 (and the -7 annual)
  | 'renew_30d' // 5
  | 'annual_summary' // 6
  | 'cancelled'; // 7

export interface BillingEmailVars {
  nombre: string;
  plan: string; // "Pro anual", "Pro mensual", "VIP"
  monto: string; // "$9,970"
  renovacion?: string; // "cada año ($9,970 MXN)"
  periodicidad?: string; // "por 1 año de Pro"
  fecha_inicio?: string;
  fecha_fin_prueba?: string;
  fecha_cobro?: string;
  fecha_recordatorio?: string;
  fecha_renovacion?: string;
  fecha_gracia?: string;
  fecha_fin_acceso?: string;
  fecha_hora_cancelacion?: string;
  ultimos4?: string;
  consent_id?: string;
  folio_cancelacion?: string;
  documentos?: { label: string; version: string; url: string }[];
  appUrl: string;
}

const p = (html: string) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#f4f3ee;">${html}</p>`;
const btn = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 18px;border-radius:10px;background:#e8bb7f;color:#070809;font-weight:700;text-decoration:none;">${escapeHtml(label)}</a>`;
const b = (s?: string) => `<b>${escapeHtml(s ?? '')}</b>`;
const e = (s?: string) => escapeHtml(s ?? '');
const card = (v: BillingEmailVars) => (v.ultimos4 ? ` a tu tarjeta ••${e(v.ultimos4)}` : '');

/** Subject, HTML and text for one email. */
export function billingEmail(kind: BillingEmailKind, v: BillingEmailVars) {
  const plan = `${v.appUrl}/app/billing`;
  let subject: string;
  let html: string[];
  switch (kind) {
    case 'trial_welcome':
      subject = 'Tu mes de Pro gratis ya empezó 🎉';
      html = [
        p(
          `Hola ${e(v.nombre)}, ya tienes Chalyb Pro completo: Clips, Señales, En vivo y todo lo demás.`,
        ),
        p(`Tu prueba gratis empezó el ${e(v.fecha_inicio)} y termina el ${b(v.fecha_fin_prueba)}.`),
        p(
          `${b('Hoy pagaste $0.')} Si no cancelas antes, el ${b(v.fecha_cobro)} cobraremos ${b(`${v.monto} MXN`)} (${e(v.plan)}, IVA incluido)${card(v)}, y después ${b(v.renovacion)} hasta que canceles.`,
        ),
        p(`Te avisaremos el ${e(v.fecha_recordatorio)}.`),
        p(`${b('Cancelar es 1 clic:')} Mi cuenta → Mi plan.`),
        btn(`${v.appUrl}/app/clips`, 'Hacer mis primeros clips') + btn(plan, 'Cancelar mi prueba'),
        p(
          `Documentos que aceptaste: ${(v.documentos ?? [])
            .map(
              (d) =>
                `<a href="${escapeHtml(d.url)}" style="color:#e8bb7f;">${e(d.label)} v${e(d.version)}</a>`,
            )
            .join(' · ')}`,
        ),
        p(`Folio de tu aceptación: ${b(v.consent_id)}`),
      ];
      break;
    case 'trial_7d':
      subject = 'Tu prueba gratis termina en 7 días';
      html = [
        p(
          `Hola ${e(v.nombre)}, tu mes de Pro gratis termina el ${b(v.fecha_fin_prueba)}. El ${b(v.fecha_cobro)} se cobrarán ${b(`${v.monto} MXN`)} (${e(v.periodicidad)}, IVA incluido)${card(v)} para seguir con Pro, y se renovará automáticamente hasta que canceles.`,
        ),
        p('No tienes que hacer nada para seguir con Pro.'),
        btn(plan, 'Ver mi plan') + btn(plan, 'Cancelar en 1 clic'),
      ];
      break;
    case 'charge_ok':
      subject = `Bienvenido a Chalyb ${v.plan.startsWith('VIP') ? 'VIP' : 'Pro'}`;
      html = [
        p(
          `Hola ${e(v.nombre)}, cobramos ${b(`${v.monto} MXN`)} (IVA incluido)${card(v)}. Tu plan ${e(v.plan)} está activo hasta el ${b(v.fecha_renovacion)}; se renovará automáticamente por ${b(`${v.monto} MXN`)} salvo que canceles.`,
        ),
        p('Cancela en 1 clic desde Mi plan.'),
        btn(plan, 'Mi plan') + btn(`${v.appUrl}/app`, 'Ir a Chalyb'),
      ];
      break;
    case 'charge_failed':
      subject = `No pudimos cobrar tu plan ${v.plan}`;
      html = [
        p(`Hola ${e(v.nombre)}, no pudimos cobrar ${b(`${v.monto} MXN`)} de tu plan ${e(v.plan)}.`),
        p(`Actualiza tu tarjeta para no perderlo. Tienes hasta el ${b(v.fecha_gracia)}.`),
        btn(plan, 'Actualizar tarjeta'),
      ];
      break;
    case 'renew_7d':
    case 'renew_30d':
      subject = `Tu plan ${v.plan} se renueva el ${v.fecha_cobro}`;
      html = [
        p(
          `Hola ${e(v.nombre)}, tu plan ${e(v.plan)} se renueva el ${b(v.fecha_cobro)} por ${b(`${v.monto} MXN`)} (IVA incluido)${card(v)}.`,
        ),
        p('Si quieres cambiarlo o cancelarlo, hazlo antes de esa fecha desde Mi plan.'),
        btn(plan, 'Ver mi plan') + btn(plan, 'Cancelar'),
      ];
      break;
    case 'annual_summary':
      subject = 'Tu resumen anual de Chalyb';
      html = [
        p(`Hola ${e(v.nombre)}, este es el resumen de tu suscripción:`),
        p(
          `Plan: ${b(v.plan)} · ${b(`${v.monto} MXN`)} cada mes (IVA incluido) · Próximo cobro: ${b(v.fecha_cobro)}.`,
        ),
        p('Puedes cancelar en 1 clic desde Mi plan, sin llamadas.'),
        btn(plan, 'Ver mi plan'),
      ];
      break;
    case 'cancelled':
      subject = `Cancelaste tu plan · Folio ${v.folio_cancelacion}`;
      html = [
        p(
          `Confirmamos tu cancelación (folio ${b(v.folio_cancelacion)}) el ${e(v.fecha_hora_cancelacion)}. Tu acceso de pago termina el ${b(v.fecha_fin_acceso)}. No habrá más cobros.`,
        ),
        p('Si cambias de opinión, puedes volver a activar Pro en cualquier momento.'),
        btn(plan, 'Ver mi plan'),
      ];
      break;
  }
  const body = html.join('\n');
  const text = body
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g, '$2: $1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  return {
    subject,
    html: wrap({ title: subject, preview: subject, body }),
    text,
    templateId: `billing.${kind}`,
    templateVersion: TEMPLATE_VERSION,
  };
}
