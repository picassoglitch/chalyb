// The ≥30-day email before a relevant Terms change (aceptacion-ux §8; old
// P6-5; Quebec requires 30 days for unilateral changes), the pure part.
//
// A relevant change (rights, payments or data) is announced by email at least
// 30 days before its effective date; after that date the §8 modal asks for
// acceptance. The daily /api/cron/legal sends it once per user and version
// (email_dispatches' unique key). If the first chance to send is already
// inside the 30 days, nothing is sent and the run reports `too_late`: the
// owner must move the effective date, never shorten the notice.

import { escapeHtml } from '@/lib/email/escape';
import { wrap } from '@/lib/email/templates';
import type { VersionMeta } from './registry';

export const TERMS_CHANGE_NOTICE_DAYS = 30;
const DAY = 86_400_000;

export type TermsChangeDecision = 'none' | 'send' | 'too_late';

export function termsChangeDecision(input: {
  published: boolean;
  meta: VersionMeta | null;
  now: Date;
}): TermsChangeDecision {
  const { published, meta, now } = input;
  if (!published || !meta?.published || !meta.effective || meta.relevance !== 'relevant')
    return 'none';
  const effective = Date.parse(meta.effective);
  if (now.getTime() >= effective) return 'none';
  return effective - now.getTime() >= TERMS_CHANGE_NOTICE_DAYS * DAY ? 'send' : 'too_late';
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
