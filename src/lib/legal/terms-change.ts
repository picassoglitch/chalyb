// The ≥30-day email before a relevant change (aceptacion-ux §8; old P6-5;
// Quebec requires 30 days for unilateral changes), the pure part.
//
// A relevant change (rights, payments or data) to a document people accept
// is announced by email at least 30 days before it applies to them. The
// daily /api/cron/legal keeps sending until every person owed the notice
// has a successful dispatch; that moment is the version's `complete_at`.
// The version is in force from the LATER of its registry date and
// complete_at + 30 days (7a review of #49, HIGH 1): a run that dies partway
// can only delay it, never cut the notice short. A person without a
// successful notice ≥ 30 days before that date is never asked to accept.
// The first version of a document has no earlier one to change, so it sends
// nothing and needs no notice.

import { escapeHtml } from '@/lib/email/escape';
import { wrap } from '@/lib/email/templates';
import type { VersionMeta } from './registry';

export const TERMS_CHANGE_NOTICE_DAYS = 30;
const DAY = 86_400_000;

export type TermsChangeDecision = 'none' | 'send' | 'complete';

/** Whether the cron still has notices to send for this version. */
export function termsChangeDecision(input: {
  published: boolean;
  meta: VersionMeta | null;
  /** An earlier published version exists (this one is a change). */
  noticeRequired: boolean;
  /** When every person owed the notice had a successful dispatch. */
  completeAt: string | null;
}): TermsChangeDecision {
  const { published, meta, noticeRequired, completeAt } = input;
  if (!published || !meta?.published || !meta.effective || meta.relevance !== 'relevant')
    return 'none';
  if (!noticeRequired) return 'none';
  return completeAt ? 'complete' : 'send';
}

/** The registry date can't be met any more: fewer than 30 days remain and
 *  people are still owed the notice (the version will start later). */
export function noticeIsLate(meta: VersionMeta | null, now: Date, remaining: number): boolean {
  if (!meta?.effective || remaining <= 0) return false;
  return Date.parse(meta.effective) - now.getTime() < TERMS_CHANGE_NOTICE_DAYS * DAY;
}

/** When the version actually applies: the registry date, or later if the
 *  notice finished less than 30 days before it; null while notices are
 *  still owed. */
export function inForceFrom(
  meta: VersionMeta | null,
  notice: { noticeRequired: boolean; completeAt: string | null },
): string | null {
  if (!meta?.effective) return null;
  if (meta.relevance !== 'relevant' || !notice.noticeRequired) return meta.effective;
  if (!notice.completeAt) return null;
  const after = Date.parse(notice.completeAt) + TERMS_CHANGE_NOTICE_DAYS * DAY;
  return new Date(Math.max(Date.parse(meta.effective), after)).toISOString();
}

/** A person was given the notice: a successful dispatch at least 30 days
 *  before the version applies. */
export function personNoticed(
  dispatch: { delivery_status: string; sent_at: string } | null,
  inForceAt: string,
): boolean {
  if (!dispatch || !['sent', 'delivered'].includes(dispatch.delivery_status)) return false;
  return Date.parse(dispatch.sent_at) <= Date.parse(inForceAt) - TERMS_CHANGE_NOTICE_DAYS * DAY;
}

/** Above this share of undeliverable notices for a version, the owner is
 *  warned once: those people are never asked to accept the change. */
export const UNDELIVERABLE_ALERT_PCT = 5;

export function undeliverableAlertDue(undeliverable: number, total: number): boolean {
  return total > 0 && undeliverable * 100 > UNDELIVERABLE_ALERT_PCT * total;
}

export const termsChangePeriodKey = (version: string, doc = 'terminos') => `${doc}:${version}`;

/** The document's name in a sentence ("nuestros Términos"). */
export const DOC_NAMES: Record<'terminos' | 'suscripcion' | 'privacidad', string> = {
  terminos: 'nuestros Términos',
  suscripcion: 'nuestros Términos de Suscripción',
  privacidad: 'nuestro Aviso de privacidad',
};

export interface TermsChangeEmailVars {
  doc?: keyof typeof DOC_NAMES;
  nombre: string;
  /** "1 de diciembre de 2026" */
  fecha: string;
  changes: string[];
  changesUrl: string;
  docUrl: string;
  cancelUrl: string;
}

const p = (s: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${s}</p>`;

/** Subject, HTML and text. Service notice: no marketing, no opt-out needed. */
export function termsChangeEmail(v: TermsChangeEmailVars) {
  const e = escapeHtml;
  const link = (href: string, label: string) =>
    `<a href="${e(href)}" style="color:#e8bb7f;">${e(label)}</a>`;
  const name = DOC_NAMES[v.doc ?? 'terminos'];
  const subject = `Cambios en ${name.replace(/^nuestros? /, 'los ').replace(/^los Aviso/, 'el Aviso')} de Chalyb a partir del ${v.fecha}`;
  const lines = v.changes.slice(0, 3);
  const html = wrap({
    title: subject,
    preview: `A partir del ${v.fecha} cambian algunos puntos de ${name}.`,
    body: [
      p(`Hola ${e(v.nombre)}:`),
      p(`A partir del <b>${e(v.fecha)}</b> cambian algunos puntos de ${e(name)}:`),
      lines.length
        ? `<ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.6;">${lines
            .map((c) => `<li>${e(c)}</li>`)
            .join('')}</ul>`
        : '',
      p(
        `${link(v.changesUrl, 'Ver todos los cambios')} · ${link(v.docUrl, 'Leer la nueva versión')}`,
      ),
      p(
        `Hasta esa fecha sigue aplicando la versión actual. Después te pediremos que aceptes la nueva al entrar; mientras no la aceptes, no se aplica a ningún cobro.`,
      ),
      p(
        `Si no estás de acuerdo, puedes ${link(v.cancelUrl, 'cancelar tu plan sin costo')} cuando quieras y descargar tu contenido.`,
      ),
    ].join(''),
  });
  const text = [
    `Hola ${v.nombre}:`,
    `A partir del ${v.fecha} cambian algunos puntos de ${name}:`,
    ...lines.map((c) => `• ${c}`),
    `Ver todos los cambios: ${v.changesUrl}`,
    `Leer la nueva versión: ${v.docUrl}`,
    'Hasta esa fecha sigue aplicando la versión actual. Después te pediremos que aceptes la nueva al entrar; mientras no la aceptes, no se aplica a ningún cobro.',
    `Si no estás de acuerdo, puedes cancelar tu plan sin costo cuando quieras y descargar tu contenido: ${v.cancelUrl}`,
  ].join('\n');
  return { subject, html, text, templateId: 'terms_change', templateVersion: '1' };
}
