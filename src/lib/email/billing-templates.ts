// Trial and billing emails (BUILD-SPEC §6.11; bodies from aceptacion-ux §3.6,
// §4, §5 and trial-to-paid-path §2). These are EVIDENCE: each has a template
// id and version that email_dispatches stores with the provider message id.
// Bump TEMPLATE_VERSION when any wording changes.
//
// Transactional only: no marketing in these. Spanish (legal texts are
// Spanish; Q29 covers English).

import { escapeHtml } from './escape';
import { wrap } from './templates';

export const TEMPLATE_VERSION = '3';

export type BillingEmailKind =
  | 'trial_7d' // 1 · "Aviso de cobro", day 0 (mandatory)
  | 'trial_1d' // 2 · day 6, only with TRIAL_DAY6_REMINDER
  | 'charge_ok' // 3
  | 'charge_failed' // 3b
  | 'renew_7d' // 4 (and the -7 annual)
  | 'renew_30d' // 5
  | 'annual_summary' // 6
  | 'cancelled' // 7
  | 'price_change' // 8 · 30 days before (aceptacion-ux §4.1)
  | 'price_change_7d' // 9 · reminder if unanswered
  | 'lealtad_started' // 10 · Pro Lealtad confirmation with the calendar
  | 'lealtad_7d' // 11 · before EVERY Pro Lealtad charge (mandatory)
  | 'lealtad_failed' // 12 · a failed Pro Lealtad charge (day 0 and day 5)
  | 'chargeback_notice'; // 13 · bad-faith chargeback notice, 10 business days (aceptacion-ux §10.5 step 3)

export interface BillingEmailVars {
  nombre: string;
  plan: string; // "Pro anual", "Pro mensual", "VIP"
  monto: string; // "$9,970"
  renovacion?: string; // "cada año ($9,970 MXN)"
  periodicidad?: string; // "por 1 año de Pro"
  /** Trial length in days, from config. */
  dias?: number;
  /** Whole days left until the charge ("Faltan 7 días"). */
  faltan?: number;
  /** The same plan's monthly price, for the annual-only switch link. */
  switch_mensual?: string;
  /** "Pro" | "VIP": the plan the trial is on. */
  plan_corto?: string;
  /** cambiar?plan=… target of the switch link (pro_month | vip_month). */
  switch_plan?: string;
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
  /** Price change (WS-6). */
  precio_anterior?: string;
  precio_nuevo?: string;
  porcentaje?: number;
  periodo?: string; // "mes" | "año"
  /** Chargeback notice (WS-8). */
  fecha_consentimiento?: string;
  fecha_aviso?: string;
  resumen_uso?: string;
  /** Resolved in the user's favor: the amount is owed. */
  pendiente?: boolean;
  /** suspender | cerrar (Términos §10.6). */
  medida?: 'suspender' | 'cerrar';
  pagar_url?: string;
  responder_url?: string;
  fecha_aplicacion?: string;
  fecha_fin_periodo?: string;
  /** PRICE_INCREASE_NO_ANSWER = keep_old. */
  keep_old?: boolean;
  /** Pro Lealtad (WS-7). */
  fecha_hoy?: string;
  mes?: number;
  pct?: number;
  monto_anterior?: string;
  /** "fecha: monto" rows, month 2 → 7+. */
  calendario?: { fecha: string; monto: string; desde?: boolean }[];
  /** Amounts after this one, for the pre-charge notice. */
  siguientes?: string[];
  piso?: string;
  fecha_limite?: string;
  version_sus?: string;
  /** Month 1's amount: where the schedule restarts ("$1,662"). */
  reinicio?: string;
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
    case 'trial_7d': {
      // aceptacion-ux §3.6, verbatim: the legal ≥5-day charge notice and the
      // confirmation, nothing else (no welcome, no marketing).
      const cancel = `${v.appUrl}/app/billing?cancelar=1`;
      subject = `Aviso de cobro: el ${v.fecha_cobro} se cobrarán ${v.monto} MXN si no cancelas`;
      html = [
        p(`Hola ${e(v.nombre)}:`),
        p(
          `Tu prueba gratis de ${e(String(v.dias ?? ''))} días de Chalyb ${e(v.plan_corto ?? 'Pro')} empezó el ${e(v.fecha_inicio)} y termina el ${b(v.fecha_fin_prueba)}.`,
        ),
        p(
          `${b('Hoy pagaste $0.')} Si no cancelas antes, el ${b(v.fecha_cobro)} cobraremos ${b(`${v.monto} MXN`)} (${e(v.plan)})${card(v)}, y después ${b(v.renovacion)} hasta que canceles.`,
        ),
        p(
          `Faltan ${b(`${v.faltan ?? v.dias ?? ''} ${v.faltan === 1 ? 'día' : 'días'}`)} para el cobro.`,
        ),
        ...(v.switch_mensual
          ? [
              p('¿Prefieres pagar mes a mes?') +
                btn(
                  `${v.appUrl}/app/billing/cambiar?plan=${v.switch_plan ?? 'pro_month'}`,
                  `Cambiar a ${v.plan_corto ?? 'Pro'} mensual: ${v.switch_mensual} MXN al mes`,
                ),
            ]
          : []),
        p(
          `${b('Cancelar es 1 clic:')} <a href="${escapeHtml(cancel)}" style="color:#e8bb7f;">Cancelar mi prueba</a> (Mi cuenta → Mi plan). Si cancelas antes del ${e(v.fecha_cobro)}, no pagas nada y sigues con Pro hasta esa fecha.`,
        ),
        p(
          `Documentos que aceptaste: ${(v.documentos ?? [])
            .map(
              (d) =>
                `<a href="${escapeHtml(d.url)}" style="color:#e8bb7f;">${e(d.label)} v${e(d.version)}</a>`,
            )
            .join(' · ')}.`,
        ),
        p(`Folio de tu aceptación: ${e(v.consent_id)}`),
      ];
      break;
    }
    case 'trial_1d':
      // trial-to-paid-path §2 Email 2; only with TRIAL_DAY6_REMINDER (O-11).
      subject = 'Mañana termina tu prueba gratis';
      html = [
        p(
          `Hola ${e(v.nombre)}: mañana, ${e(v.fecha_cobro)}, se cobrarán ${b(`${v.monto} MXN`)} (${e(v.plan)})${card(v)}.`,
        ),
        p('Para seguir con Pro no tienes que hacer nada. ¿No quieres seguir?'),
        btn(plan, 'Ver mi plan') + btn(`${v.appUrl}/app/billing?cancelar=1`, 'Cancelar en 1 clic'),
        ...(v.switch_mensual
          ? [
              p('¿Prefieres pagar mes a mes?') +
                btn(
                  `${v.appUrl}/app/billing/cambiar?plan=${v.switch_plan ?? 'pro_month'}`,
                  `Cambiar a ${v.switch_mensual} MXN al mes`,
                ),
            ]
          : []),
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
    case 'price_change':
    case 'price_change_7d': {
      // aceptacion-ux §4.1, verbatim. Accepting is an express act in the app
      // (the button there records it); the email links to it.
      const decide = `${v.appUrl}/app/billing?precio=1`;
      subject = `Tu plan ${v.plan} cambia de precio: acepta o decide antes del ${v.fecha_aplicacion}`;
      html = [
        p(`Hola ${e(v.nombre)}:`),
        p(
          `El precio de ${e(v.plan)} sube de ${b(`${v.precio_anterior} MXN`)} a ${b(`${v.precio_nuevo} MXN al ${v.periodo}`)} (IVA incluido), un aumento de ${e(String(v.porcentaje))}%.`,
        ),
        p(
          `${b('Solo se te cobrará el nuevo precio si lo aceptas.')} Si lo aceptas, se aplicará a partir de tu renovación del ${b(v.fecha_aplicacion)}.`,
        ),
        p(
          v.keep_old
            ? `Si no lo aceptas antes de esa fecha, seguirás pagando ${b(`${v.precio_anterior} MXN`)}.`
            : `Si no lo aceptas antes de esa fecha, ${b('tu plan no se renovará al nuevo precio')}: conservas ${e(v.plan)} hasta el ${e(v.fecha_fin_periodo)} y después pasas al plan Gratis, sin ningún cobro.`,
        ),
        btn(decide, 'Acepto el nuevo precio') +
          btn(`${v.appUrl}/app/billing?cancelar=1`, 'Cancelar sin costo') +
          btn(plan, 'Ver mi plan'),
      ];
      break;
    }
    case 'lealtad_started': {
      // aceptacion-ux §4.2, verbatim.
      subject = 'Tu Pro Lealtad empezó: tu calendario de cobros';
      const cal = (v.calendario ?? [])
        .map((r) => `${r.desde ? 'desde el ' : ''}${e(r.fecha)}: ${b(`${r.monto} MXN`)}`)
        .join('<br>');
      html = [
        p(
          `Hola ${e(v.nombre)}: hoy, ${e(v.fecha_hoy)}, cobramos ${b(`${v.monto} MXN`)} (IVA incluido)${card(v)} por el mes 1.`,
        ),
        p(`Tu calendario:<br>${cal}`),
        p(
          `Tu precio vuelve a empezar en ${e(v.reinicio ?? v.monto)} si cancelas, cambias de plan o un pago queda sin cubrir 7 días después de fallar. Cambiar de tarjeta, un reembolso o un contracargo no lo reinician.`,
        ),
        p('Te avisaremos 7 días antes de cada cobro. Cancela en 1 clic:') + btn(plan, 'Mi plan'),
        p(
          `Folio de tu aceptación: ${e(v.consent_id)} · Términos de Suscripción v${e(v.version_sus)}`,
        ),
      ];
      break;
    }
    case 'lealtad_7d':
      subject = `El ${v.fecha_cobro} se cobran ${v.monto} MXN de tu Pro Lealtad (mes ${v.mes})`;
      html = [
        p(
          `Hola ${e(v.nombre)}: el ${b(v.fecha_cobro)} cobraremos ${b(`${v.monto} MXN`)} (IVA incluido)${card(v)} por el ${b(`mes ${v.mes}`)} de Pro Lealtad, ${e(String(v.pct))}% menos que tu mes 1. El mes pasado pagaste ${e(v.monto_anterior)}.`,
        ),
        p(
          (v.mes ?? 0) >= 7
            ? `Ya estás en tu precio más bajo: ${e(v.piso)} MXN al mes mientras sigas.`
            : `Después: ${(v.siguientes ?? []).map(e).join(', ')}, y desde el mes 7, ${e(v.piso)} MXN al mes.`,
        ),
        p(`Si cancelas o cambias de plan, tu precio vuelve a empezar en ${e(v.reinicio)}.`),
        p(`¿No quieres seguir?`) +
          btn(`${v.appUrl}/app/billing?cancelar=1`, 'Cancelar en 1 clic') +
          p(`antes del ${e(v.fecha_cobro)} y no se te cobra.`),
        btn(plan, 'Ver mi plan'),
      ];
      break;
    case 'lealtad_failed':
      subject = `No pudimos cobrar tu Pro Lealtad: tienes hasta el ${v.fecha_limite} para conservar tu precio`;
      html = [
        p(
          `Hola ${e(v.nombre)}: el cobro de ${b(`${v.monto} MXN`)} del ${e(v.fecha_cobro)} no pasó. Actualiza tu tarjeta antes del ${b(v.fecha_limite)} (7 días) y conservas tu mes ${e(String(v.mes))} del calendario. Si no se cubre, tu suscripción termina y, si vuelves, empiezas en ${e(v.reinicio)}.`,
        ),
        btn(`${v.appUrl}/app/billing/tarjeta`, 'Actualizar tarjeta'),
      ];
      break;
    case 'chargeback_notice':
      // Verbatim, aceptacion-ux §10.5 step 3. Sent by an admin, never alone.
      subject = `Aviso sobre el contracargo del cargo de ${v.monto} MXN del ${v.fecha_cobro}`;
      html = [
        p(
          `Hola ${e(v.nombre)}: disputaste ante tu banco el cargo de ${b(`${v.monto} MXN`)} del ${b(v.fecha_cobro)} por ${e(v.plan)}. Según nuestros registros, lo autorizaste el ${e(v.fecha_consentimiento)} (folio ${e(v.consent_id)}), te enviamos el aviso de cobro el ${e(v.fecha_aviso)} y usaste Chalyb en ese periodo (${e(v.resumen_uso)}).`,
        ),
        ...(v.pendiente ? [p(`El monto de ${e(v.monto)} MXN está pendiente de pago.`)] : []),
        p(
          `Tienes ${b(`10 días hábiles, hasta el ${v.fecha_limite}`)}, para: ${b('(1)')} <a href="${escapeHtml(v.pagar_url ?? `${v.appUrl}/app/billing`)}" style="color:#e8bb7f;">pagar el monto pendiente</a>, o ${b('(2)')} <a href="${escapeHtml(v.responder_url ?? `${v.appUrl}/contacto?categoria=cobro`)}" style="color:#e8bb7f;">responder</a> y explicarnos por qué el cargo no te correspondía (por ejemplo, si no lo autorizaste).`,
        ),
        p(
          `Si no pagas ni respondes en ese plazo, podríamos ${v.medida === 'cerrar' ? 'cerrar tu cuenta' : 'suspender las funciones de pago de tu cuenta hasta que se pague'}, y para volver a contratar un plan de pago te pediríamos el pago por adelantado, sin prueba gratis. Siempre podrás descargar tu contenido.`,
        ),
        p(
          'Pedir un reembolso o disputar un cargo no autorizado nunca tiene consecuencias. Si crees que esto es un error, responde a este correo.',
        ),
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
